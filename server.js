const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

// 🌐 SERVEUR WEB
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

// ⚠️ AVERTISSEMENTS
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

// 🤖 CONNEXION
client.once("clientReady", () => {
  console.log(
    "Dream Community connecté en tant que " +
    client.user.tag
  );
});

// 👋 BIENVENUE
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.systemChannel;

  if (!channel) return;

  await channel.send(
    `👋 Bienvenue ${member} dans **Dream Community** ! 🌙✨\n` +
    `Amuse-toi bien et n'oublie pas de lire le règlement ! 📜`
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

  // 🚨 SIGNALEMENT
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
        "❌ Indique une raison.\n" +
        "Exemple : `!report @membre harcèlement`"
      );
    }

    const salonSignalements =
      message.guild.channels.cache.find(
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
          value:
            `${membre}\n` +
            `\`${membre.user.tag}\`\n` +
            `ID : \`${membre.id}\``,
          inline: false
        },
        {
          name: "🙋 Signalé par",
          value:
            `${message.author}\n` +
            `\`${message.author.tag}\`\n` +
            `ID : \`${message.author.id}\``,
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
      content:
        "🚨 **Nouveau signalement pour le Staff !**",
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
      return message.reply(
        "❌ Tu n'as pas la permission."
      );
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("menu_ticket")
      .setPlaceholder("🎫 Que souhaites-tu faire ?")
      .addOptions(
        {
          label: "Devenir Admin",
          description:
            "Découvrir comment rejoindre l'administration",
          value: "devenir_admin",
          emoji: "👑"
        },
        {
          label: "Site Web",
          description:
            "Accéder au site officiel de Dream Community",
          value: "site_web",
          emoji: "🌐"
        },
        {
          label: "Contacter le Support",
          description:
            "Créer un ticket avec le Staff",
          value: "contacter_support",
          emoji: "🛟"
        }
      );

    const row = new ActionRowBuilder()
      .addComponents(menu);

    return message.channel.send({
      content:
        "🎫 **DREAM COMMUNITY — SUPPORT**\n\n" +
        "Bienvenue dans le centre de support ! 🌙\n\n" +
        "Sélectionne une option dans le menu ci-dessous :",
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
      return message.reply(
        "❌ Tu n'as pas la permission."
      );
    }

    const membre =
      message.mentions.members.first();

    if (!membre) {
      return message.reply(
        "❌ Mentionne un membre."
      );
    }

    const raison =
      message.content
        .split(" ")
        .slice(2)
        .join(" ") ||
      "Aucune raison précisée.";

    await ajouterAvertissement(
      membre,
      message.channel,
      raison
    );

    return;
  }

  // 📊 WARNS
  if (contenu === "!warns") {
    const nombre =
      avertissements.get(message.author.id) || 0;

    return message.reply(
      `⚠️ **Tes avertissements : ${nombre}/3**`
    );
  }

  // 🔇 MUTE
  if (contenu.startsWith("!mute ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ModerateMembers
      )
    ) {
      return message.reply(
        "❌ Tu n'as pas la permission."
      );
    }

    const membre =
      message.mentions.members.first();

    if (!membre) {
      return message.reply(
        "❌ Mentionne un membre."
      );
    }

    try {
      await membre.timeout(
        10 * 60 * 1000,
        "Sanction Dream Community"
      );

      return message.reply(
        `🔇 ${membre} a été mis en silence pendant **10 minutes**.`
      );
    } catch (erreur) {
      console.error(erreur);

      return message.reply(
        "❌ Impossible d'appliquer la sanction."
      );
    }
  }

  // 👢 KICK
  if (contenu.startsWith("!kick ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.KickMembers
      )
    ) {
      return message.reply(
        "❌ Tu n'as pas la permission."
      );
    }

    const membre =
      message.mentions.members.first();

    if (!membre) {
      return message.reply(
        "❌ Mentionne un membre."
      );
    }

    try {
      await membre.kick(
        "Sanction Dream Community"
      );

      return message.reply(
        `👢 ${membre.user.tag} a été expulsé.`
      );
    } catch (erreur) {
      console.error(erreur);

      return message.reply(
        "❌ Impossible d'expulser ce membre."
      );
    }
  }

  // 🚫 BAN
  if (contenu.startsWith("!ban ")) {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.BanMembers
      )
    ) {
      return message.reply(
        "❌ Tu n'as pas la permission."
      );
    }

    const membre =
      message.mentions.members.first();

    if (!membre) {
      return message.reply(
        "❌ Mentionne un membre."
      );
    }

    try {
      await membre.ban({
        reason:
          "Sanction Dream Community"
      });

      return message.reply(
        `🚫 ${membre.user.tag} a été banni.`
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

  avertissements.set(
    id,
    nouveauNombre
  );

  if (nouveauNombre === 1) {
    await channel.send(
      `⚠️ ${membre} reçoit son **1er avertissement**.\n` +
      `📝 Raison : ${raison}\n` +
      `📊 Avertissements : **1/3**`
    );

    return;
  }

  if (nouveauNombre === 2) {
    await channel.send(
      `⚠️ ${membre} reçoit son **2e avertissement**.\n` +
      `📝 Raison : ${raison}\n` +
      `📊 Avertissements : **2/3**`
    );

    return;
  }

  if (nouveauNombre === 3) {
    try {
      await membre.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements - Suspension Dream Community"
      );

      await channel.send(
        `⏳ ${membre} atteint **3 avertissements**.\n\n` +
        `Sanction : **SUSPENSION 24 HEURES**.\n` +
        `📝 Dernière raison : ${raison}`
      );
    } catch (erreur) {
      console.error(erreur);

      await channel.send(
        `⚠️ ${membre} atteint **3 avertissements**, ` +
        `mais la suspension n'a pas pu être appliquée.`
      );
    }

    return;
  }
}

// 🎛️ INTERACTIONS
client.on(
  "interactionCreate",
  async (interaction) => {

    // 📋 MENU TICKET
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "menu_ticket"
    ) {

      // 👑 DEVENIR ADMIN
      if (
        interaction.values[0] ===
        "devenir_admin"
      ) {
        return interaction.reply({
          content:
            "👑 **DEVENIR ADMIN — DREAM COMMUNITY**\n\n" +
            "Tu souhaites rejoindre l'administration ?\n\n" +
            "📋 Une candidature peut être demandée.\n" +
            "🤝 Le Staff étudiera ta demande.\n\n" +
            "🛟 Pour plus d'informations, contacte le Support.",
          ephemeral: true
        });
      }

      // 🌐 SITE WEB
      if (
        interaction.values[0] ===
        "site_web"
      ) {
        return interaction.reply({
          content:
            "🌐 **SITE WEB DREAM COMMUNITY**\n\n" +
            "Accède au site ici :\n" +
            "http://6aaae97cbf7b6.site123.me/",
          ephemeral: true
        });
      }

      // 🛟 CONTACTER LE SUPPORT
      if (
        interaction.values[0] ===
        "contacter_support"
      ) {

        // ⚡ RÉPONDRE IMMÉDIATEMENT À DISCORD
        await interaction.deferReply({
          ephemeral: true
        });

        try {
          const guild =
            interaction.guild;

          // 🔐 Vérification permission du BOT
          const botMember =
            guild.members.me;

          if (
            !botMember ||
            !botMember.permissions.has(
              PermissionFlagsBits.ManageChannels
            )
          ) {
            return interaction.editReply({
              content:
                "❌ Le bot n'a pas la permission **Gérer les salons**."
            });
          }

          // 🎫 NOM DU TICKET
          const nomTicket =
            "ticket-" +
            interaction.user.id;

          // 🔎 TICKET EXISTANT
          const ticketExistant =
            guild.channels.cache.find(
              (channel) =>
                channel.name === nomTicket
            );

          if (ticketExistant) {
            return interaction.editReply({
              content:
                `❌ Tu as déjà un ticket ouvert : ${ticketExistant}`
            });
          }

          // 📁 CATÉGORIE
          let categorie =
            guild.channels.cache.find(
              (channel) =>
                channel.type ===
                  ChannelType.GuildCategory &&
                channel.name ===
                  "🎫 TICKETS"
            );

          // ➕ CRÉER LA CATÉGORIE SI ABSENTE
          if (!categorie) {
            categorie =
              await guild.channels.create({
                name: "🎫 TICKETS",
                type:
                  ChannelType.GuildCategory
              });
          }

          // 👮 RÔLE STAFF
          const staffRole =
            guild.roles.cache.find(
              (role) =>
                role.name.toLowerCase() ===
                "staff"
            );

          // 🔒 PERMISSIONS
          const permissions = [
            {
              id:
                guild.roles.everyone.id,
              deny: [
                PermissionFlagsBits.ViewChannel
              ]
            },
            {
              id:
                interaction.user.id,
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

          // 🎫 CRÉATION DU TICKET
          const ticket =
            await guild.channels.create({
              name: nomTicket,
              type:
                ChannelType.GuildText,
              parent: categorie.id,
              permissionOverwrites:
                permissions
            });

          // 🔒 BOUTON FERMER
          const fermer =
            new ButtonBuilder()
              .setCustomId(
                "fermer_ticket"
              )
              .setLabel(
                "🔒 Fermer le ticket"
              )
              .setStyle(
                ButtonStyle.Danger
              );

          const row =
            new ActionRowBuilder()
              .addComponents(
                fermer
              );

          // 💬 MESSAGE DU TICKET
          await ticket.send({
            content:
              "🎫 **Ticket ouvert !**\n\n" +
              `${interaction.user}, explique ton problème ici.\n` +
              "Le Staff viendra te répondre dès que possible.",
            components: [row]
          });

          // ✅ RÉPONSE FINALE
          return interaction.editReply({
            content:
              `✅ Ton ticket a été créé : ${ticket}`
          });

        } catch (erreur) {

          console.error(
            "❌ ERREUR CRÉATION TICKET :",
            erreur
          );

          return interaction.editReply({
            content:
              "❌ Impossible de créer le ticket.\n\n" +
              "Vérifie que le bot possède la permission **Gérer les salons**."
          }).catch(console.error);
        }
      }
    }

    // 🔒 FERMER UN TICKET
    if (
      interaction.isButton() &&
      interaction.customId ===
        "fermer_ticket"
    ) {

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
  }
);

// 🔐 CONNEXION
client.login(
  process.env.DISCORD_TOKEN
);
