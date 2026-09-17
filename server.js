const express = require("express");
const fs = require("fs");

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

// =====================================================
// 🌙 DREAM COMMUNITY — DREAMBOT
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
// ⚙️ CONFIGURATION
// =====================================================

const CHANNEL_ANNONCES = "📢・𝗔𝗻𝗻𝗼𝗻𝗰𝗲𝘀-𝗢𝗳𝗳𝗶𝗰𝗶𝗲𝗹𝗹𝗲𝘀";
const CHANNEL_TICKETS = "🎫 TICKETS";
const CHANNEL_REPORTS = "🚨・signalements";
const CHANNEL_SUGGESTIONS = "💡・suggestions";
const CHANNEL_DECOMPTE = "🔢・décompte";
const ROLE_AUTOMATIQUE = "Citoyen";

// =====================================================
// 📁 FICHIERS
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
      recordUserId: null,
      participants: {},
      date: ""
    }, null, 2)
  );
}

let xpData = {};

try {
  xpData = JSON.parse(
    fs.readFileSync(XP_FILE, "utf8")
  );
} catch {
  xpData = {};
}

let countingData = {};

try {
  countingData = JSON.parse(
    fs.readFileSync(COUNTING_FILE, "utf8")
  );
} catch {
  countingData = {
    count: 0,
    record: 0,
    recordUserId: null,
    participants: {},
    date: ""
  };
}

// =====================================================
// 💾 SAUVEGARDE
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

// =====================================================
// ⭐ XP
// =====================================================

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

  // Compatibilité avec ancien xp.json
  if (typeof xpData[userId].xp !== "number") {
    xpData[userId].xp = 0;
  }

  if (typeof xpData[userId].niveau !== "number") {
    xpData[userId].niveau = 1;
  }

  if (typeof xpData[userId].avertissements !== "number") {
    xpData[userId].avertissements = 0;
  }

  return xpData[userId];
}

const cooldownXP = new Map();

async function ajouterXP(member) {
  if (!member) return;

  const userId = member.id;
  const maintenant = Date.now();

  if (cooldownXP.has(userId)) {
    const dernierXP = cooldownXP.get(userId);

    if (maintenant - dernierXP < 30000) {
      return;
    }
  }

  cooldownXP.set(userId, maintenant);

  const data = obtenirXP(userId);

  data.xp += 10;

  let niveauMonte = false;

  while (data.xp >= xpPourNiveau(data.niveau)) {
    data.xp -= xpPourNiveau(data.niveau);
    data.niveau++;
    niveauMonte = true;
  }

  sauvegarderXP();

  if (niveauMonte) {
    const salon = member.guild.channels.cache.find(
      channel =>
        channel.name === CHANNEL_ANNONCES &&
        channel.isTextBased()
    );

    if (salon) {
      await salon.send(
        `🎉 Félicitations ${member} ! Tu passes au **niveau ${data.niveau}** ! 🌙✨`
      ).catch(() => {});
    }
  }
}

// =====================================================
// 📅 DATE FRANCE
// =====================================================

function dateFrance() {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function verifierNouveauJour() {
  const aujourdHui = dateFrance();

  if (countingData.date !== aujourdHui) {
    countingData.date = aujourdHui;
    countingData.participants = {};

    sauvegarderCounting();
  }
}

// =====================================================
// ⚠️ AVERTISSEMENTS
// =====================================================

async function ajouterAvertissement(
  membre,
  channel,
  raison = "Aucune raison précisée"
) {
  if (!membre) return;

  const data = obtenirXP(membre.id);

  data.avertissements++;

  sauvegarderXP();

  // 1er avertissement
  if (data.avertissements === 1) {
    await channel.send(
      `⚠️ ${membre} reçoit son **1er avertissement**.\n\n` +
      `📝 **Raison :** ${raison}\n` +
      `📊 **Avertissements : 1/3**`
    ).catch(() => {});

    return;
  }

  // 2e avertissement
  if (data.avertissements === 2) {
    await channel.send(
      `⚠️ ${membre} reçoit son **2e avertissement**.\n\n` +
      `📝 **Raison :** ${raison}\n` +
      `📊 **Avertissements : 2/3**\n\n` +
      `⚠️ Le prochain avertissement entraînera une suspension automatique.`
    ).catch(() => {});

    return;
  }

  // 3e avertissement
  if (data.avertissements >= 3) {
    try {
      await membre.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements - Dream Community"
      );

      await channel.send(
        `⏳ ${membre} atteint **3 avertissements**.\n\n` +
        `📝 **Raison :** ${raison}\n` +
        `📊 **Avertissements : 3/3**\n\n` +
        `🔇 Une suspension Discord de **24 heures** a été appliquée.`
      ).catch(() => {});

    } catch (error) {
      console.error("❌ Impossible d'appliquer le timeout :", error);

      await channel.send(
        `⚠️ ${membre} atteint **3 avertissements**.\n\n` +
        `📊 **3/3**\n` +
        `❌ Je n'ai pas réussi à appliquer automatiquement la suspension.\n\n` +
        `💡 Vérifie que mon rôle est suffisamment haut et possède **Modérer les membres**.`
      ).catch(() => {});
    }
  }
}

// =====================================================
// 🚫 CONTENUS INTERDITS
// =====================================================

// Insultes / vulgarités
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
  "salope",
  "va te faire foutre",
  "ta gueule"
];

// Contenu sexuel / inapproprié
const contenusSexuels = [
  "porn",
  "porno",
  "pornographie",
  "nsfw",
  "nude",
  "nudes",
  "sexting"
];

// Menaces / violence
const menacesViolentes = [
  "je vais te tuer",
  "je vais vous tuer",
  "je vais le tuer",
  "je vais la tuer",
  "je vais les tuer",

  "je vais te frapper",
  "je vais vous frapper",
  "je vais le frapper",
  "je vais la frapper",

  "je vais te faire du mal",
  "je vais vous faire du mal",

  "je vais te décapiter",
  "je vais vous décapiter",
  "je vais le décapiter",
  "je vais la décapiter",

  "je vais te découper",
  "je vais vous découper",
  "je vais le découper",
  "je vais la découper",

  "je vais t'agresser",
  "je vais vous agresser"
];

// Détection d'adresse personnelle
const adresseRegex =
  /\b\d{1,4}\s+(?:rue|avenue|boulevard|chemin|impasse|allée|allee|place|route|square|quai)\s+[A-Za-zÀ-ÿ0-9'’.-]+(?:\s+[A-Za-zÀ-ÿ0-9'’.-]+){0,5}\b/i;

// Détection de numéro de téléphone français
const telephoneRegex =
  /(?<!\d)(?:0[1-9](?:[\s.-]?\d{2}){4}|\+33(?:[\s.-]?[1-9])(?:[\s.-]?\d{2}){4})(?!\d)/;

// Détection d'adresse IP
const ipRegex =
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

// Détection d'informations privées
const infoPriveeRegex =
  /\b(?:mot\s*de\s*passe|password|api[\s_-]?key|clé[\s_-]?api|secret)\b\s*[:=]\s*\S+/i;

// =====================================================
// 🔍 ANALYSE DU CONTENU
// =====================================================

function detecterContenuInterdit(texte) {

  const contenu = texte.toLowerCase();

  // 🚫 Insultes
  const insulte = insultes.find(
    mot => contenu.includes(mot)
  );

  if (insulte) {
    return "Insulte / langage inapproprié";
  }

  // 🔞 Contenu sexuel / inapproprié
  const contenuSexuel = contenusSexuels.find(
    mot => contenu.includes(mot)
  );

  if (contenuSexuel) {
    return "Contenu sexuel / inapproprié";
  }

  // ⚠️ Menaces / violence
  const menace = menacesViolentes.find(
    phrase => contenu.includes(phrase)
  );

  if (menace) {
    return "Menace / contenu violent";
  }

  // 🏠 Adresse personnelle
  if (adresseRegex.test(texte)) {
    return "Adresse personnelle";
  }

  // 📞 Numéro de téléphone
  if (telephoneRegex.test(texte)) {
    return "Numéro de téléphone";
  }

  // 🌐 Adresse IP
  if (ipRegex.test(texte)) {
    return "Adresse IP";
  }

  // 🔐 Information privée
  if (infoPriveeRegex.test(texte)) {
    return "Information privée";
  }

  return null;
}

// =====================================================
// 👋 BIENVENUE + AUTO-RÔLE
// =====================================================

client.on("guildMemberAdd", async member => {
  try {
    const role = member.guild.roles.cache.find(
      role => role.name === ROLE_AUTOMATIQUE
    );

    if (role) {
      await member.roles.add(role).catch(error => {
        console.error(
          "❌ Impossible de donner le rôle Citoyen :",
          error.message
        );
      });
    }

    const salon = member.guild.channels.cache.find(
      channel =>
        channel.name === CHANNEL_ANNONCES &&
        channel.isTextBased()
    );

    if (!salon) return;

    const embed = new EmbedBuilder()
      .setTitle("🌙 Bienvenue dans Dream Community !")
      .setDescription(
        `👋 Bienvenue ${member} !\n\n` +
        `Nous sommes très heureux de t'accueillir parmi nous. ✨\n\n` +
        `🤝 Découvre la communauté\n` +
        `💫 Participe aux événements\n` +
        `🌙 Profite de ton aventure Dream Community !\n\n` +
        `📜 Pense à consulter le règlement.`
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await salon.send({
      embeds: [embed]
    });

  } catch (error) {
    console.error("❌ Erreur bienvenue :", error);
  }
});

// =====================================================
// 🤖 BOT PRÊT
// =====================================================

client.once("clientReady", () => {
  console.log("=================================");
  console.log(`🌙 ${client.user.tag} est connecté !`);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
  console.log("=================================");

  client.user.setActivity(
    "Dream Community 🌙",
    {
      type: 3
    }
  );
});

// =====================================================
// 💬 MESSAGES
// =====================================================

client.on("messageCreate", async message => {

  try {

    if (message.author.bot) return;
    if (!message.guild) return;

    const contenuOriginal = message.content.trim();
    const contenu = contenuOriginal.toLowerCase();

    // =================================================
    // 🚫 CONTENUS INTERDITS
    // =================================================

    const contenuInterdit =
      detecterContenuInterdit(contenuOriginal);

    if (contenuInterdit) {

      await message.delete().catch(() => {});

      await ajouterAvertissement(
        message.member,
        message.channel,
        contenuInterdit
      );

      return;
    }

    // =================================================
    // 🔢 DÉCOMPTE
    // =================================================

    verifierNouveauJour();

    if (message.channel.name === CHANNEL_DECOMPTE) {

      const nombre = Number(
        message.content.trim()
      );

      if (!Number.isInteger(nombre)) {
        return;
      }

      const userId = message.author.id;

      if (countingData.participants[userId]) {

        await message.reply(
          "🌙 Tu as déjà participé aujourd'hui ! Reviens demain."
        ).catch(() => {});

        return;
      }

      const attendu =
        countingData.count + 1;

      countingData.participants[userId] = true;

      if (nombre === attendu) {

        countingData.count++;

        if (
          countingData.count >
          countingData.record
        ) {
          countingData.record =
            countingData.count;

          countingData.recordUserId =
            userId;
        }

        sauvegarderCounting();

        await message.react("✅")
          .catch(() => {});

      } else {

        countingData.count = 0;

        sauvegarderCounting();

        await message.reply(
          `❌ Mauvais nombre !\n\n` +
          `Le nombre attendu était **${attendu}**.\n` +
          `🔄 Le compteur revient à **0**.`
        ).catch(() => {});
      }

      return;
    }

    // =================================================
    // ⭐ XP
    // =================================================

    await ajouterXP(message.member);

    // =================================================
    // 🌍 COMMANDES PUBLIQUES
    // =================================================

    // !help
    if (contenu === "!help") {

      return message.reply(
        `🌙 **DreamBot — Commandes**\n\n` +

        `📜 **Informations**\n` +
        `\`!help\` — Commandes\n` +
        `\`!dream\` — Dream Community\n` +
        `\`!reglement\` — Règlement\n` +
        `\`!serverinfo\` — Infos serveur\n\n` +

        `⭐ **XP**\n` +
        `\`!rank\` / \`!xp\` — Ton XP\n` +
        `\`!leaderboard\` / \`!lb\` — Classement\n\n` +

        `🔢 **Décompte**\n` +
        `\`!compteur\` — Compteur\n` +
        `\`!record\` — Record\n\n` +

        `💡 **Communauté**\n` +
        `\`!suggest <idée>\` — Suggestion\n` +
        `\`!report @membre raison\` — Signalement\n` +
        `\`!ticket\` — Ouvrir un ticket\n\n` +

        `🛡️ **Staff**\n` +
        `\`!warn\` • \`!mute\` • \`!kick\` • \`!ban\`\n` +
        `🔒 Ces commandes sont réservées au staff.`
      );
    }

    // !dream
    if (contenu === "!dream") {

      return message.reply(
        `🌙✨ **Dream Community — Saison 3**\n\n` +
        `Bienvenue dans Dream Community !\n` +
        `💫 Une communauté basée sur l'entraide, les événements et la bonne ambiance.`
      );
    }

    // !reglement
    if (contenu === "!reglement") {

      return message.reply(
        `📜 **Règlement Dream Community**\n\n` +
        `🤝 Respect\n` +
        `🚫 Pas de harcèlement\n` +
        `🚫 Pas de menaces\n` +
        `🚫 Pas d'insultes\n` +
        `🔞 Pas de contenu inapproprié\n` +
        `🏠 Pas de partage d'informations personnelles\n` +
        `📢 Pas de spam\n\n` +
        `🌙 Merci de respecter Dream Community !`
      );
    }

    // !serverinfo
    if (contenu === "!serverinfo") {

      return message.reply(
        `📊 **Informations du serveur**\n\n` +
        `🌙 Nom : **${message.guild.name}**\n` +
        `👥 Membres : **${message.guild.memberCount}**\n` +
        `💬 Salons : **${message.guild.channels.cache.size}**\n` +
        `🎭 Rôles : **${message.guild.roles.cache.size}**`
      );
    }

    // !suggest
    if (
      contenu === "!suggest" ||
      contenu.startsWith("!suggest ")
    ) {

      const suggestion =
        contenuOriginal
          .slice(8)
          .trim();

      if (!suggestion) {
        return message.reply(
          `💡 Utilisation : \`!suggest <idée>\``
        );
      }

      const salon =
        message.guild.channels.cache.find(
          channel =>
            channel.name === CHANNEL_SUGGESTIONS &&
            channel.isTextBased()
        );

      if (!salon) {
        return message.reply(
          `❌ Le salon ${CHANNEL_SUGGESTIONS} est introuvable.`
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

      const msg = await salon.send({
        embeds: [embed]
      });

      await msg.react("👍").catch(() => {});
      await msg.react("👎").catch(() => {});

      return message.reply(
        `✅ Ta suggestion a été envoyée dans ${salon} ! 💡`
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
    if (
      contenu === "!rank" ||
      contenu === "!xp"
    ) {

      const data =
        obtenirXP(message.author.id);

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

      const classement =
        Object.entries(xpData)
          .sort((a, b) => {

            const niveauA =
              a[1].niveau || 1;

            const niveauB =
              b[1].niveau || 1;

            if (niveauA !== niveauB) {
              return niveauB - niveauA;
            }

            return (
              (b[1].xp || 0) -
              (a[1].xp || 0)
            );
          })
          .slice(0, 10);

      if (classement.length === 0) {
        return message.reply(
          "🏆 Le classement est encore vide !"
        );
      }

      let texteClassement =
        "🏆 **Classement XP Dream Community**\n\n";

      for (
        let i = 0;
        i < classement.length;
        i++
      ) {

        const [userId, data] =
          classement[i];

        const membre =
          await message.guild.members
            .fetch(userId)
            .catch(() => null);

        const nom =
          membre
            ? membre.user.username
            : "Utilisateur";

        texteClassement +=
          `**${i + 1}.** ${nom} — ` +
          `Niveau **${data.niveau}** · ` +
          `${data.xp} XP\n`;
      }

      return message.reply(
        texteClassement
      );
    }

    // !report
    if (
      contenu === "!report" ||
      contenu.startsWith("!report ")
    ) {

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `🚨 Utilisation : \`!report @membre raison\``
        );
      }

      const raison =
        contenuOriginal
          .replace(/^!report\s*/i, "")
          .replace(/<@!?\d+>/, "")
          .trim();

      if (!raison) {
        return message.reply(
          "🚨 Indique une raison."
        );
      }

      const salon =
        message.guild.channels.cache.find(
          channel =>
            channel.name === CHANNEL_REPORTS &&
            channel.isTextBased()
        );

      if (!salon) {
        return message.reply(
          `❌ Le salon ${CHANNEL_REPORTS} est introuvable.`
        );
      }

      const embed =
        new EmbedBuilder()
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
              name: "📝 Raison",
              value: raison
            }
          )
          .setTimestamp();

      await salon.send({
        embeds: [embed]
      });

      return message.reply(
        "✅ Ton signalement a été transmis au staff."
      );
    }

    // !warns
    // IMPORTANT : AVANT !warn
    if (contenu === "!warns") {

      const data =
        obtenirXP(message.author.id);

      return message.reply(
        `⚠️ **Tes avertissements**\n\n` +
        `📊 Total : **${data.avertissements}/3**`
      );
    }

    // =================================================
    // 🛡️ COMMANDES STAFF
    // =================================================

    // !warn
    if (
      contenu === "!warn" ||
      contenu.startsWith("!warn ")
    ) {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          "🛡️ Cette commande est réservée au staff."
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
          .replace(/^!warn\s*/i, "")
          .replace(/<@!?\d+>/, "")
          .trim() ||
          "Aucune raison précisée";

      await ajouterAvertissement(
        membre,
        message.channel,
        raison
      );

      return;
    }

    // !mute
    if (
      contenu === "!mute" ||
      contenu.startsWith("!mute ")
    ) {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          "🛡️ Cette commande est réservée au staff."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!mute @membre\``
        );
      }

      try {

        await membre.timeout(
          60 * 60 * 1000,
          "Mute par la modération"
        );

        return message.reply(
          `🔇 ${membre} a été mute pendant **1 heure**.`
        );

      } catch (error) {

        console.error(error);

        return message.reply(
          `❌ Impossible de mute ${membre}.\n` +
          `Vérifie que mon rôle est suffisamment haut et que j'ai **Modérer les membres**.`
        );
      }
    }

    // !kick
    if (
      contenu === "!kick" ||
      contenu.startsWith("!kick ")
    ) {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.KickMembers
        )
      ) {
        return message.reply(
          "🛡️ Cette commande est réservée au staff."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!kick @membre\``
        );
      }

      try {

        const nom =
          membre.user.tag;

        await membre.kick(
          "Kick par la modération"
        );

        return message.reply(
          `👢 **${nom}** a été expulsé du serveur.`
        );

      } catch (error) {

        console.error(error);

        return message.reply(
          "❌ Impossible d'expulser ce membre. Vérifie la hiérarchie des rôles."
        );
      }
    }

    // !ban
    if (
      contenu === "!ban" ||
      contenu.startsWith("!ban ")
    ) {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.BanMembers
        )
      ) {
        return message.reply(
          "🛡️ Cette commande est réservée au staff."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          `⚠️ Utilisation : \`!ban @membre\``
        );
      }

      try {

        const nom =
          membre.user.tag;

        await membre.ban({
          reason: "Ban par la modération"
        });

        return message.reply(
          `🚫 **${nom}** a été banni du serveur.`
        );

      } catch (error) {

        console.error(error);

        return message.reply(
          "❌ Impossible de bannir ce membre. Vérifie la hiérarchie des rôles."
        );
      }
    }

  } catch (error) {

    console.error(
      "❌ Erreur messageCreate :",
      error
    );
  }
});

// =====================================================
// 🎫 TICKETS
// =====================================================

client.on("interactionCreate", async interaction => {

  try {

    if (!interaction.isButton()) return;

    // =================================================
    // 🎫 OUVERTURE
    // =================================================

    if (
      interaction.customId === "ticket_admin" ||
      interaction.customId === "ticket_site" ||
      interaction.customId === "ticket_support"
    ) {

      await interaction.deferReply({
        ephemeral: true
      });

      let type;

      if (
        interaction.customId === "ticket_admin"
      ) {
        type = "👑 Devenir Admin";
      }

      if (
        interaction.customId === "ticket_site"
      ) {
        type = "🌐 Site Web";
      }

      if (
        interaction.customId === "ticket_support"
      ) {
        type = "🛟 Support";
      }

      const categorie =
        interaction.guild.channels.cache.find(
          channel =>
            channel.name === CHANNEL_TICKETS &&
            channel.type === ChannelType.GuildCategory
        );

      const staffRole =
        interaction.guild.roles.cache.find(
          role =>
            role.name.toLowerCase() === "staff"
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

      if (staffRole) {
        permissions.push({
          id: staffRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      const nom =
        `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 80);

      const canal =
        await interaction.guild.channels.create({
          name: nom,
          type: ChannelType.GuildText,
          parent: categorie?.id,
          permissionOverwrites: permissions
        });

      const bouton =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("🔒 Fermer le ticket")
            .setStyle(ButtonStyle.Danger)
        );

      await canal.send({
        content:
          `🎫 **Ticket de ${interaction.user}**\n\n` +
          `📌 Demande : **${type}**\n\n` +
          `🛡️ Le staff arrivera bientôt.\n` +
          `🌙 Merci de patienter !`,
        components: [bouton]
      });

      return interaction.editReply({
        content:
          `✅ Ton ticket a été créé : ${canal}`
      });
    }

    // =================================================
    // 🔒 FERMETURE
    // =================================================

    if (
      interaction.customId === "ticket_close"
    ) {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageChannels
        )
      ) {
        return interaction.reply({
          content:
            "🛡️ Seul le staff peut fermer ce ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Fermeture du ticket..."
      );

      setTimeout(async () => {

        await interaction.channel
          .delete()
          .catch(() => {});

      }, 1500);
    }

  } catch (error) {

    console.error(
      "❌ Erreur interaction :",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          "❌ Une erreur est survenue.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =====================================================
// 🌐 SERVEUR RENDER
// =====================================================

app.get("/", (req, res) => {
  res.send("🌙 DreamBot est en ligne !");
});

app.listen(PORT, () => {
  console.log(
    `🌐 Serveur web lancé sur le port ${PORT}`
  );
});

// =====================================================
// 🚨 ERREURS
// =====================================================

client.on("error", error => {
  console.error(
    "❌ Discord Client Error :",
    error
  );
});

client.on("shardError", error => {
  console.error(
    "❌ Discord Shard Error :",
    error
  );
});

process.on("unhandledRejection", error => {
  console.error(
    "❌ Unhandled Rejection :",
    error
  );
});

process.on("uncaughtException", error => {
  console.error(
    "❌ Uncaught Exception :",
    error
  );
});

// =====================================================
// 🔑 CONNEXION
// =====================================================

client.login(
  process.env.DISCORD_TOKEN
);
