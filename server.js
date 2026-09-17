const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Dream Community Bot est en ligne !");
});

app.listen(PORT, () => {
  console.log("Serveur web actif sur le port " + PORT);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("clientReady", () => {
  console.log("Dream Community connecte en tant que " + client.user.tag);
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

// 📩 COMMANDES
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const contenu = message.content.toLowerCase();

  // 🚨 ANTI-INSULTES
  const insultes = [
    "connard",
    "connasse",
    "fdp",
    "pute",
    "salope",
    "enculé",
    "encule",
    "nique",
    "ntm"
  ];

  if (insultes.some((mot) => contenu.includes(mot))) {
    try {
      await message.delete();

      await message.channel.send(
        "🚨 " +
          message.author +
          ", les insultes ne sont pas autorisées ici !"
      );
    } catch (erreur) {
      console.error(erreur);
    }

    return;
  }

  // 📜 RÈGLEMENT
  if (contenu === "!reglement") {
    return message.reply(
      "📜 **REGLEMENT — DREAM COMMUNITY**\n\n" +
        "🤝 Respect obligatoire\n" +
        "🚫 Pas de harcelement\n" +
        "🚫 Pas d'insultes ou menaces\n" +
        "🚫 Pas de spam\n" +
        "🔞 Pas de contenu inapproprie\n" +
        "⚠️ Le Staff peut sanctionner en cas d'infraction."
    );
  }

  // 🌙 DREAM
  if (contenu === "!dream") {
    return message.reply(
      "🌙 **DREAM COMMUNITY — SAISON 3** 🌙\n\n" +
        "Une communaute pour discuter, partager et participer a des evenements !"
    );
  }

  // 🎫 PANNEAU TICKET
  if (contenu === "!ticket") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
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

  // ⚠️ WARN
  if (contenu.startsWith("!warn ")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    const raison =
      message.content.split(" ").slice(2).join(" ") ||
      "Aucune raison precisee.";

    return message.reply(
      "⚠️ **Avertissement**\n" +
        membre +
        " a reçu un avertissement.\n📝 Raison : " +
        raison
    );
  }

  // 🔇 MUTE
  if (contenu.startsWith("!mute ")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
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
        "🔇 " + membre + " a ete mis en silence pendant **10 minutes**."
      );
    } catch (erreur) {
      console.error(erreur);
      return message.reply("❌ Impossible d'appliquer la sanction.");
    }
  }

  // 👢 KICK
  if (contenu.startsWith("!kick ")) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    try {
      await membre.kick("Sanction Dream Community");

      return message.reply(
        "👢 " + membre.user.tag + " a ete expulse."
      );
    } catch (erreur) {
      console.error(erreur);
      return message.reply("❌ Impossible d'expulser ce membre.");
    }
  }

  // 🚫 BAN
  if (contenu.startsWith("!ban ")) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
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
        "🚫 " + membre.user.tag + " a ete banni."
      );
    } catch (erreur) {
      console.error(erreur);
      return message.reply("❌ Impossible de bannir ce membre.");
    }
  }
});

// 🎫 BOUTONS DES TICKETS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // 🎫 CREATION
  if (interaction.customId === "creer_ticket") {
    const guild = interaction.guild;

    const ticketExistant = guild.channels.cache.find(
      (channel) =>
        channel.name ===
        "ticket-" + interaction.user.username.toLowerCase()
    );

    if (ticketExistant) {
      return interaction.reply({
        content: "❌ Tu as déjà un ticket ouvert : " + ticketExistant,
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
      (role) => role.name.toLowerCase() === "staff"
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
      name: "ticket-" + interaction.user.username.toLowerCase(),
      type: ChannelType.GuildText,
      parent: categorie.id,
      permissionOverwrites: permissions
    });

    const fermer = new ButtonBuilder()
      .setCustomId("fermer_ticket")
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(fermer);

    await ticket.send({
      content:
        "🎫 **Ticket ouvert !**\n\n" +
        interaction.user +
        ", explique ton problème ici.\n" +
        "Le Staff viendra te répondre dès que possible.",
      components: [row]
    });

    return interaction.reply({
      content: "✅ Ton ticket a été créé : " + ticket,
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
        content: "❌ Seul le Staff peut fermer ce ticket.",
        ephemeral: true
      });
    }

    await interaction.reply("🔒 Fermeture du ticket...");

    setTimeout(() => {
      interaction.channel.delete().catch(console.error);
    }, 2000);
  }
});

client.login(process.env.DISCORD_TOKEN);
