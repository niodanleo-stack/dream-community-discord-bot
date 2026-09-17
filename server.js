const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const express = require("express");
const fs = require("fs");

// ==================================================
// ⚙️ CONFIGURATION
// ==================================================

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 10000;

const app = express();

app.get("/", (req, res) => {
  res.send("🌙 DreamBot est en ligne !");
});

app.listen(PORT, () => {
  console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

// ==================================================
// 🤖 CLIENT DISCORD
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ==================================================
// 💾 FICHIERS
// ==================================================

const XP_FILE = "./xp.json";
const COUNTING_FILE = "./counting.json";

function chargerJSON(fichier, valeurParDefaut) {
  try {
    if (!fs.existsSync(fichier)) {
      fs.writeFileSync(
        fichier,
        JSON.stringify(valeurParDefaut, null, 2)
      );
      return valeurParDefaut;
    }

    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (error) {
    console.error(`Erreur lecture ${fichier}:`, error);
    return valeurParDefaut;
  }
}

function sauvegarderJSON(fichier, data) {
  try {
    fs.writeFileSync(
      fichier,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error(`Erreur sauvegarde ${fichier}:`, error);
  }
}

let xpData = chargerJSON(XP_FILE, {});
let countingData = chargerJSON(COUNTING_FILE, {
  count: 0,
  record: 0,
  participants: {}
});

// ==================================================
// 🛡️ MODÉRATION AUTOMATIQUE
// ==================================================

const insultes = [
  "connard",
  "connasse",
  "pute",
  "putain",
  "fdp",
  "ntm",
  "tg",
  "encule",
  "enculé",
  "salope",
  "va te faire foutre",
  "ta gueule"
];

const contenusSexuels = [
  "porn",
  "porno",
  "pornographie",
  "nsfw",
  "nude",
  "nudes",
  "sexting"
];

const menacesViolentes = [
  "je vais te tuer",
  "je vais vous tuer",
  "je vais le tuer",
  "je vais la tuer",
  "je vais les tuer",
  "je vais te decapiter",
  "je vais vous decapiter",
  "je vais le decapiter",
  "je vais la decapiter",
  "je vais te decouper",
  "je vais vous decouper",
  "je vais t'agresser",
  "je vais vous agresser",
  "je vais te frapper",
  "je vais vous frapper"
];

const adresseRegex =
  /\b\d{1,4}\s+(?:rue|avenue|boulevard|chemin|impasse|allee|allée|place|route|square|quai)\s+[A-Za-zÀ-ÿ0-9'’.-]+(?:\s+[A-Za-zÀ-ÿ0-9'’.-]+){0,5}\b/i;

const telephoneRegex =
  /(?<!\d)(?:0[1-9](?:[\s.-]?\d{2}){4}|\+33(?:[\s.-]?[1-9])(?:[\s.-]?\d{2}){4})(?!\d)/;

const ipRegex =
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

const infoPriveeRegex =
  /\b(?:mot\s*de\s*passe|password|api[\s_-]?key|clé[\s_-]?api|secret)\b\s*[:=]\s*\S+/i;

function detecterContenuInterdit(contenu) {
  const texte = contenu.toLowerCase();

  if (
    insultes.some((mot) =>
      texte.includes(mot.toLowerCase())
    )
  ) {
    return "Insulte / langage inapproprié";
  }

  if (
    contenusSexuels.some((mot) =>
      texte.includes(mot.toLowerCase())
    )
  ) {
    return "Contenu sexuel / inapproprié";
  }

  if (
    menacesViolentes.some((mot) =>
      texte.includes(mot.toLowerCase())
    )
  ) {
    return "Menace / contenu violent";
  }

  if (adresseRegex.test(contenu)) {
    return "Adresse personnelle";
  }

  if (telephoneRegex.test(contenu)) {
    return "Numéro de téléphone";
  }

  if (ipRegex.test(contenu)) {
    return "Adresse IP";
  }

  if (infoPriveeRegex.test(contenu)) {
    return "Information privée";
  }

  return null;
}

// ==================================================
// ⭐ XP
// ==================================================

const cooldownXP = new Map();

function xpPourNiveau(niveau) {
  return 100 + 50 * (niveau - 1);
}

function obtenirUtilisateurXP(userId) {
  if (!xpData[userId]) {
    xpData[userId] = {
      xp: 0,
      niveau: 1,
      warns: []
    };
  }

  if (!Array.isArray(xpData[userId].warns)) {
    xpData[userId].warns = [];
  }

  return xpData[userId];
}

async function ajouterXP(message) {
  if (!message.guild) return;

  const maintenant = Date.now();
  const dernier = cooldownXP.get(message.author.id) || 0;

  if (maintenant - dernier < 30000) {
    return;
  }

  cooldownXP.set(message.author.id, maintenant);

  const utilisateur = obtenirUtilisateurXP(
    message.author.id
  );

  utilisateur.xp += 10;

  let niveauMonte = false;

  while (
    utilisateur.xp >= xpPourNiveau(utilisateur.niveau)
  ) {
    utilisateur.xp -= xpPourNiveau(utilisateur.niveau);
    utilisateur.niveau++;
    niveauMonte = true;
  }

  sauvegarderJSON(XP_FILE, xpData);

  if (niveauMonte) {
    await message.channel.send(
      `🎉 Félicitations ${message.author} ! Tu viens de passer **niveau ${utilisateur.niveau}** ! ⭐`
    );
  }
}

// ==================================================
// ⚠️ AVERTISSEMENTS
// ==================================================

async function ajouterAvertissement(
  membre,
  raison,
  message
) {
  const utilisateur = obtenirUtilisateurXP(
    membre.id
  );

  utilisateur.warns.push({
    raison: raison || "Aucune raison",
    date: new Date().toISOString()
  });

  sauvegarderJSON(XP_FILE, xpData);

  const nombre = utilisateur.warns.length;

  if (nombre >= 3) {
    try {
      await membre.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements"
      );

      await message.channel.send(
        `🔇 ${membre} a reçu son **3ᵉ avertissement** et est temporairement restreint pendant **24 heures**.`
      );
    } catch (error) {
      console.error("Erreur timeout:", error);
    }
  } else {
    await message.channel.send(
      `⚠️ ${membre} reçoit un avertissement (**${nombre}/3**).\n` +
      `📝 Raison : ${raison || "Aucune raison"}`
    );
  }
}

// ==================================================
// 🔢 DÉCOMPTE
// ==================================================

function dateFrance() {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function resetParticipantsSiNecessaire() {
  const aujourdHui = dateFrance();

  if (countingData.date !== aujourdHui) {
    countingData.date = aujourdHui;
    countingData.participants = {};
    sauvegarderJSON(
      COUNTING_FILE,
      countingData
    );
  }
}

// ==================================================
// 🎫 TICKETS
// ==================================================

function obtenirRoleStaff(guild) {
  return guild.roles.cache.find(
    (role) =>
      role.name.toLowerCase() === "staff"
  );
}

function estStaff(membre) {
  if (!membre) return false;

  return (
    membre.permissions.has(
      PermissionsBitField.Flags.Administrator
    ) ||
    membre.roles.cache.some(
      (role) =>
        role.name.toLowerCase() === "staff"
    )
  );
}

async function creerTicket(
  interaction,
  type
) {
  const guild = interaction.guild;
  const membre = interaction.member;

  const categorie = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory &&
      channel.name === "🎫 TICKETS"
  );

  const staffRole = obtenirRoleStaff(guild);

  const nom =
    `ticket-${membre.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 80);

  const dejaExiste = guild.channels.cache.find(
    (channel) =>
      channel.name === nom &&
      channel.parentId === categorie?.id
  );

  if (dejaExiste) {
    return interaction.reply({
      content:
        `🎫 Tu as déjà un ticket ouvert : ${dejaExiste}`,
      ephemeral: true
    });
  }

  const overwrites = [
    {
      id: guild.id,
      deny: [
        PermissionsBitField.Flags.ViewChannel
      ]
    },
    {
      id: membre.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    }
  ];

  if (staffRole) {
    overwrites.push({
      id: staffRole.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    });
  }

  const channel = await guild.channels.create({
    name: nom,
    type: ChannelType.GuildText,
    parent: categorie?.id,
    permissionOverwrites: overwrites
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎫 Ticket ouvert")
    .setDescription(
      `Bienvenue ${membre} !\n\n` +
      `📌 Type : **${type}**\n\n` +
      `Explique clairement ta demande. ` +
      `Un membre du staff viendra te répondre.`
    )
    .setFooter({
      text: "Dream Community — Saison 3"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Fermer le ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${membre}${staffRole ? ` ${staffRole}` : ""}`,
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: `🎫 Ton ticket a été créé : ${channel}`,
    ephemeral: true
  });
}

// ==================================================
// 🤖 RÉPONSES AUX QUESTIONS
// ==================================================

async function repondreQuestion(question, message) {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // 👋 SALUTATIONS

  if (
    /^(salut|slt|bonjour|bonsoir|hello|hey|yo|coucou|cc|wesh|bjr)\b/.test(q) ||
    q.includes("ca va") ||
    q.includes("comment vas tu") ||
    q.includes("comment tu vas")
  ) {
    return message.reply(
      "🌙 Salut ! 😄\n\n" +
      "Je suis **DreamBot**, le bot officiel de Dream Community ! 🤖\n" +
      "Tu peux me poser une question ou utiliser `!help`."
    );
  }

  // 🤖 IDENTITÉ

  if (
    q.includes("qui es tu") ||
    q.includes("t'es qui") ||
    q.includes("tu es qui") ||
    q.includes("qui est tu") ||
    q.includes("presente toi") ||
    q.includes("ton nom") ||
    q.includes("comment tu t'appelle") ||
    q.includes("comment tu t appelles")
  ) {
    return message.reply(
      "🤖 Je suis **DreamBot#1863** !\n\n" +
      "🌙 Le bot officiel de **Dream Community — Saison 3**.\n\n" +
      "🎫 Tickets\n" +
      "🛡️ Modération\n" +
      "⭐ XP et niveaux\n" +
      "🔢 Décompte\n" +
      "💡 Suggestions\n" +
      "📊 Informations\n" +
      "🆘 Assistance"
    );
  }

  // 🌙 DREAM COMMUNITY

  if (
    q.includes("c'est quoi dream community") ||
    q.includes("c quoi dream community") ||
    q.includes("quest ce que dream community") ||
    q.includes("qu'est ce que dream community") ||
    q.includes("parle moi de dream community") ||
    q.includes("dream community c'est quoi") ||
    q === "dream community"
  ) {
    return message.reply(
      "🌙 **Dream Community — Saison 3**\n\n" +
      "Une communauté basée sur les discussions, " +
      "les événements, les échanges et différents systèmes communautaires. ✨\n\n" +
      "🎫 Tickets\n" +
      "🎉 Événements\n" +
      "⭐ XP\n" +
      "🔢 Décompte\n" +
      "💡 Suggestions\n" +
      "🛡️ Modération"
    );
  }

  // 🎫 TICKETS

  if (
    q.includes("ticket") ||
    q.includes("ouvrir un ticket") ||
    q.includes("creer un ticket") ||
    q.includes("contacter le staff") ||
    q.includes("besoin du staff") ||
    q.includes("besoin d'un admin") ||
    q.includes("besoin dun admin")
  ) {
    return message.reply(
      "🎫 **Pour ouvrir un ticket :**\n\n" +
      "Utilise `!ticket`.\n\n" +
      "Tu pourras choisir :\n" +
      "👑 Devenir Admin\n" +
      "🌐 Site Web\n" +
      "🛟 Support\n\n" +
      "Un salon privé sera ensuite créé."
    );
  }

  // 🛟 SUPPORT

  if (
    q.includes("support") ||
    q.includes("aide moi") ||
    q.includes("aide-moi") ||
    q.includes("besoin d'aide") ||
    q.includes("probleme") ||
    q.includes("problème")
  ) {
    return message.reply(
      "🛟 **Besoin d'aide ?**\n\n" +
      "Ouvre un ticket avec `!ticket` et explique ton problème au staff."
    );
  }

  // 📜 RÈGLEMENT

  if (
    q.includes("reglement") ||
    q.includes("regles") ||
    q.includes("lois") ||
    q.includes("que faut il respecter") ||
    q.includes("qu'est ce qui est interdit") ||
    q.includes("c'est quoi les regles")
  ) {
    return message.reply(
      "📜 **Règlement Dream Community**\n\n" +
      "🤝 Respect des membres\n" +
      "🚫 Pas de harcèlement\n" +
      "🚫 Pas de menaces\n" +
      "🚫 Pas d'insultes répétées\n" +
      "🚫 Pas de contenu inapproprié\n" +
      "🚫 Pas de spam\n" +
      "🔒 Respect de la vie privée\n" +
      "👮 Respect du staff\n\n" +
      "📖 Règlement complet : `!reglement`"
    );
  }

  // ⭐ XP

  if (
    q.includes("xp") ||
    q.includes("experience") ||
    q.includes("niveau") ||
    q.includes("level") ||
    q.includes("comment gagner") ||
    q.includes("comment monter")
  ) {
    return message.reply(
      "⭐ **Système XP**\n\n" +
      "💬 Tu gagnes de l'XP en participant aux discussions.\n" +
      "⏱️ Un délai de 30 secondes est appliqué entre les gains.\n" +
      "📈 Ton XP te permet de monter de niveau.\n\n" +
      "`!rank` → ton niveau\n" +
      "`!xp` → ton XP\n" +
      "`!leaderboard` → classement\n" +
      "`!lb` → classement"
    );
  }

  // 🏆 CLASSEMENT

  if (
    q.includes("classement") ||
    q.includes("leaderboard") ||
    q.includes("qui a le plus d xp") ||
    q.includes("qui a le plus de xp") ||
    q.includes("top xp")
  ) {
    return message.reply(
      "🏆 **Classement XP**\n\n" +
      "Utilise `!leaderboard` ou `!lb` pour voir le classement."
    );
  }

  // 🔢 DÉCOMPTE

  if (
    q.includes("decompte") ||
    q.includes("compteur") ||
    q.includes("compter") ||
    q.includes("comment fonctionne le compteur") ||
    q.includes("record du compteur")
  ) {
    return message.reply(
      "🔢 **Décompte**\n\n" +
      "Le but est de compter ensemble : **1 → 2 → 3 → 4...** ♾️\n\n" +
      "❌ Un mauvais nombre remet le compteur à 0.\n" +
      "👤 Une participation par personne et par jour.\n\n" +
      "`!compteur` → compteur actuel\n" +
      "`!record` → record"
    );
  }

  // 💡 SUGGESTIONS

  if (
    q.includes("suggestion") ||
    q.includes("suggerer") ||
    q.includes("idee") ||
    q.includes("proposer une idee") ||
    q.includes("proposer quelque chose")
  ) {
    return message.reply(
      "💡 **Suggestions**\n\n" +
      "Utilise :\n" +
      "`!suggest <ton idée>`\n\n" +
      "Les membres pourront voter avec 👍 ou 👎."
    );
  }

  // 👮 STAFF

  if (
    q.includes("staff") ||
    q.includes("admin") ||
    q.includes("administrateur") ||
    q.includes("moderateur") ||
    q.includes("equipe") ||
    q.includes("équipe")
  ) {
    return message.reply(
      "👮 **Le staff**\n\n" +
      "L'équipe est là pour aider les membres, " +
      "gérer les problèmes et assurer le bon fonctionnement du serveur. 🛡️\n\n" +
      "Pour contacter le staff : `!ticket`"
    );
  }

  // 🛠️ COMMANDES

  if (
    q.includes("commande") ||
    q.includes("commandes") ||
    q.includes("que peux tu faire") ||
    q.includes("tu peux faire quoi") ||
    q.includes("quelles commandes") ||
    q.includes("liste des commandes") ||
    q === "help"
  ) {
    return message.reply(
      "🆘 **Commandes DreamBot**\n\n" +
      "🌙 `!dream`\n" +
      "📜 `!reglement`\n" +
      "📊 `!serverinfo`\n" +
      "⭐ `!rank` / `!xp`\n" +
      "🏆 `!leaderboard` / `!lb`\n" +
      "⚠️ `!warns`\n" +
      "🎫 `!ticket`\n" +
      "💡 `!suggest <idée>`\n" +
      "🚨 `!report @membre <raison>`\n" +
      "🔢 `!compteur`\n" +
      "🏆 `!record`\n\n" +
      "🛡️ Les commandes de modération sont réservées au staff."
    );
  }

  // 📊 SERVEUR

  if (
    q.includes("combien de membres") ||
    q.includes("nombre de membres") ||
    q.includes("infos du serveur") ||
    q.includes("information du serveur") ||
    q === "serveur"
  ) {
    return message.reply(
      `📊 **Informations du serveur**\n\n` +
      `🌙 Nom : **${message.guild.name}**\n` +
      `👥 Membres : **${message.guild.memberCount}**`
    );
  }

  // 🚨 SIGNALER

  if (
    q.includes("signaler") ||
    q.includes("signalement") ||
    q.includes("report")
  ) {
    return message.reply(
      "🚨 **Signaler un membre**\n\n" +
      "Utilise :\n" +
      "`!report @membre <raison>`\n\n" +
      "Le signalement sera transmis au staff."
    );
  }

  // ⚠️ WARNS

  if (
    q.includes("avertissement") ||
    q.includes("avertissements") ||
    q.includes("warn") ||
    q.includes("mes warns") ||
    q.includes("combien de warns")
  ) {
    return message.reply(
      "⚠️ Pour voir tes avertissements, utilise :\n\n" +
      "`!warns`"
    );
  }

  // 🌐 SITE

  if (
    q.includes("site") ||
    q.includes("site web") ||
    q.includes("site internet") ||
    q.includes("lien du site")
  ) {
    return message.reply(
      "🌐 **Site Web**\n\n" +
      "Utilise `!ticket`, puis sélectionne **🌐 Site Web**."
    );
  }

  // 👑 DEVENIR ADMIN

  if (
    q.includes("devenir admin") ||
    q.includes("devenir administrateur") ||
    q.includes("rejoindre le staff") ||
    q.includes("candidature staff")
  ) {
    return message.reply(
      "👑 **Devenir Admin**\n\n" +
      "Utilise `!ticket` puis sélectionne **👑 Devenir Admin**.\n\n" +
      "Le staff pourra ensuite t'expliquer la procédure."
    );
  }

  // ❤️ MERCI

  if (
    q.includes("merci") ||
    q.includes("mercii") ||
    q.includes("thanks")
  ) {
    return message.reply(
      "🌙 Avec plaisir ! 😄✨"
    );
  }

  // 🌙 BONNE NUIT

  if (
    q.includes("bonne nuit") ||
    q.includes("je vais dormir") ||
    q.includes("vais dormir")
  ) {
    return message.reply(
      "🌙 Bonne nuit ! 😴✨\n" +
      "À bientôt sur Dream Community !"
    );
  }

  // 👋 AU REVOIR

  if (
    q.includes("au revoir") ||
    q.includes("aurevoir") ||
    q.includes("bye") ||
    q.includes("ciao")
  ) {
    return message.reply(
      "👋 À bientôt sur **Dream Community** ! 🌙"
    );
  }

  // 🤖 QUESTIONS SUR LE BOT

  if (
    q.includes("tu dors") ||
    q.includes("tu es vivant") ||
    q.includes("tu es une ia") ||
    q.includes("tu es un robot") ||
    q.includes("tu es humain")
  ) {
    return message.reply(
      "🤖 Je suis un bot Discord ! 😂\n\n" +
      "Je suis là pour aider les membres de Dream Community. 🌙"
    );
  }

  // ❓ QUESTION VIDE

  if (!q || q.length < 2) {
    return message.reply(
      "🤖 Oui ? 😄\n\n" +
      "Pose-moi directement ta question !"
    );
  }

  // 🤖 RÉPONSE INCONNUE

  return message.reply(
    "🤖 Je n'ai pas encore la réponse exacte à cette question. 😅\n\n" +
    "Tu peux me demander quelque chose concernant :\n" +
    "🎫 Tickets\n" +
    "📜 Règlement\n" +
    "⭐ XP / niveaux\n" +
    "🏆 Classement\n" +
    "🔢 Décompte\n" +
    "💡 Suggestions\n" +
    "👮 Staff\n" +
    "🛠️ Commandes\n" +
    "🌐 Site Web\n\n" +
    "Ou utilise `!help`."
  );
}

// ==================================================
// 👑 PRÊT
// ==================================================

client.once("clientReady", () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  client.user.setActivity(
    "Dream Community 🌙",
    {
      type: 3
    }
  );
});

// ==================================================
// 👋 BIENVENUE
// ==================================================

client.on("guildMemberAdd", async (membre) => {
  try {
    const role = membre.guild.roles.cache.find(
      (r) => r.name === "Citoyen"
    );

    if (role) {
      await membre.roles.add(role);
    }

    const channel =
      membre.guild.channels.cache.find(
        (c) =>
          c.name === "📢・𝗔𝗻𝗻𝗼𝗻𝗰𝗲𝘀-𝗢𝗳𝗳𝗶𝗰𝗶𝗲𝗹𝗹𝗲𝘀"
      );

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🌙 Bienvenue sur Dream Community !")
      .setDescription(
        `Bienvenue ${membre} ! 🎉\n\n` +
        `Tu viens de rejoindre **Dream Community — Saison 3** !\n\n` +
        `📜 Pense à lire le règlement.\n` +
        `💬 N'hésite pas à participer.\n` +
        `🎉 Profite des événements !`
      )
      .setThumbnail(
        membre.user.displayAvatarURL({
          extension: "png",
          size: 256
        })
      );

    await channel.send({
      embeds: [embed]
    });
  } catch (error) {
    console.error(
      "Erreur bienvenue :",
      error
    );
  }
});

// ==================================================
// 🎮 MESSAGES
// ==================================================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const contenuOriginal = message.content;
    const contenu = contenuOriginal
      .trim()
      .toLowerCase();

    // ==================================================
    // 🤖 MENTION DU BOT
    // ==================================================

    if (
      client.user &&
      message.mentions.has(client.user.id)
    ) {
      const question = contenuOriginal
        .replace(
          new RegExp(
            `<@!?${client.user.id}>`,
            "g"
          ),
          ""
        )
        .trim();

      await repondreQuestion(
        question,
        message
      );

      return;
    }

    // ==================================================
    // 🛡️ MODÉRATION AUTOMATIQUE
    // ==================================================

    const raisonInterdite =
      detecterContenuInterdit(
        contenuOriginal
      );

    if (raisonInterdite) {
      try {
        await message.delete();
      } catch {}

      await message.channel.send(
        `🚨 ${message.author}, ton message a été supprimé.\n` +
        `📝 Raison : **${raisonInterdite}**`
      );

      return;
    }

    // ==================================================
    // ⭐ XP
    // ==================================================

    await ajouterXP(message);

    // ==================================================
    // 🎫 TICKET
    // ==================================================

    if (contenu === "!ticket") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 Dream Community — Tickets")
        .setDescription(
          "Choisis la raison de ton ticket :\n\n" +
          "👑 **Devenir Admin**\n" +
          "🌐 **Site Web**\n" +
          "🛟 **Support**"
        );

      const row =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_admin")
            .setLabel("Devenir Admin")
            .setEmoji("👑")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("ticket_site")
            .setLabel("Site Web")
            .setEmoji("🌐")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("ticket_support")
            .setLabel("Support")
            .setEmoji("🛟")
            .setStyle(ButtonStyle.Success)
        );

      return message.channel.send({
        embeds: [embed],
        components: [row]
      });
    }

    // ==================================================
    // 📜 RÈGLEMENT
    // ==================================================

    if (contenu === "!reglement") {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("📜 Règlement — Dream Community")
            .setDescription(
              "🤝 Respect obligatoire\n" +
              "🚫 Pas de harcèlement\n" +
              "🚫 Pas de menaces\n" +
              "🚫 Pas de contenu inapproprié\n" +
              "🚫 Pas de spam\n" +
              "🔒 Respect de la vie privée\n" +
              "👮 Respect du staff"
            )
        ]
      });
    }

    // ==================================================
    // 🌙 DREAM
    // ==================================================

    if (contenu === "!dream") {
      return message.channel.send(
        "🌙 **Dream Community — Saison 3** ✨\n\n" +
        "Bienvenue dans votre espace communautaire ! 💜"
      );
    }

    // ==================================================
    // 📊 SERVERINFO
    // ==================================================

    if (contenu === "!serverinfo") {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("📊 Informations du serveur")
            .addFields(
              {
                name: "🌙 Serveur",
                value: message.guild.name,
                inline: true
              },
              {
                name: "👥 Membres",
                value: String(
                  message.guild.memberCount
                ),
                inline: true
              },
              {
                name: "🆔 ID",
                value: message.guild.id,
                inline: false
              }
            )
        ]
      });
    }

    // ==================================================
    // 🆘 HELP
    // ==================================================

    if (contenu === "!help") {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              "🆘 DreamBot — Commandes"
            )
            .addFields(
              {
                name: "🌙 Général",
                value:
                  "`!help`\n" +
                  "`!dream`\n" +
                  "`!reglement`\n" +
                  "`!serverinfo`"
              },
              {
                name: "⭐ XP",
                value:
                  "`!rank`\n" +
                  "`!xp`\n" +
                  "`!leaderboard`\n" +
                  "`!lb`\n" +
                  "`!warns`"
              },
              {
                name: "🎫 Tickets",
                value:
                  "`!ticket`"
              },
              {
                name: "💡 Communauté",
                value:
                  "`!suggest <idée>`\n" +
                  "`!report @membre <raison>`"
              },
              {
                name: "🔢 Décompte",
                value:
                  "`!compteur`\n" +
                  "`!record`"
              },
              {
                name: "🛡️ Modération",
                value:
                  "`!warn @membre`\n" +
                  "`!mute @membre`\n" +
                  "`!kick @membre`\n" +
                  "`!ban @membre`"
              }
            )
        ]
      });
    }

    // ==================================================
    // ⭐ RANK
    // ==================================================

    if (
      contenu === "!rank" ||
      contenu === "!xp"
    ) {
      const utilisateur =
        obtenirUtilisateurXP(
          message.author.id
        );

      return message.reply(
        `⭐ **${message.author.username}**\n\n` +
        `📈 Niveau : **${utilisateur.niveau}**\n` +
        `✨ XP : **${utilisateur.xp} / ${xpPourNiveau(utilisateur.niveau)}**`
      );
    }

    // ==================================================
    // 🏆 LEADERBOARD
    // ==================================================

    if (
      contenu === "!leaderboard" ||
      contenu === "!lb"
    ) {
      const classement = Object.entries(
        xpData
      )
        .sort(
          (a, b) =>
            (b[1].niveau * 1000 + b[1].xp) -
            (a[1].niveau * 1000 + a[1].xp)
        )
        .slice(0, 10);

      if (classement.length === 0) {
        return message.reply(
          "🏆 Aucun classement disponible pour le moment."
        );
      }

      let texte =
        "🏆 **Classement XP — Top 10**\n\n";

      for (
        let i = 0;
        i < classement.length;
        i++
      ) {
        const [id, data] = classement[i];

        const membre =
          await message.guild.members
            .fetch(id)
            .catch(() => null);

        const nom =
          membre?.user.username ||
          `Utilisateur ${id}`;

        texte +=
          `${i + 1}. **${nom}** — Niveau ${data.niveau} ⭐ ${data.xp} XP\n`;
      }

      return message.channel.send(texte);
    }

    // ==================================================
    // ⚠️ WARNS
    // ==================================================

    if (contenu === "!warns") {
      const utilisateur =
        obtenirUtilisateurXP(
          message.author.id
        );

      if (utilisateur.warns.length === 0) {
        return message.reply(
          "✅ Tu n'as aucun avertissement."
        );
      }

      let texte =
        `⚠️ **Tes avertissements : ${utilisateur.warns.length}**\n\n`;

      utilisateur.warns.forEach(
        (warn, index) => {
          texte +=
            `**${index + 1}.** ${warn.raison}\n`;
        }
      );

      return message.reply(texte);
    }

    // ==================================================
    // 🛡️ WARN
    // ==================================================

    if (
      contenu === "!warn" ||
      contenu.startsWith("!warn ")
    ) {
      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.ModerateMembers
        )
      ) {
        return message.reply(
          "🚫 Tu n'as pas la permission de faire cela."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!warn @membre <raison>`"
        );
      }

      const raison =
        message.content
          .replace(
            /^!warn\s+<@!?\d+>\s*/i,
            ""
          )
          .trim() ||
        "Aucune raison";

      await ajouterAvertissement(
        membre,
        raison,
        message
      );

      return;
    }

    // ==================================================
    // 🔇 MUTE
    // ==================================================

    if (
      contenu === "!mute" ||
      contenu.startsWith("!mute ")
    ) {
      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.ModerateMembers
        )
      ) {
        return message.reply(
          "🚫 Tu n'as pas la permission."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!mute @membre`"
        );
      }

      await membre.timeout(
        60 * 60 * 1000,
        "Mute par la modération"
      );

      return message.channel.send(
        `🔇 ${membre} a été mute pendant **1 heure**.`
      );
    }

    // ==================================================
    // 👢 KICK
    // ==================================================

    if (
      contenu === "!kick" ||
      contenu.startsWith("!kick ")
    ) {
      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.KickMembers
        )
      ) {
        return message.reply(
          "🚫 Tu n'as pas la permission."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!kick @membre`"
        );
      }

      await membre.kick(
        "Kick par la modération"
      );

      return message.channel.send(
        `👢 **${membre.user.username}** a été expulsé.`
      );
    }

    // ==================================================
    // 🔨 BAN
    // ==================================================

    if (
      contenu === "!ban" ||
      contenu.startsWith("!ban ")
    ) {
      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.BanMembers
        )
      ) {
        return message.reply(
          "🚫 Tu n'as pas la permission."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!ban @membre`"
        );
      }

      await membre.ban({
        reason: "Ban par la modération"
      });

      return message.channel.send(
        `🔨 **${membre.user.username}** a été banni.`
      );
    }

    // ==================================================
    // 💡 SUGGESTION
    // ==================================================

    if (
      contenu === "!suggest" ||
      contenu.startsWith("!suggest ")
    ) {
      const suggestion =
        message.content
          .slice("!suggest".length)
          .trim();

      if (!suggestion) {
        return message.reply(
          "❌ Utilisation : `!suggest <idée>`"
        );
      }

      const channel =
        message.guild.channels.cache.find(
          (c) =>
            c.name === "💡・suggestions"
        );

      if (!channel) {
        return message.reply(
          "❌ Le salon `💡・suggestions` est introuvable."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("💡 Nouvelle suggestion")
        .setDescription(suggestion)
        .setAuthor({
          name: message.author.username,
          iconURL:
            message.author.displayAvatarURL()
        })
        .setTimestamp();

      const msg =
        await channel.send({
          embeds: [embed]
        });

      await msg.react("👍");
      await msg.react("👎");

      return message.reply(
        `✅ Ta suggestion a été envoyée dans ${channel}.`
      );
    }

    // ==================================================
    // 🚨 REPORT
    // ==================================================

    if (
      contenu === "!report" ||
      contenu.startsWith("!report ")
    ) {
      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!report @membre <raison>`"
        );
      }

      const raison =
        message.content
          .replace(
            /^!report\s+<@!?\d+>\s*/i,
            ""
          )
          .trim() ||
        "Aucune raison";

      const channel =
        message.guild.channels.cache.find(
          (c) =>
            c.name === "🚨・signalements"
        );

      if (!channel) {
        return message.reply(
          "❌ Le salon des signalements est introuvable."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🚨 Nouveau signalement")
        .addFields(
          {
            name: "👤 Signalé",
            value: `${membre}`,
            inline: true
          },
          {
            name: "📨 Par",
            value: `${message.author}`,
            inline: true
          },
          {
            name: "📝 Raison",
            value: raison
          }
        )
        .setTimestamp();

      await channel.send({
        embeds: [embed]
      });

      return message.reply(
        "✅ Ton signalement a été transmis au staff."
      );
    }

    // ==================================================
    // 🔢 COMPTEUR
    // ==================================================

    if (contenu === "!compteur") {
      resetParticipantsSiNecessaire();

      return message.reply(
        `🔢 Le compteur actuel est à **${countingData.count}**.\n` +
        `🏆 Record : **${countingData.record}**`
      );
    }

    // ==================================================
    // 🏆 RECORD
    // ==================================================

    if (contenu === "!record") {
      resetParticipantsSiNecessaire();

      return message.reply(
        `🏆 Le record actuel du décompte est **${countingData.record}** ! 🔥`
      );
    }

    // ==================================================
    // 🔢 MESSAGE DU DÉCOMPTE
    // ==================================================

    if (
      message.channel.name === "🔢・décompte"
    ) {
      resetParticipantsSiNecessaire();

      const nombre =
        Number(message.content.trim());

      if (
        !Number.isInteger(nombre) ||
        nombre < 1
      ) {
        return;
      }

      if (
        countingData.participants[
          message.author.id
        ]
      ) {
        await message.react("🚫");
        return;
      }

      const attendu =
        countingData.count + 1;

      if (nombre !== attendu) {
        countingData.count = 0;
        countingData.participants = {};

        sauvegarderJSON(
          COUNTING_FILE,
          countingData
        );

        await message.react("❌");

        return message.channel.send(
          `💥 Mauvais nombre ! Le compteur revient à **0**.`
        );
      }

      countingData.count = nombre;

      if (
        nombre > countingData.record
      ) {
        countingData.record = nombre;
      }

      countingData.participants[
        message.author.id
      ] = true;

      sauvegarderJSON(
        COUNTING_FILE,
        countingData
      );

      await message.react("✅");

      if (nombre % 10 === 0) {
        await message.channel.send(
          `🔥 **${nombre} !** Continuez comme ça !`
        );
      }

      return;
    }
  } catch (error) {
    console.error(
      "❌ Erreur messageCreate :",
      error
    );
  }
});

// ==================================================
// 🔘 BOUTONS
// ==================================================

client.on(
  "interactionCreate",
  async (interaction) => {
    try {
      if (!interaction.isButton()) return;

      // 🎫 CRÉATION TICKETS

      if (
        interaction.customId ===
        "ticket_admin"
      ) {
        return creerTicket(
          interaction,
          "👑 Devenir Admin"
        );
      }

      if (
        interaction.customId ===
        "ticket_site"
      ) {
        return creerTicket(
          interaction,
          "🌐 Site Web"
        );
      }

      if (
        interaction.customId ===
        "ticket_support"
      ) {
        return creerTicket(
          interaction,
          "🛟 Support"
        );
      }

      // 🔒 FERMETURE

      if (
        interaction.customId ===
        "ticket_close"
      ) {
        const membre =
          interaction.member;

        if (!estStaff(membre)) {
          return interaction.reply({
            content:
              "🚫 Seul le staff peut fermer ce ticket.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 Fermeture du ticket dans **3 secondes**..."
        );

        setTimeout(async () => {
          try {
            await interaction.channel.delete(
              "Ticket fermé"
            );
          } catch (error) {
            console.error(
              "Erreur fermeture ticket :",
              error
            );
          }
        }, 3000);
      }
    } catch (error) {
      console.error(
        "❌ Erreur interaction :",
        error
      );
    }
  }
);

// ==================================================
// 🚨 ERREURS
// ==================================================

client.on(
  "error",
  (error) => {
    console.error(
      "❌ Discord Client Error:",
      error
    );
  }
);

client.on(
  "shardError",
  (error) => {
    console.error(
      "❌ Discord Shard Error:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

// ==================================================
// 🚀 CONNEXION
// ==================================================

if (!TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN est introuvable dans les variables d'environnement."
  );
  process.exit(1);
}

client.login(TOKEN);
