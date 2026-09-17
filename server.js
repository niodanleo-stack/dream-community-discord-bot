const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Dream Community Bot est en ligne !");
});

app.listen(PORT, () => {
  console.log("Serveur web actif sur le port " + PORT);
});

// 🤖 CLIENT DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ⚠️ SANCTIONS
const avertissements = new Map();

// 🚨 INSULTES
const insultes = [
  "connard",
  "connasse",
  "fdp",
  "pute",
  "salope",
  "enculé",
  "encule",
  "nique",
  "ntm",
  "ta gueule",
  "tg",
  "ferme ta gueule",
  "baise ta mère",
  "baise ta mere",
  "va te faire foutre",
  "va te faire enculer",
  "ftg"
];

client.once("clientReady", () => {
  console.log(
    "Dream Community connecte en tant que " + client.user.tag
  );
});

// 👋 BIENVENUE
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.systemChannel;

  if (!channel) return;

  channel.send(
    "👋 Bienvenue " +
      member +
      " dans **Dream Community** ! 🌙✨\n" +
      "Amuse-toi bien et n'oublie pas de lire le règlement ! 📜"
  ).catch(console.error);
});

// 📩 MESSAGES
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const contenu = message.content.toLowerCase();

  // 🚨 ANTI-INSULTES
  const contientInsulte = insultes.some((mot) =>
    contenu.includes(mot)
  );

  if (contientInsulte) {
    try {
      await message.delete();

      await ajouterAvertissement(
        message.member,
        message.channel,
        "Insulte / comportement irrespectueux"
      );
    } catch (erreur) {
      console.error(erreur);
    }

    return;
  }

  // 📜 RÈGLEMENT
  if (contenu === "!reglement") {
    return message.reply(
      "📜 **RÈGLEMENT — DREAM COMMUNITY**\n\n" +
        "🚫 Harcèlement, menaces & haine interdits\n" +
        "🔞 Aucun contenu inapproprié\n" +
        "🔒 Protège tes informations personnelles\n" +
        "❌ Pas d’arnaques ou faux liens\n" +
        "⚠️ Pas de désinformation\n" +
        "⚖️ Respect du staff & des sanctions\n\n" +
        "⚠️ **SANCTIONS**\n" +
        "⚠️ 3 avertissements → ⏳ Suspension\n" +
        "🚫 Après suspension → Exclusion"
    );
  }

  // 🌙 DREAM
  if (contenu === "!dream") {
    return message.reply(
      "🌙 **DREAM COMMUNITY — SAISON 3** 🌙\n\n" +
        "Une communauté pour discuter, partager et participer à des événements !"
    );
  }

  // 🚨 SIGNALER UN MEMBRE
  if (contenu.startsWith("!report ")) {
    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply(
        "❌ Mentionne le membre que tu souhaites signaler."
      );
    }

    if (membre.id === message.author.id) {
      return message.reply(
        "❌ Tu ne peux pas te signaler toi-même."
      );
    }

    const raison = message.content
      .replace(/^!report\s+<@!?\d+>\s*/i, "")
      .trim();

    if (!raison) {
      return message.reply(
        "❌ Indique une raison.\nExemple : `!report @membre harcèlement`"
      );
    }

    const salonSignalements = message.guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        (
          channel.name === "🚨・signalements" ||
          channel.name === "🚨-signalements"
        )
    );

    if (!salonSignalements) {
      return message.reply(
        "❌ Le salon `🚨・signalements` n'a pas été trouvé."
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("🚨 NOUVEAU SIGNALEMENT")
      .setDescription(
        "Un membre vient d'être signalé."
      )
      .addFields(
        {
          name: "👤 Membre signalé",
          value: `${membre} (${membre.user.tag})`,
          inline: false
        },
        {
          name: "🙋 Signalé par",
          value: `${message.author} (${message.author.tag})`,
          inline: false
        },
        {
          name: "📝 Raison",
          value: raison,
          inline: false
        }
      )
      .setTimestamp();

    await salonSignalements.send({
      content: "🚨 **Nouveau signalement pour le Staff !**",
      embeds: [embed]
    });

    return message.reply(
      "✅ Ton signalement a été envoyé au Staff."
    );
  }

  // 🎫 PANNEAU TICKET
  if (contenu === "!ticket") {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ManageChannels
      )
    ) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const bouton = new ButtonBuilder()
      .setCustomId("creer_ticket")
      .setLabel("🎫 Créer un ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(bouton);

    return message.channel.send({
      content:
        "🎫 **SUPPORT DREAM COMMUNITY**\n\n" +
        "Besoin d'aide ? Clique sur le bouton ci-dessous pour créer un ticket avec le Staff.",
      components: [row]
    });
  }

  // ⚠️ WARN MANUEL
  if (contenu.startsWith("!warn ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ModerateMembers
      )
    ) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    const raison =
      message.content.split(" ").slice(2).join(" ") ||
      "Aucune raison précisée.";

    await ajouterAvertissement(
      membre,
      message.channel,
      raison
    );

    return;
  }

  // 📊 VOIR SES AVERTISSEMENTS
  if (contenu === "!warns") {
    const nombre =
      avertissements.get(message.author.id) || 0;

    return message.reply(
      "⚠️ **Tes avertissements : " +
        nombre +
        "/3**"
    );
  }

  // 🔇 MUTE MANUEL
  if (contenu.startsWith("!mute ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ModerateMembers
      )
    ) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    try {
      await membre.timeout(
        10 * 60 * 1000,
        "Sanction Dream Community"
      );

      return message.reply(
        "🔇 " +
          membre +
          " a été mis en silence pendant **10 minutes**."
      );
    } catch (erreur) {
      console.error(erreur);
      return message.reply(
        "❌ Impossible d'appliquer la sanction."
      );
    }
  }

  // 👢 KICK MANUEL
  if (contenu.startsWith("!kick ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.KickMembers
      )
    ) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    try {
      await membre.kick("Sanction Dream Community");

      return message.reply(
        "👢 " +
          membre.user.tag +
          " a été expulsé."
      );
    } catch (erreur) {
      console.error(erreur);
      return message.reply(
        "❌ Impossible d'expulser ce membre."
      );
    }
  }

  // 🚫 BAN MANUEL
  if (contenu.startsWith("!ban ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.BanMembers
      )
    ) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    try {
      await membre.ban({
        reason: "Sanction Dream Community"
      });

      return message.reply(
        "🚫 " +
          membre.user.tag +
          " a été banni."
      );
    } catch (erreur) {
      console.error(erreur);
      return message.reply(
        "❌ Impossible de bannir ce membre."
      );
    }
  }
});

// ⚠️ AJOUTER UN AVERTISSEMENT
async function ajouterAvertissement(
  membre,
  channel,
  raison
) {
  if (!membre) return;

  const id = membre.id;

  const nouveauNombre =
    (avertissements.get(id) || 0) + 1;

  avertissements.set(id, nouveauNombre);

  // 1 WARN
  if (nouveauNombre === 1) {
    await channel.send(
      "⚠️ " +
        membre +
        " reçoit son **1er avertissement**.\n" +
        "📝 Raison : " +
        raison +
        "\n" +
        "📊 Avertissements : **1/3**"
    );

    return;
  }

  // 2 WARNS
  if (nouveauNombre === 2) {
    await channel.send(
      "⚠️ " +
        membre +
        " reçoit son **2e avertissement**.\n" +
        "📝 Raison : " +
        raison +
        "\n" +
        "📊 Avertissements : **2/3**"
    );

    return;
  }

  // 3 WARNS → SUSPENSION
  if (nouveauNombre === 3) {
    try {
      await membre.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements - Suspension Dream Community"
      );

      await channel.send(
        "⏳ " +
          membre +
          " atteint **3 avertissements**.\n\n" +
          "Sanction : **SUSPENSION** pendant 24 heures.\n" +
          "🌐 La suspension concerne l'accès Discord de la communauté.\n" +
          "📝 Dernière raison : " +
          raison
      );
    } catch (erreur) {
      console.error(erreur);

      await channel.send(
        "⚠️ " +
          membre +
          " atteint **3 avertissements**, mais la suspension n'a pas pu être appliquée."
      );
    }

    return;
  }
}

// 🎫 BOUTONS DES TICKETS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // 🎫 CREATION
  if (interaction.customId === "creer_ticket") {
    const guild = interaction.guild;

    const ticketExistant = guild.channels.cache.find(
      (channel) =>
        channel.name ===
        "ticket-" +
          interaction.user.username.toLowerCase()
    );

    if (ticketExistant) {
      return interaction.reply({
        content:
          "❌ Tu as déjà un ticket ouvert : " +
          ticketExistant,
        ephemeral: true
      });
    }

    let categorie = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === "🎫 TICKETS"
    );

    if (!categorie) {
      categorie = await guild.channels.create({
        name: "🎫 TICKETS",
        type: ChannelType.GuildCategory
      });
    }

    const staffRole = guild.roles.cache.find(
      (role) =>
        role.name.toLowerCase() === "staff"
    );

    const permissions = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    if (staffRole) {
      permissions.push({
        id: staffRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels
        ]
      });
    }

    const ticket = await guild.channels.create({
      name:
        "ticket-" +
        interaction.user.username.toLowerCase(),
      type: ChannelType.GuildText,
      parent: categorie.id,
      permissionOverwrites: permissions
    });

    const fermer = new ButtonBuilder()
      .setCustomId("fermer_ticket")
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder()
      .addComponents(fermer);

    await ticket.send({
      content:
        "🎫 **Ticket ouvert !**\n\n" +
        interaction.user +
        ", explique ton problème ici.\n" +
        "Le Staff viendra te répondre dès que possible.",
      components: [row]
    });

    return interaction.reply({
      content:
        "✅ Ton ticket a été créé : " +
        ticket,
      ephemeral: true
    });
  }

  // 🔒 FERMETURE
  if (interaction.customId === "fermer_ticket") {
    if (
      !interaction.member.permissions.has(
        PermissionFlagsBits.ManageChannels
      )
    ) {
      return interaction.reply({
        content:
          "❌ Seul le Staff peut fermer ce ticket.",
        ephemeral: true
      });
    }

    await interaction.reply(
      "🔒 Fermeture du ticket..."
    );

    setTimeout(() => {
      interaction.channel
        .delete()
        .catch(console.error);
    }, 2000);
  }
});

client.login(process.env.DISCORD_TOKEN);
