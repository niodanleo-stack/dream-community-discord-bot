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
// CONFIG
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = "!";

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN introuvable.");
  process.exit(1);
}

// ======================================================
// SERVEUR WEB RENDER
// ======================================================

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
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember
  ]
});

// ======================================================
// FICHIERS
// ======================================================

const XP_FILE = path.join(__dirname, "xp.json");
const COUNTING_FILE = path.join(__dirname, "counting.json");

function chargerJSON(fichier, defaut) {
  try {
    if (!fs.existsSync(fichier)) {
      fs.writeFileSync(
        fichier,
        JSON.stringify(defaut, null, 2)
      );
      return defaut;
    }

    const contenu = fs.readFileSync(fichier, "utf8");

    if (!contenu.trim()) return defaut;

    return JSON.parse(contenu);
  } catch (error) {
    console.error(`❌ Erreur lecture ${fichier}:`, error);
    return defaut;
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

let countingData = chargerJSON(
  COUNTING_FILE,
  {
    nombre: 0,
    record: 0,
    dernierJour: "",
    participants: []
  }
);

// ======================================================
// OUTILS
// ======================================================

function normaliserTexte(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obtenirRoleStaff(guild) {
  return guild.roles.cache.find(
    role =>
      role.name.toLowerCase() === "staff"
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

  const role = obtenirRoleStaff(member.guild);

  return role
    ? member.roles.cache.has(role.id)
    : false;
}

function xpPourNiveau(niveau) {
  return 100 + 50 * (niveau - 1);
}

function calculerNiveau(xp) {
  let niveau = 1;
  let total = 0;

  while (
    xp >= total + xpPourNiveau(niveau)
  ) {
    total += xpPourNiveau(niveau);
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

function detecterContenuInterdit(texte) {
  const contenu = normaliserTexte(texte);

  for (const mot of insultes) {
    if (
      contenu.includes(
        normaliserTexte(mot)
      )
    ) {
      return "Insulte / langage inapproprié";
    }
  }

  for (const mot of contenusSexuels) {
    if (
      contenu.includes(
        normaliserTexte(mot)
      )
    ) {
      return "Contenu sexuel / inapproprié";
    }
  }

  for (const phrase of menacesViolentes) {
    if (
      contenu.includes(
        normaliserTexte(phrase)
      )
    ) {
      return "Menace / contenu violent";
    }
  }

  if (adresseRegex.test(texte)) {
    return "Adresse personnelle";
  }

  if (telephoneRegex.test(texte)) {
    return "Numéro de téléphone";
  }

  if (ipRegex.test(texte)) {
    return "Adresse IP";
  }

  if (infoPriveeRegex.test(texte)) {
    return "Information privée";
  }

  return null;
}

// ======================================================
// AVERTISSEMENTS
// ======================================================

async function ajouterAvertissement(
  member,
  channel,
  raison
) {
  if (!member) return;

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

  const nombre =
    xpData[id].avertissements;

  sauvegarderJSON(XP_FILE, xpData);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("⚠️ Avertissement")
    .setDescription(
      `${member}, ton message a été supprimé.\n\n` +
      `**Raison :** ${raison}\n` +
      `**Avertissements :** ${nombre}/3`
    )
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  }).catch(() => {});

  if (nombre >= 3) {
    try {
      await member.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements"
      );

      await channel.send(
        `🔇 ${member} a reçu un **timeout de 24 heures**.`
      ).catch(() => {});
    } catch (error) {
      console.error(
        "❌ Timeout impossible :",
        error
      );
    }
  }
}

// ======================================================
// 🤖 RÉPONSES AUX MENTIONS
// ======================================================

function repondreQuestion(question, message) {
  const q = normaliserTexte(
    question.trim()
  );

  if (!q) {
    return "👋 Oui ? Pose-moi ta question !";
  }

  // Bonjour
  if (
    q === "bonjour" ||
    q === "salut" ||
    q === "hello" ||
    q === "coucou" ||
    q.includes("bonjour")
  ) {
    return `👋 Salut ${message.author} ! Comment puis-je t'aider ? 🌙`;
  }

  // Qui es-tu ?
  if (
    q.includes("qui es tu") ||
    q.includes("qui es-tu") ||
    q.includes("t es qui") ||
    q.includes("tes qui")
  ) {
    return "🤖 Je suis **DreamBot**, le bot officiel de Dream Community ! 🌙";
  }

  // Dream Community
  if (
    q.includes("c est quoi dream community") ||
    q.includes("c quoi dream community") ||
    q.includes("dream community")
  ) {
    return (
      "🌙 **Dream Community** est notre communauté !\n" +
      "✨ Bienvenue dans la **Saison 3** !"
    );
  }

  // Tickets
  if (
    q.includes("ticket") ||
    q.includes("ouvrir un ticket")
  ) {
    return (
      "🎫 Pour ouvrir un ticket, utilise **`!ticket`** "
      + "puis choisis le type de demande."
    );
  }

  // Commandes
  if (
    q.includes("commande") ||
    q.includes("commandes") ||
    q.includes("aide")
  ) {
    return (
      "🆘 Tu peux utiliser **`!help`** pour voir toutes les commandes disponibles."
    );
  }

  // Règlement
  if (
    q.includes("reglement") ||
    q.includes("règle") ||
    q.includes("regles") ||
    q.includes("règles")
  ) {
    return (
      "📜 Le règlement est disponible avec **`!reglement`**."
    );
  }

  // XP
  if (
    q.includes("xp") ||
    q.includes("experience") ||
    q.includes("niveau")
  ) {
    return (
      "⭐ Tu peux voir ton XP avec **`!rank`** ou **`!xp`**."
    );
  }

  // Leaderboard
  if (
    q.includes("classement") ||
    q.includes("leaderboard")
  ) {
    return (
      "🏆 Utilise **`!leaderboard`** ou **`!lb`** pour voir le classement XP."
    );
  }

  // Décompte
  if (
    q.includes("decompte") ||
    q.includes("décompte") ||
    q.includes("compteur")
  ) {
    return (
      "🔢 Le décompte se trouve dans le salon prévu à cet effet. "
      + "Tu peux utiliser **`!compteur`** pour voir le nombre actuel."
    );
  }

  // Suggestions
  if (
    q.includes("suggestion") ||
    q.includes("idee") ||
    q.includes("idée")
  ) {
    return (
      "💡 Pour proposer une idée, utilise **`!suggest ton idée`**."
    );
  }

  // Staff
  if (
    q.includes("staff") ||
    q.includes("admin")
  ) {
    return (
      "🛡️ Pour contacter l'équipe, tu peux ouvrir un ticket avec **`!ticket`**."
    );
  }

  // Merci
  if (
    q.includes("merci") ||
    q.includes("thanks")
  ) {
    return "💜 Avec plaisir ! 🌙";
  }

  // Bonne nuit
  if (
    q.includes("bonne nuit")
  ) {
    return "🌙 Bonne nuit ! Fais de beaux rêves ✨";
  }

  // Heure
  if (
    q.includes("quelle heure") ||
    q.includes("il est quelle heure")
  ) {
    return (
      "🕐 Je ne peux pas afficher l'heure en direct ici, "
      + "mais tu peux regarder l'heure de ton appareil."
    );
  }

  // Réponse générique
  return (
    `🤖 J'ai bien reçu ta question, ${message.author} !\n` +
    "Je n'ai pas encore de réponse enregistrée pour cette question. "
    + "Essaie **`!help`** ou demande-moi quelque chose sur Dream Community. 🌙"
  );
}

// ======================================================
// READY
// ======================================================

client.once("clientReady", () => {
  console.log(
    `✅ DreamBot connecté : ${client.user.tag}`
  );

  client.user.setActivity(
    "Dream Community 🌙"
  );
});

// ======================================================
// BIENVENUE
// ======================================================

client.on(
  "guildMemberAdd",
  async member => {
    try {
      const channel =
        member.guild.channels.cache.find(
          channel =>
            channel.name ===
              "📢・𝗔𝗻𝗻𝗼𝗻𝗰𝗲𝘀-𝗢𝗳𝗳𝗶𝗰𝗶𝗲𝗹𝗹𝗲𝘀" &&
            channel.isTextBased()
        );

      if (channel) {
        await channel.send(
          `🌙 Bienvenue ${member} dans **Dream Community** !`
        );
      }

      const role =
        member.guild.roles.cache.find(
          role =>
            role.name.toLowerCase() ===
            "citoyen"
        );

      if (role) {
        await member.roles.add(role)
          .catch(() => {});
      }

    } catch (error) {
      console.error(
        "❌ Erreur bienvenue :",
        error
      );
    }
  }
);

// ======================================================
// MESSAGE CREATE
// ======================================================

client.on(
  "messageCreate",
  async message => {

    try {

      if (message.author.bot) return;
      if (!message.guild) return;

      const contenuOriginal =
        message.content.trim();

      const contenu =
        normaliserTexte(
          contenuOriginal
        );

      // ==================================================
      // 🤖 MENTION DU BOT
      // ==================================================

      if (
        message.mentions.has(
          client.user.id
        )
      ) {

        const question =
          contenuOriginal
            .replace(
              new RegExp(
                `<@!?${client.user.id}>`,
                "g"
              ),
              ""
            )
            .trim();

        const reponse =
          repondreQuestion(
            question,
            message
          );

        return message.reply({
          content: reponse,
          allowedMentions: {
            repliedUser: false
          }
        });
      }

      // ==================================================
      // MODÉRATION
      // ==================================================

      const interdit =
        detecterContenuInterdit(
          contenuOriginal
        );

      if (interdit) {

        await message.delete()
          .catch(() => {});

        await ajouterAvertissement(
          message.member,
          message.channel,
          interdit
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

      const data =
        xpData[message.author.id];

      const maintenant =
        Date.now();

      if (
        !data.dernierXP ||
        maintenant - data.dernierXP >= 30000
      ) {

        const ancienNiveau =
          calculerNiveau(data.xp);

        data.xp += 10;
        data.dernierXP = maintenant;

        const nouveauNiveau =
          calculerNiveau(data.xp);

        data.niveau =
          nouveauNiveau;

        sauvegarderJSON(
          XP_FILE,
          xpData
        );

        if (
          nouveauNiveau >
          ancienNiveau
        ) {

          await message.channel.send(
            `🎉 ${message.author} passe au **niveau ${nouveauNiveau}** ! ⭐`
          ).catch(() => {});
        }
      }

      // ==================================================
      // TICKET
      // ==================================================

      if (contenu === "!ticket") {

        const boutons =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  "ticket_admin"
                )
                .setLabel(
                  "👑 Devenir Admin"
                )
                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()
                .setCustomId(
                  "ticket_site"
                )
                .setLabel(
                  "🌐 Site Web"
                )
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId(
                  "ticket_support"
                )
                .setLabel(
                  "🛟 Support"
                )
                .setStyle(
                  ButtonStyle.Success
                )
            );

        return message.reply({
          content:
            "🎫 **Ouvrir un ticket**\n" +
            "Choisis le type de demande :",
          components: [boutons]
        });
      }

      // ==================================================
      // RANK
      // ==================================================

      if (
        contenu === "!rank" ||
        contenu === "!xp"
      ) {

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9b59b6)
              .setTitle(
                "⭐ Ton profil"
              )
              .setDescription(
                `👤 ${message.author}\n\n` +
                `⭐ XP : **${data.xp}**\n` +
                `🏆 Niveau : **${calculerNiveau(data.xp)}**\n` +
                `⚠️ Avertissements : **${data.avertissements || 0}/3**`
              )
          ]
        });
      }

      // ==================================================
      // LEADERBOARD
      // ==================================================

      if (
        contenu === "!leaderboard" ||
        contenu === "!lb"
      ) {

        const classement =
          Object.entries(xpData)
            .sort(
              (a, b) =>
                (b[1].xp || 0) -
                (a[1].xp || 0)
            )
            .slice(0, 10);

        let texte = "";

        for (
          let i = 0;
          i < classement.length;
          i++
        ) {

          const [
            id,
            utilisateur
          ] = classement[i];

          let membre = null;

          try {
            membre =
              await message.guild.members.fetch(
                id
              );
          } catch {}

          texte +=
            `**${i + 1}.** ` +
            `${membre ? membre.user.username : id}` +
            ` — ⭐ ${utilisateur.xp || 0} XP\n`;
        }

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle(
                "🏆 Classement XP"
              )
              .setDescription(
                texte ||
                "Aucun membre."
              )
          ]
        });
      }

      // ==================================================
      // WARNS
      // ==================================================

      if (
        contenu === "!warns"
      ) {

        return message.reply(
          `⚠️ Tu as **${data.avertissements || 0}/3 avertissements**.`
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
            PermissionsBitField.Flags
              .ModerateMembers
          )
        ) {
          return message.reply(
            "❌ Permission refusée."
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
            PermissionsBitField.Flags
              .ModerateMembers
          )
        ) {
          return message.reply(
            "❌ Permission refusée."
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

        } catch {

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
            PermissionsBitField.Flags
              .KickMembers
          )
        ) {
          return message.reply(
            "❌ Permission refusée."
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

        } catch {

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
            PermissionsBitField.Flags
              .BanMembers
          )
        ) {
          return message.reply(
            "❌ Permission refusée."
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
            reason:
              `Ban par ${message.author.tag}`
          });

          return message.reply(
            `🔨 ${membre.user.tag} a été banni.`
          );

        } catch {

          return message.reply(
            "❌ Impossible de bannir ce membre."
          );
        }
      }

      // ==================================================
      // DÉCOMPTE
      // ==================================================

      if (
        message.channel.name ===
        "🔢・décompte"
      ) {

        const nombre =
          parseInt(
            contenuOriginal,
            10
          );

        if (isNaN(nombre)) return;

        const dateFrance =
          new Intl.DateTimeFormat(
            "fr-FR",
            {
              timeZone: "Europe/Paris",
              year: "numeric",
              month: "2-digit",
              day: "2-digit"
            }
          ).format(new Date());

        if (
          countingData.dernierJour !==
          dateFrance
        ) {

          countingData.dernierJour =
            dateFrance;

          countingData.participants =
            [];
        }

        if (
          countingData.participants.includes(
            message.author.id
          )
        ) {

          await message.delete()
            .catch(() => {});

          return message.channel.send(
            `⚠️ ${message.author}, tu as déjà participé aujourd'hui !`
          );
        }

        const attendu =
          countingData.nombre + 1;

        if (nombre !== attendu) {

          countingData.nombre = 0;
          countingData.participants = [];

          sauvegarderJSON(
            COUNTING_FILE,
            countingData
          );

          return message.channel.send(
            "💥 **Mauvais nombre !** Le compteur revient à **0**."
          );
        }

        countingData.nombre =
          nombre;

        if (
          nombre >
          countingData.record
        ) {
          countingData.record =
            nombre;
        }

        countingData.participants.push(
          message.author.id
        );

        sauvegarderJSON(
          COUNTING_FILE,
          countingData
        );

        if (
          nombre % 10 === 0
        ) {
          await message.react("✨")
            .catch(() => {});
        }

        return;
      }

      // ==================================================
      // COMPTEUR
      // ==================================================

      if (
        contenu === "!compteur"
      ) {

        return message.reply(
          `🔢 Compteur actuel : **${countingData.nombre}**`
        );
      }

      // ==================================================
      // RECORD
      // ==================================================

      if (
        contenu === "!record"
      ) {

        return message.reply(
          `🏆 Record : **${countingData.record}**`
        );
      }

      // ==================================================
      // SUGGESTION
      // ==================================================

      if (
        contenu.startsWith(
          "!suggest "
        )
      ) {

        const suggestion =
          contenuOriginal
            .slice(9)
            .trim();

        if (!suggestion) {
          return message.reply(
            "❌ Écris une idée."
          );
        }

        const channel =
          message.guild.channels.cache.find(
            channel =>
              channel.name ===
                "💡・suggestions" &&
              channel.isTextBased()
          );

        if (!channel) {
          return message.reply(
            "❌ Salon suggestions introuvable."
          );
        }

        const embed =
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              "💡 Nouvelle suggestion"
            )
            .setDescription(
              suggestion
            )
            .setAuthor({
              name:
                message.author.tag,
              iconURL:
                message.author.displayAvatarURL()
            })
            .setTimestamp();

        const msg =
          await channel.send({
            embeds: [embed]
          });

        await msg.react("👍")
          .catch(() => {});

        await msg.react("👎")
          .catch(() => {});

        return message.reply(
          "✅ Suggestion envoyée !"
        );
      }

      // ==================================================
      // SERVERINFO
      // ==================================================

      if (
        contenu === "!serverinfo"
      ) {

        const guild =
          message.guild;

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x7289da)
              .setTitle(
                `📊 ${guild.name}`
              )
              .addFields(
                {
                  name: "👥 Membres",
                  value:
                    `${guild.memberCount}`,
                  inline: true
                },
                {
                  name: "💬 Salons",
                  value:
                    `${guild.channels.cache.size}`,
                  inline: true
                },
                {
                  name: "🎭 Rôles",
                  value:
                    `${guild.roles.cache.size}`,
                  inline: true
                }
              )
          ]
        });
      }

      // ==================================================
      // REPORT
      // ==================================================

      if (
        contenu.startsWith(
          "!report "
        )
      ) {

        const membre =
          message.mentions.members.first();

        if (!membre) {
          return message.reply(
            "❌ Utilisation : `!report @membre raison`"
          );
        }

        const raison =
          contenuOriginal
            .replace(
              membre.toString(),
              ""
            )
            .replace(
              /^!report\s+/i,
              ""
            )
            .trim();

        if (!raison) {
          return message.reply(
            "❌ Donne une raison."
          );
        }

        const channel =
          message.guild.channels.cache.find(
            channel =>
              channel.name ===
                "🚨・signalements" &&
              channel.isTextBased()
          );

        if (!channel) {
          return message.reply(
            "❌ Salon signalements introuvable."
          );
        }

        const embed =
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(
              "🚨 Nouveau signalement"
            )
            .addFields(
              {
                name:
                  "👤 Membre signalé",
                value:
                  `${membre}`,
                inline: true
              },
              {
                name:
                  "📨 Signalé par",
                value:
                  `${message.author}`,
                inline: true
              },
              {
                name:
                  "📝 Raison",
                value:
                  raison
              }
            )
            .setTimestamp();

        await channel.send({
          embeds: [embed]
        });

        return message.reply(
          "✅ Signalement envoyé au staff."
        );
      }

      // ==================================================
      // RÈGLEMENT
      // ==================================================

      if (
        contenu === "!reglement"
      ) {

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9b59b6)
              .setTitle(
                "📜 Règlement — Dream Community"
              )
              .setDescription(
                "🤝 Respect obligatoire.\n" +
                "🚫 Harcèlement interdit.\n" +
                "🚫 Menaces interdites.\n" +
                "🔞 Contenu inapproprié interdit.\n" +
                "🏠 Pas de partage d'informations personnelles.\n" +
                "📢 Pas de spam.\n" +
                "🛡️ Respect du staff.\n\n" +
                "🌙 **Dream Community — Saison 3**"
              )
          ]
        });
      }

      // ==================================================
      // HELP
      // ==================================================

      if (
        contenu === "!help"
      ) {

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
      // DREAM
      // ==================================================

      if (
        contenu === "!dream"
      ) {

        return message.reply(
          "🌙✨ **Dream Community — Saison 3**\nBienvenue dans notre univers !"
        );
      }

    } catch (error) {

      console.error(
        "❌ ERREUR messageCreate :",
        error
      );
    }
  }
);

// ======================================================
// INTERACTIONS TICKETS
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      if (!interaction.isButton()) {
        return;
      }

      // ==================================================
      // CRÉATION TICKET
      // ==================================================

      if (
        [
          "ticket_admin",
          "ticket_site",
          "ticket_support"
        ].includes(
          interaction.customId
        )
      ) {

        await interaction.deferReply({
          ephemeral: true
        });

        const guild =
          interaction.guild;

        if (!guild) {
          return interaction.editReply(
            "❌ Serveur introuvable."
          );
        }

        const categorie =
          guild.channels.cache.find(
            channel =>
              channel.name ===
                "🎫 TICKETS" &&
              channel.type ===
                ChannelType.GuildCategory
          );

        if (!categorie) {
          return interaction.editReply(
            "❌ La catégorie `🎫 TICKETS` est introuvable."
          );
        }

        const roleStaff =
          obtenirRoleStaff(guild);

        const type =
          interaction.customId ===
          "ticket_admin"
            ? "Admin"
            : interaction.customId ===
              "ticket_site"
              ? "Site Web"
              : "Support";

        const nom =
          `ticket-${interaction.user.username}`
            .toLowerCase()
            .replace(
              /[^a-z0-9-]/g,
              ""
            )
            .slice(0, 90);

        const existant =
          guild.channels.cache.find(
            channel =>
              channel.parentId ===
                categorie.id &&
              channel.name === nom
          );

        if (existant) {
          return interaction.editReply(
            `🎫 Tu as déjà un ticket : ${existant}`
          );
        }

        const permissions = [
          {
            id:
              guild.roles.everyone.id,
            deny: [
              PermissionsBitField.Flags
                .ViewChannel
            ]
          },
          {
            id:
              interaction.user.id,
            allow: [
              PermissionsBitField.Flags
                .ViewChannel,
              PermissionsBitField.Flags
                .SendMessages,
              PermissionsBitField.Flags
                .ReadMessageHistory
            ]
          }
        ];

        if (roleStaff) {
          permissions.push({
            id: roleStaff.id,
            allow: [
              PermissionsBitField.Flags
                .ViewChannel,
              PermissionsBitField.Flags
                .SendMessages,
              PermissionsBitField.Flags
                .ReadMessageHistory,
              PermissionsBitField.Flags
                .ManageChannels
            ]
          });
        }

        const channel =
          await guild.channels.create({
            name: nom,
            type:
              ChannelType.GuildText,
            parent:
              categorie.id,
            permissionOverwrites:
              permissions
          });

        const fermer =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "ticket_close"
                )
                .setLabel(
                  "🔒 Fermer le ticket"
                )
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        const embed =
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              `🎫 Ticket — ${type}`
            )
            .setDescription(
              `Bienvenue ${interaction.user} !\n\n` +
              `📌 **Type :** ${type}\n\n` +
              "Décris ta demande ici. " +
              "Un membre du staff viendra t'aider.\n\n" +
              "🔒 Utilise le bouton ci-dessous pour fermer le ticket."
            )
            .setTimestamp();

        await channel.send({
          content:
            `${interaction.user}` +
            (
              roleStaff
                ? ` ${roleStaff}`
                : ""
            ),
          embeds: [embed],
          components: [fermer]
        });

        return interaction.editReply(
          `✅ Ticket créé : ${channel}`
        );
      }

      // ==================================================
      // FERMER TICKET
      // ==================================================

      if (
        interaction.customId ===
        "ticket_close"
      ) {

        const membre =
          interaction.member;

        if (!estStaff(membre)) {

          return interaction.reply({
            content:
              "❌ Seul le staff peut fermer ce ticket.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 Fermeture du ticket dans **5 secondes**..."
        );

        setTimeout(() => {
          interaction.channel
            .delete()
            .catch(() => {});
        }, 5000);

        return;
      }

    } catch (error) {

      console.error(
        "❌ ERREUR interactionCreate :",
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
  }
);

// ======================================================
// ERREURS
// ======================================================

client.on(
  "error",
  error => {
    console.error(
      "❌ Discord client error :",
      error
    );
  }
);

client.on(
  "shardError",
  error => {
    console.error(
      "❌ Discord shard error :",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled rejection :",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught exception :",
      error
    );
  }
);

// ======================================================
// CONNEXION DISCORD
// ======================================================

client.login(TOKEN)
  .then(() => {
    console.log(
      "🔑 Connexion Discord lancée..."
    );
  })
  .catch(error => {
    console.error(
      "❌ Impossible de connecter DreamBot :",
      error
    );
  });
