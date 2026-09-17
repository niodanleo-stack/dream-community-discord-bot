const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const express = require("express");
const fs = require("fs");
const path = require("path");

// ======================================================
// CONFIGURATION
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN est introuvable dans les variables Render.");
  process.exit(1);
}

const PREFIX = "!";

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🌙 DreamBot est en ligne !");
});

app.listen(PORT, () => {
  console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

// ======================================================
// CLIENT DISCORD
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

// ======================================================
// FICHIERS
// ======================================================

const XP_FILE = path.join(__dirname, "xp.json");
const COUNTING_FILE = path.join(__dirname, "counting.json");

function chargerJSON(fichier, valeurParDefaut) {
  try {
    if (!fs.existsSync(fichier)) {
      fs.writeFileSync(
        fichier,
        JSON.stringify(valeurParDefaut, null, 2)
      );
      return valeurParDefaut;
    }

    const contenu = fs.readFileSync(fichier, "utf8");

    if (!contenu.trim()) {
      return valeurParDefaut;
    }

    return JSON.parse(contenu);
  } catch (error) {
    console.error(`❌ Erreur lecture ${fichier}:`, error);
    return valeurParDefaut;
  }
}

function sauvegarderJSON(fichier, donnees) {
  try {
    fs.writeFileSync(
      fichier,
      JSON.stringify(donnees, null, 2)
    );
  } catch (error) {
    console.error(`❌ Erreur sauvegarde ${fichier}:`, error);
  }
}

let xpData = chargerJSON(XP_FILE, {});
let countingData = chargerJSON(COUNTING_FILE, {
  nombre: 0,
  record: 0,
  dernierJour: "",
  participants: []
});

// ======================================================
// OUTILS
// ======================================================

function obtenirMembre(message) {
  return message.member || null;
}

function obtenirRoleStaff(guild) {
  return guild.roles.cache.find(
    role => role.name.toLowerCase() === "staff"
  );
}

function estStaff(member) {
  if (!member) return false;

  if (
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return true;
  }

  const roleStaff = obtenirRoleStaff(member.guild);

  return roleStaff ? member.roles.cache.has(roleStaff.id) : false;
}

function normaliserTexte(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function xpPourNiveau(niveau) {
  return 100 + 50 * (niveau - 1);
}

function calculerNiveau(xp) {
  let niveau = 1;
  let necessaire = 0;

  while (xp >= necessaire + xpPourNiveau(niveau)) {
    necessaire += xpPourNiveau(niveau);
    niveau++;
  }

  return niveau;
}

// ======================================================
// MODÉRATION AUTOMATIQUE
// ======================================================

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
  "je vais te décapiter",
  "je vais vous décapiter",
  "je vais le décapiter",
  "je vais la décapiter",
  "je vais te découper",
  "je vais vous découper",
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

function detecterContenuInterdit(texte) {
  const contenu = normaliserTexte(texte);

  // Insultes
  for (const mot of insultes) {
    if (contenu.includes(normaliserTexte(mot))) {
      return "Insulte / langage inapproprié";
    }
  }

  // Contenu sexuel / inapproprié
  for (const mot of contenusSexuels) {
    if (contenu.includes(normaliserTexte(mot))) {
      return "Contenu sexuel / inapproprié";
    }
  }

  // Menaces
  for (const phrase of menacesViolentes) {
    if (contenu.includes(normaliserTexte(phrase))) {
      return "Menace / contenu violent";
    }
  }

  // Adresse
  if (adresseRegex.test(texte)) {
    return "Adresse personnelle";
  }

  // Téléphone
  if (telephoneRegex.test(texte)) {
    return "Numéro de téléphone";
  }

  // IP
  if (ipRegex.test(texte)) {
    return "Adresse IP";
  }

  // Mot de passe / clé / secret
  if (infoPriveeRegex.test(texte)) {
    return "Information privée";
  }

  return null;
}

// ======================================================
// AVERTISSEMENTS
// ======================================================

async function ajouterAvertissement(member, channel, raison) {
  if (!member || !member.user) return;

  const id = member.id;

  if (!xpData[id]) {
    xpData[id] = {
      xp: 0,
      niveau: 1,
      avertissements: 0,
      dernierXP: 0
    };
  }

  xpData[id].avertissements =
    (xpData[id].avertissements || 0) + 1;

  const nombre = xpData[id].avertissements;

  sauvegarderJSON(XP_FILE, xpData);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("⚠️ Avertissement automatique")
    .setDescription(
      `${member}, ton message a été supprimé.\n\n` +
      `**Raison :** ${raison}\n` +
      `**Avertissements :** ${nombre}/3`
    )
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  }).catch(() => {});

  // 3 avertissements = timeout 24h
  if (nombre >= 3) {
    try {
      await member.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements"
      );

      await channel.send(
        `🔇 ${member} a reçu un **timeout de 24 heures** après 3 avertissements.`
      ).catch(() => {});
    } catch (error) {
      console.error(
        "❌ Impossible d'appliquer le timeout :",
        error
      );
    }
  }
}

// ======================================================
// READY
// ======================================================

client.once("clientReady", () => {
  console.log(`✅ Connecté à Discord en tant que ${client.user.tag}`);

  client.user.setActivity("Dream Community 🌙");
});

// ======================================================
// ARRIVÉE D'UN MEMBRE
// ======================================================

client.on("guildMemberAdd", async member => {
  try {
    const channel = member.guild.channels.cache.find(
      channel =>
        channel.name === "📢・𝗔𝗻𝗻𝗼𝗻𝗰𝗲𝘀-𝗢𝗳𝗳𝗶𝗰𝗶𝗲𝗹𝗹𝗲𝘀" &&
        channel.isTextBased()
    );

    if (channel) {
      await channel.send(
        `🌙 Bienvenue ${member} dans **Dream Community** !\n` +
        `✨ Nous sommes heureux de t'accueillir !`
      );
    }

    const role = member.guild.roles.cache.find(
      role => role.name.toLowerCase() === "citoyen"
    );

    if (role) {
      await member.roles.add(role).catch(() => {});
    }
  } catch (error) {
    console.error("❌ Erreur bienvenue :", error);
  }
});

// ======================================================
// MESSAGE CREATE
// ======================================================

client.on("messageCreate", async message => {
  try {
    // Ignorer les bots
    if (message.author.bot) return;

    if (!message.guild) return;

    const contenuOriginal = message.content.trim();
    const contenu = normaliserTexte(contenuOriginal);

    // ==================================================
    // MODÉRATION AUTOMATIQUE
    // ==================================================

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

    // ==================================================
    // XP
    // ==================================================

    if (!xpData[message.author.id]) {
      xpData[message.author.id] = {
        xp: 0,
        niveau: 1,
        avertissements: 0,
        dernierXP: 0
      };
    }

    const utilisateurXP = xpData[message.author.id];

    const maintenant = Date.now();

    if (
      !utilisateurXP.dernierXP ||
      maintenant - utilisateurXP.dernierXP >= 30000
    ) {
      const ancienNiveau = calculerNiveau(
        utilisateurXP.xp
      );

      utilisateurXP.xp += 10;
      utilisateurXP.dernierXP = maintenant;

      const nouveauNiveau = calculerNiveau(
        utilisateurXP.xp
      );

      utilisateurXP.niveau = nouveauNiveau;

      sauvegarderJSON(XP_FILE, xpData);

      if (nouveauNiveau > ancienNiveau) {
        await message.channel.send(
          `🎉 Félicitations ${message.author} !\n` +
          `⭐ Tu passes au **niveau ${nouveauNiveau}** !`
        ).catch(() => {});
      }
    }

    // ==================================================
    // TICKET
    // ==================================================

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
          .setLabel("🛟 Support")
          .setStyle(ButtonStyle.Success)
      );

      return message.reply({
        content:
          "🎫 **Ouvrir un ticket**\n" +
          "Choisis le type de demande ci-dessous :",
        components: [boutons]
      });
    }

    // ==================================================
    // RANK
    // ==================================================

    if (contenu === "!rank" || contenu === "!xp") {
      const data = xpData[message.author.id];

      const niveau = calculerNiveau(data.xp);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("⭐ Ton profil Dream Community")
        .setDescription(
          `👤 **Membre :** ${message.author}\n` +
          `⭐ **XP :** ${data.xp}\n` +
          `🏆 **Niveau :** ${niveau}\n` +
          `⚠️ **Avertissements :** ${data.avertissements || 0}/3`
        )
        .setTimestamp();

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // LEADERBOARD
    // ==================================================

    if (
      contenu === "!leaderboard" ||
      contenu === "!lb"
    ) {
      const classement = Object.entries(xpData)
        .sort((a, b) => {
          return (b[1].xp || 0) - (a[1].xp || 0);
        })
        .slice(0, 10);

      if (classement.length === 0) {
        return message.reply(
          "⭐ Aucun membre n'a encore gagné d'XP."
        );
      }

      let texte = "";

      for (let i = 0; i < classement.length; i++) {
        const [id, data] = classement[i];

        let membre;

        try {
          membre = await message.guild.members.fetch(id);
        } catch {
          membre = null;
        }

        const nom = membre
          ? membre.user.username
          : `Membre ${id}`;

        texte +=
          `**${i + 1}.** ${nom} — ⭐ ${data.xp || 0} XP — Niveau ${calculerNiveau(data.xp || 0)}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🏆 Classement XP")
        .setDescription(texte)
        .setTimestamp();

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // WARNS
    // ==================================================

    if (contenu === "!warns") {
      const data = xpData[message.author.id] || {};

      return message.reply(
        `⚠️ Tu as actuellement **${data.avertissements || 0}/3 avertissements**.`
      );
    }

    // ==================================================
    // WARN
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
          "❌ Tu n'as pas la permission d'utiliser cette commande."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!warn @membre`"
        );
      }

      await ajouterAvertissement(
        membre,
        message.channel,
        `Avertissement donné par ${message.author.tag}`
      );

      return;
    }

    // ==================================================
    // MUTE
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
          "❌ Tu n'as pas la permission."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!mute @membre`"
        );
      }

      try {
        await membre.timeout(
          60 * 60 * 1000,
          `Mute par ${message.author.tag}`
        );

        return message.reply(
          `🔇 ${membre} a été mute pendant **1 heure**.`
        );
      } catch (error) {
        console.error(error);

        return message.reply(
          "❌ Impossible de mute ce membre."
        );
      }
    }

    // ==================================================
    // KICK
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
          "❌ Tu n'as pas la permission."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!kick @membre`"
        );
      }

      try {
        await membre.kick(
          `Kick par ${message.author.tag}`
        );

        return message.reply(
          `👢 ${membre.user.tag} a été expulsé.`
        );
      } catch (error) {
        console.error(error);

        return message.reply(
          "❌ Impossible d'expulser ce membre."
        );
      }
    }

    // ==================================================
    // BAN
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
          "❌ Tu n'as pas la permission."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!ban @membre`"
        );
      }

      try {
        await membre.ban({
          reason: `Ban par ${message.author.tag}`
        });

        return message.reply(
          `🔨 ${membre.user.tag} a été banni.`
        );
      } catch (error) {
        console.error(error);

        return message.reply(
          "❌ Impossible de bannir ce membre."
        );
      }
    }

    // ==================================================
    // COMPTAGE
    // ==================================================

    if (
      message.channel.name === "🔢・décompte"
    ) {
      const nombre = parseInt(contenuOriginal);

      if (isNaN(nombre)) return;

      const maintenant = new Date();

      const dateFrance =
        new Intl.DateTimeFormat("fr-FR", {
          timeZone: "Europe/Paris",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(maintenant);

      if (countingData.dernierJour !== dateFrance) {
        countingData.dernierJour = dateFrance;
        countingData.participants = [];
      }

      if (
        countingData.participants.includes(
          message.author.id
        )
      ) {
        await message.delete().catch(() => {});

        return message.channel.send(
          `⚠️ ${message.author}, tu as déjà participé aujourd'hui !`
        ).then(msg => {
          setTimeout(() => {
            msg.delete().catch(() => {});
          }, 5000);
        }).catch(() => {});
      }

      const attendu = countingData.nombre + 1;

      if (nombre !== attendu) {
        countingData.nombre = 0;
        countingData.participants = [];

        sauvegarderJSON(
          COUNTING_FILE,
          countingData
        );

        return message.channel.send(
          `💥 **Mauvais nombre !**\nLe compteur revient à **0**.`
        );
      }

      countingData.nombre = nombre;

      if (nombre > countingData.record) {
        countingData.record = nombre;
      }

      countingData.participants.push(
        message.author.id
      );

      sauvegarderJSON(
        COUNTING_FILE,
        countingData
      );

      if (nombre % 10 === 0) {
        await message.react("✨").catch(() => {});
      }

      return;
    }

    // ==================================================
    // COMPTEUR
    // ==================================================

    if (contenu === "!compteur") {
      return message.reply(
        `🔢 Compteur actuel : **${countingData.nombre}**`
      );
    }

    // ==================================================
    // RECORD
    // ==================================================

    if (contenu === "!record") {
      return message.reply(
        `🏆 Record actuel : **${countingData.record}**`
      );
    }

    // ==================================================
    // SUGGESTION
    // ==================================================

    if (contenu.startsWith("!suggest ")) {
      const suggestion =
        contenuOriginal.slice(9).trim();

      if (!suggestion) {
        return message.reply(
          "❌ Écris une idée après `!suggest`."
        );
      }

      const channel =
        message.guild.channels.cache.find(
          channel =>
            channel.name === "💡・suggestions" &&
            channel.isTextBased()
        );

      if (!channel) {
        return message.reply(
          "❌ Le salon `💡・suggestions` est introuvable."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("💡 Nouvelle suggestion")
        .setDescription(suggestion)
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL()
        })
        .setTimestamp();

      const msg = await channel.send({
        embeds: [embed]
      });

      await msg.react("👍").catch(() => {});
      await msg.react("👎").catch(() => {});

      return message.reply(
        "✅ Ta suggestion a été envoyée !"
      );
    }

    // ==================================================
    // SERVER INFO
    // ==================================================

    if (contenu === "!serverinfo") {
      const guild = message.guild;

      const embed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle(`📊 ${guild.name}`)
        .addFields(
          {
            name: "👥 Membres",
            value: `${guild.memberCount}`,
            inline: true
          },
          {
            name: "💬 Salons",
            value: `${guild.channels.cache.size}`,
            inline: true
          },
          {
            name: "🎭 Rôles",
            value: `${guild.roles.cache.size}`,
            inline: true
          }
        )
        .setTimestamp();

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // REPORT
    // ==================================================

    if (contenu.startsWith("!report ")) {
      const membre =
        message.mentions.members.first();

      if (!membre) {
        return message.reply(
          "❌ Utilisation : `!report @membre raison`"
        );
      }

      const raison =
        contenuOriginal
          .replace(membre.toString(), "")
          .replace(/^!report\s+/i, "")
          .trim();

      if (!raison) {
        return message.reply(
          "❌ Donne une raison."
        );
      }

      const channel =
        message.guild.channels.cache.find(
          channel =>
            channel.name === "🚨・signalements" &&
            channel.isTextBased()
        );

      if (!channel) {
        return message.reply(
          "❌ Le salon `🚨・signalements` est introuvable."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🚨 Nouveau signalement")
        .addFields(
          {
            name: "👤 Membre signalé",
            value: `${membre}`,
            inline: true
          },
          {
            name: "📨 Signalé par",
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
        "✅ Ton signalement a été transmis à l'équipe."
      );
    }

    // ==================================================
    // RÈGLEMENT
    // ==================================================

    if (contenu === "!reglement") {
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("📜 Règlement — Dream Community")
        .setDescription(
          "🤝 **Respect** : respecte tous les membres.\n" +
          "🚫 **Harcèlement** : interdit.\n" +
          "🚫 **Menaces** : interdites.\n" +
          "🔞 **Contenu inapproprié** : interdit.\n" +
          "🏠 **Informations personnelles** : ne partage pas d'adresse, numéro, mot de passe ou autre information privée.\n" +
          "📢 **Spam** : évite le flood et les abus.\n" +
          "🛡️ **Staff** : respecte les décisions de modération.\n\n" +
          "🌙 Bienvenue dans **Dream Community — Saison 3** !"
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // HELP
    // ==================================================

    if (contenu === "!help") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🆘 DreamBot — Commandes")
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
        .setFooter({
          text: "Dream Community 🌙"
        });

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // DREAM
    // ==================================================

    if (contenu === "!dream") {
      return message.reply(
        "🌙✨ **Dream Community** — Saison 3\n" +
        "Bienvenue dans notre univers !"
      );
    }

  } catch (error) {
    console.error(
      "❌ ERREUR DANS messageCreate :",
      error
    );
  }
});

// ======================================================
// INTERACTIONS / TICKETS
// ======================================================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton()) return;

    // ==================================================
    // CRÉATION TICKET
    // ==================================================

    if (
      [
        "ticket_admin",
        "ticket_site",
        "ticket_support"
      ].includes(interaction.customId)
    ) {
      await interaction.deferReply({
        ephemeral: true
      });

      const guild = interaction.guild;

      if (!guild) {
        return interaction.editReply(
          "❌ Cette action doit être utilisée sur le serveur."
        );
      }

      const categorie =
        guild.channels.cache.find(
          channel =>
            channel.name === "🎫 TICKETS" &&
            channel.type === ChannelType.GuildCategory
        );

      if (!categorie) {
        return interaction.editReply(
          "❌ La catégorie `🎫 TICKETS` est introuvable."
        );
      }

      const roleStaff =
        obtenirRoleStaff(guild);

      const typeTicket =
        interaction.customId === "ticket_admin"
          ? "Admin"
          : interaction.customId === "ticket_site"
            ? "Site Web"
            : "Support";

      const nomSalon =
        `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 90);

      // Vérifier si le membre possède déjà un ticket
      const ticketExistant =
        guild.channels.cache.find(
          channel =>
            channel.parentId === categorie.id &&
            channel.name === nomSalon
        );

      if (ticketExistant) {
        return interaction.editReply(
          `🎫 Tu as déjà un ticket ouvert : ${ticketExistant}`
        );
      }

      const overwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel
          ]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ];

      if (roleStaff) {
        overwrites.push({
          id: roleStaff.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        });
      }

      const channel =
        await guild.channels.create({
          name: nomSalon,
          type: ChannelType.GuildText,
          parent: categorie.id,
          permissionOverwrites: overwrites
        });

      const boutonFermer =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("🔒 Fermer le ticket")
            .setStyle(ButtonStyle.Danger)
        );

      const embed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🎫 Ticket — ${typeTicket}`)
          .setDescription(
            `Bienvenue ${interaction.user} !\n\n` +
            `📌 **Type :** ${typeTicket}\n\n` +
            `Décris ta demande ici. Un membre du staff viendra t'aider.\n\n` +
            `🔒 Utilise le bouton ci-dessous pour fermer le ticket.`
          )
          .setTimestamp();

      await channel.send({
        content:
          `${interaction.user}` +
          (roleStaff ? ` ${roleStaff}` : ""),
        embeds: [embed],
        components: [boutonFermer]
      });

      return interaction.editReply(
        `✅ Ton ticket a été créé : ${channel}`
      );
    }

    // ==================================================
    // FERMETURE TICKET
    // ==================================================

    if (interaction.customId === "ticket_close") {
      const membre = interaction.member;

      const autorise =
        estStaff(membre) ||
        interaction.channel.permissionOverwrites.cache.has(
          interaction.user.id
        );

      if (!autorise) {
        return interaction.reply({
          content:
            "❌ Tu ne peux pas fermer ce ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Fermeture du ticket dans **5 secondes**..."
      );

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);

      return;
    }

  } catch (error) {
    console.error(
      "❌ ERREUR interactionCreate :",
      error
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Une erreur est survenue.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ======================================================
// ERREURS
// ======================================================

client.on("error", error => {
  console.error("❌ Discord client error :", error);
});

client.on("shardError", error => {
  console.error("❌ Discord shard error :", error);
});

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled rejection :", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught exception :", error);
});

// ======================================================
// CONNEXION
// ======================================================

client.login(TOKEN).catch(error => {
  console.error("❌ Impossible de connecter le bot à Discord.");
  console.error(error);
});
