const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const fs = require("fs");

// =====================================================
// 🌙 CONFIGURATION
// =====================================================

const app = express();
const PORT = process.env.PORT || 10000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================================================
// 📁 FICHIERS DE SAUVEGARDE
// =====================================================

const XP_FILE = "./xp.json";
const COUNTING_FILE = "./counting.json";

if (!fs.existsSync(XP_FILE)) {
  fs.writeFileSync(XP_FILE, "{}");
}

if (!fs.existsSync(COUNTING_FILE)) {
  fs.writeFileSync(
    COUNTING_FILE,
    JSON.stringify({
      count: 0,
      record: 0,
      participants: {},
      date: ""
    }, null, 2)
  );
}

let xpData = JSON.parse(fs.readFileSync(XP_FILE, "utf8"));

let countingData = JSON.parse(
  fs.readFileSync(COUNTING_FILE, "utf8")
);

// =====================================================
// ⚙️ CONFIGURATION DES SALONS
// =====================================================

const CHANNEL_ANNONCES = "📢・𝗔𝗻𝗻𝗼𝗻𝗰𝗲𝘀-𝗢𝗳𝗳𝗶𝗰𝗶𝗲𝗹𝗹𝗲𝘀";
const CHANNEL_TICKETS = "🎫 TICKETS";
const CHANNEL_REPORTS = "🚨・signalements";
const CHANNEL_SUGGESTIONS = "💡・suggestions";
const CHANNEL_DECOMPTE = "🔢・décompte";

// =====================================================
// 🚫 ANTI-INSULTES
// =====================================================

const insultes = [
  "connard",
  "connasse",
  "pute",
  "putain",
  "fdp",
  "ntm",
  "tg",
  "enculé",
  "encule",
  "merde",
  "salope"
];

// =====================================================
// 🧠 UTILITAIRES
// =====================================================

function sauvegarderXP() {
  fs.writeFileSync(
    XP_FILE,
    JSON.stringify(xpData, null, 2)
  );
}

function sauvegarderCounting() {
  fs.writeFileSync(
    COUNTING_FILE,
    JSON.stringify(countingData, null, 2)
  );
}

function xpPourNiveau(niveau) {
  return 100 + 50 * (niveau - 1);
}

function obtenirXP(userId) {
  if (!xpData[userId]) {
    xpData[userId] = {
      xp: 0,
      niveau: 1,
      avertissements: 0
    };
  }

  return xpData[userId];
}

function verifierNouveauJour() {
  const aujourdHui = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris"
  });

  if (countingData.date !== aujourdHui) {
    countingData.date = aujourdHui;
    countingData.participants = {};
    sauvegarderCounting();
  }
}

// =====================================================
// ⭐ XP
// =====================================================

const cooldownXP = new Map();

async function ajouterXP(member) {
  if (!member) return;

  const userId = member.id;
  const maintenant = Date.now();

  if (cooldownXP.has(userId)) {
    const dernier = cooldownXP.get(userId);

    if (maintenant - dernier < 30000) {
      return;
    }
  }

  cooldownXP.set(userId, maintenant);

  const data = obtenirXP(userId);

  data.xp += 10;

  let niveauUp = false;

  while (data.xp >= xpPourNiveau(data.niveau)) {
    data.xp -= xpPourNiveau(data.niveau);
    data.niveau++;
    niveauUp = true;
  }

  sauvegarderXP();

  if (niveauUp) {
    const salon = member.guild.channels.cache.find(
      c => c.name === CHANNEL_ANNONCES
    );

    if (salon) {
      await salon.send(
        `🎉 Félicitations ${member} ! Tu viens de passer **niveau ${data.niveau}** ! 🌙✨`
      );
    }
  }
}

// =====================================================
// ⚠️ AVERTISSEMENT
// =====================================================

async function ajouterAvertissement(member, channel, raison) {
  if (!member) return;

  const data = obtenirXP(member.id);

  data.avertissements++;

  sauvegarderXP();

  if (data.avertissements >= 3) {
    try {
      await member.timeout(
        24 * 60 * 60 * 1000,
        raison
      );

      await channel.send(
        `⏳ ${member} a reçu son **3e avertissement**.\n` +
        `Il/elle est donc temporairement suspendu(e) pendant **24 heures** sur Discord.\n\n` +
        `📌 Raison : ${raison}`
      );

      return;
    } catch (error) {
      console.error("Erreur timeout :", error);
    }
  }

  await channel.send(
    `⚠️ ${member} reçoit un avertissement.\n` +
    `**Avertissements : ${data.avertissements}/3**\n` +
    `📌 Raison : ${raison}`
  );
}

// =====================================================
// 👋 BIENVENUE + AUTO-RÔLE
// =====================================================

client.on("guildMemberAdd", async member => {
  try {
    const role = member.guild.roles.cache.find(
      role => role.name === "Citoyen"
    );

    if (role) {
      try {
        await member.roles.add(role);
      } catch (error) {
        console.log(
          "Impossible de donner le rôle Citoyen :",
          error.message
        );
      }
    }

    const salon = member.guild.channels.cache.find(
      channel => channel.name === CHANNEL_ANNONCES
    );

    if (salon) {
      await salon.send(
        `🌙✨ **Bienvenue ${member} dans Dream Community !**\n\n` +
        `Nous sommes heureux de t'accueillir parmi nous ! 💫\n` +
        `Amuse-toi bien et n'oublie pas de consulter le règlement. 📜`
      );
    }
  } catch (error) {
    console.error("Erreur bienvenue :", error);
  }
});

// =====================================================
// 🤖 BOT PRÊT
// =====================================================

client.once("clientReady", () => {
  console.log(`🌙 DreamBot connecté : ${client.user.tag}`);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
});

// =====================================================
// 💬 MESSAGES
// =====================================================

client.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;

    const contenuOriginal = message.content.trim();
    const contenu = contenuOriginal.toLowerCase();

    // =================================================
    // 🚫 ANTI-INSULTES
    // =================================================

    const texteNormalise = contenuOriginal.toLowerCase();

    const contientInsulte = insultes.some(insulte =>
      texteNormalise.includes(insulte)
    );

    if (contientInsulte) {
      try {
        await message.delete();
      } catch {}

      await ajouterAvertissement(
        message.member,
        message.channel,
        "Langage inapproprié"
      );

      return;
    }

    // =================================================
    // 🔢 JEU DU DÉCOMPTE
    // =================================================

    verifierNouveauJour();

    if (message.channel.name === CHANNEL_DECOMPTE) {
      const nombre = Number(message.content.trim());

      if (!Number.isInteger(nombre)) return;

      const userId = message.author.id;

      // Une participation par jour
      if (countingData.participants[userId]) {
        await message.reply(
          `🌙 Tu as déjà participé aujourd'hui ! Reviens demain.`
        );

        return;
      }

      const attendu = countingData.count + 1;

      countingData.participants[userId] = true;

      if (nombre === attendu) {
        countingData.count++;

        if (countingData.count > countingData.record) {
          countingData.record = countingData.count;
        }

        sauvegarderCounting();

        await message.react("✅");

        if (nombre % 10 === 0) {
          await message.channel.send(
            `🎉 **${nombre} !** Continuez comme ça ! 🔥`
          );
        }
      } else {
        countingData.count = 0;

        sauvegarderCounting();

        await message.reply(
          `❌ Mauvais nombre !\n\n` +
          `Le nombre attendu était **${attendu}**.\n` +
          `🔄 Le compteur revient à **0**.`
        );
      }

      return;
    }

    // =================================================
    // 🌍 COMMANDES PUBLIQUES
    // =================================================

    // !help
    if (contenu === "!help") {
      return message.reply(
        `🌙 **DreamBot — Commandes**\n\n` +

        `📜 **Informations**\n` +
        `\`!help\` — Afficher les commandes\n` +
        `\`!dream\` — Infos Dream Community\n` +
        `\`!reglement\` — Voir le règlement\n` +
        `\`!serverinfo\` — Infos du serveur\n\n` +

        `⭐ **XP**\n` +
        `\`!rank\` / \`!xp\` — Voir son XP\n` +
        `\`!leaderboard\` / \`!lb\` — Classement XP\n\n` +

        `🔢 **Décompte**\n` +
        `\`!compteur\` — Voir le compteur\n` +
        `\`!record\` — Voir le record\n\n` +

        `💡 **Communauté**\n` +
        `\`!suggest <idée>\` — Faire une suggestion\n` +
        `\`!report @membre raison\` — Signaler un membre\n` +
        `\`!ticket\` — Ouvrir un ticket\n\n` +

        `🛡️ **Modération**\n` +
        `Les commandes de modération sont réservées au staff.`
      );
    }

    // !dream
    if (contenu === "!dream") {
      return message.reply(
        `🌙✨ **Dream Community — Saison 3**\n\n` +
        `Bienvenue dans Dream Community !\n` +
        `Une communauté basée sur l'entraide, les événements et la bonne ambiance. 💫`
      );
    }

    // !reglement
    if (contenu === "!reglement") {
      return message.reply(
        `📜 **Règlement Dream Community**\n\n` +
        `🤝 Respect de tous\n` +
        `🚫 Pas de harcèlement\n` +
        `🚫 Pas de menaces\n` +
        `🚫 Pas d'insultes\n` +
        `🔞 Pas de contenu inapproprié\n` +
        `📢 Pas de spam\n\n` +
        `✨ Merci de respecter la communauté !`
      );
    }

    // !serverinfo
    if (contenu === "!serverinfo") {
      return message.reply(
        `📊 **Informations du serveur**\n\n` +
        `🌙 Serveur : **${message.guild.name}**\n` +
        `👥 Membres : **${message.guild.memberCount}**\n` +
        `💬 Salons : **${message.guild.channels.cache.size}**\n` +
        `🎭 Rôles : **${message.guild.roles.cache.size}**`
      );
    }

    // !suggest
    if (contenu.startsWith("!suggest ")) {
      const suggestion = contenuOriginal.slice(9).trim();

      if (!suggestion) {
        return message.reply(
          `💡 Utilisation : \`!suggest <idée>\``
        );
      }

      const salon = message.guild.channels.cache.find(
        c => c.name === CHANNEL_SUGGESTIONS
      );

      if (!salon) {
        return message.reply(
          `❌ Le salon des suggestions est introuvable.`
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("💡 Nouvelle suggestion")
        .setDescription(suggestion)
        .addFields({
          name: "👤 Auteur",
          value: `${message.author}`
        })
        .setTimestamp();

      await salon.send({
        embeds: [embed]
      });

      return message.reply(
        `✅ Ta suggestion a bien été envoyée ! 💡`
      );
    }

    // !compteur
    if (contenu === "!compteur") {
      return message.reply(
        `🔢 **Compteur actuel : ${countingData.count}**\n` +
        `🎯 Prochain nombre : **${countingData.count + 1}**\n` +
        `🏆 Record : **${countingData.record}**`
      );
    }

    // !record
    if (contenu === "!record") {
      return message.reply(
        `🏆 **Record du décompte : ${countingData.record}** 🔥`
      );
    }

    // !rank / !xp
    if (contenu === "!rank" || contenu === "!xp") {
      const data = obtenirXP(message.author.id);

      return message.reply(
        `⭐ **Ton profil XP**\n\n` +
        `👤 ${message.author}\n` +
        `🏆 Niveau : **${data.niveau}**\n` +
        `✨ XP : **${data.xp}/${xpPourNiveau(data.niveau)}**\n` +
        `⚠️ Avertissements : **${data.avertissements}/3**`
      );
    }

    // !leaderboard / !lb
    if (
      contenu === "!leaderboard" ||
      contenu === "!lb"
    ) {
      const classement = Object.entries(xpData)
        .sort((a, b) => {
          const niveauA = a[1].niveau || 1;
          const niveauB = b[1].niveau || 1;

          if (niveauA !== niveauB) {
            return niveauB - niveauA;
          }

          return (b[1].xp || 0) - (a[1].xp || 0);
        })
        .slice(0, 10);

      if (classement.length === 0) {
        return message.reply(
          `🏆 Le classement est encore vide !`
        );
      }

      let texte = `🏆 **Classement XP Dream Community**\n\n`;

      for (let i = 0; i < classement.length; i++) {
        const [userId, data] = classement[i];

        const membre =
          await message.guild.members
            .fetch(userId)
            .catch(() => null);

        const nom = membre
          ? membre.user.username
          : "Utilisateur";

        texte +=
          `**${i + 1}.** ${nom} — ` +
          `Niveau **${data.niveau}** · ` +
          `${data.xp} XP\n`;
      }

      return message.reply(texte);
    }

    // !report
    if (contenu.startsWith("!report")) {
      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `🚨 Utilisation : \`!report @membre raison\``
        );
      }

      const raison = contenuOriginal
        .replace(/^!report/i, "")
        .replace(`<@${membre.id}>`, "")
        .trim();

      if (!raison) {
        return message.reply(
          `🚨 Indique une raison pour le signalement.`
        );
      }

      const salon = message.guild.channels.cache.find(
        c => c.name === CHANNEL_REPORTS
      );

      if (!salon) {
        return message.reply(
          `❌ Le salon des signalements est introuvable.`
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("🚨 Nouveau signalement")
        .addFields(
          {
            name: "👤 Membre signalé",
            value: `${membre}`
          },
          {
            name: "📨 Signalé par",
            value: `${message.author}`
          },
          {
            name: "📌 Raison",
            value: raison
          }
        )
        .setTimestamp();

      await salon.send({
        embeds: [embed]
      });

      return message.reply(
        `✅ Ton signalement a été transmis à l'équipe.`
      );
    }

    // =================================================
    // 🎫 TICKET
    // =================================================

    if (contenu === "!ticket") {
      const boutons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_admin")
          .setLabel("👑 Devenir Admin")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_site")
          .setLabel("🌐 Site Web")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("ticket_support")
          .setLabel("🛟 Contacter le Support")
          .setStyle(ButtonStyle.Success)
      );

      return message.reply({
        content:
          `🎫 **Centre de tickets Dream Community**\n\n` +
          `Choisis la raison de ton ticket ci-dessous :`,
        components: [boutons]
      });
    }

    // =================================================
    // ⭐ AJOUT XP
    // =================================================

    await ajouterXP(message.member);

    // =================================================
    // 🛡️ COMMANDES STAFF
    // =================================================

    // !warn
    if (contenu.startsWith("!warn")) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          `🛡️ Cette commande est réservée au staff.`
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!warn @membre raison\``
        );
      }

      const raison =
        contenuOriginal
          .replace(/^!warn/i, "")
          .replace(`<@${membre.id}>`, "")
          .trim() ||
        "Aucune raison précisée";

      await ajouterAvertissement(
        membre,
        message.channel,
        raison
      );

      return;
    }

    // !warns
    if (contenu === "!warns") {
      const data = obtenirXP(
        message.mentions.users.first()?.id ||
        message.author.id
      );

      return message.reply(
        `⚠️ Avertissements : **${data.avertissements}/3**`
      );
    }

    // !mute
    if (contenu.startsWith("!mute")) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          `🛡️ Cette commande est réservée au staff.`
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!mute @membre\``
        );
      }

      await membre.timeout(
        60 * 60 * 1000,
        "Mute par la modération"
      );

      return message.reply(
        `🔇 ${membre} a été mute pendant **1 heure**.`
      );
    }

    // !kick
    if (contenu.startsWith("!kick")) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.KickMembers
        )
      ) {
        return message.reply(
          `🛡️ Cette commande est réservée au staff.`
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!kick @membre\``
        );
      }

      await membre.kick("Kick par la modération");

      return message.reply(
        `👢 ${membre.user.tag} a été expulsé du serveur.`
      );
    }

    // !ban
    if (contenu.startsWith("!ban")) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.BanMembers
        )
      ) {
        return message.reply(
          `🛡️ Cette commande est réservée au staff.`
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!ban @membre\``
        );
      }

      await membre.ban({
        reason: "Ban par la modération"
      });

      return message.reply(
        `🚫 ${membre.user.tag} a été banni du serveur.`
      );
    }

  } catch (error) {
    console.error("❌ Erreur messageCreate :", error);
  }
});

// =====================================================
// 🎫 INTERACTIONS DES TICKETS
// =====================================================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton()) return;

    // -----------------------------------------------
    // CRÉATION DU TICKET
    // -----------------------------------------------

    if (
      interaction.customId === "ticket_admin" ||
      interaction.customId === "ticket_site" ||
      interaction.customId === "ticket_support"
    ) {
      await interaction.deferReply({
        ephemeral: true
      });

      let type = "";

      if (interaction.customId === "ticket_admin") {
        type = "👑 Devenir Admin";
      }

      if (interaction.customId === "ticket_site") {
        type = "🌐 Site Web";
      }

      if (interaction.customId === "ticket_support") {
        type = "🛟 Support";
      }

      const nomTicket =
        `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "");

      const categorie =
        interaction.guild.channels.cache.find(
          channel =>
            channel.name === CHANNEL_TICKETS &&
            channel.type === ChannelType.GuildCategory
        );

      const permissions = [
        {
          id: interaction.guild.id,
          deny: [
            PermissionFlagsBits.ViewChannel
          ]
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

      const canal = await interaction.guild.channels.create({
        name: nomTicket,
        type: ChannelType.GuildText,
        parent: categorie?.id,
        permissionOverwrites: permissions
      });

      const fermer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("🔒 Fermer le ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await canal.send({
        content:
          `🎫 **Ticket ouvert par ${interaction.user}**\n\n` +
          `📌 Demande : **${type}**\n\n` +
          `Un membre du staff viendra bientôt te répondre. 🌙`,
        components: [fermer]
      });

      return interaction.editReply({
        content:
          `✅ Ton ticket a été créé : ${canal}`
      });
    }

    // -----------------------------------------------
    // FERMETURE
    // -----------------------------------------------

    if (interaction.customId === "ticket_close") {
      await interaction.reply({
        content: "🔒 Fermeture du ticket...",
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch {}
      }, 1500);
    }

  } catch (error) {
    console.error("❌ Erreur interaction :", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Une erreur est survenue.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =====================================================
// 🌐 SERVEUR WEB POUR RENDER
// =====================================================

app.get("/", (req, res) => {
  res.send("🌙 DreamBot est en ligne !");
});

app.listen(PORT, () => {
  console.log(`🌐 Serveur web lancé sur le port ${PORT}`);
});

// =====================================================
// 🚨 ERREURS
// =====================================================

client.on("error", error => {
  console.error("❌ Discord Client Error :", error);
});

client.on("shardError", error => {
  console.error("❌ Discord Shard Error :", error);
});

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection :", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception :", error);
});

// =====================================================
// 🔑 CONNEXION DISCORD
// =====================================================

client.login(process.env.DISCORD_TOKEN);
