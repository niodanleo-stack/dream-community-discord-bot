const express = require("express");
const fs = require("fs");

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

// =====================================================
// 🌐 SERVEUR WEB
// =====================================================

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🌙 Dream Community Bot est en ligne !");
});

app.listen(PORT, () => {
  console.log("🌐 Serveur web actif sur le port " + PORT);
});

// =====================================================
// 🤖 CLIENT DISCORD
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================================================
// ⚠️ AVERTISSEMENTS
// =====================================================

const avertissements = new Map();

// =====================================================
// ⭐ XP / NIVEAUX
// =====================================================

const XP_FILE = "./xp.json";

let xpData = {};

try {
  if (fs.existsSync(XP_FILE)) {
    xpData = JSON.parse(
      fs.readFileSync(XP_FILE, "utf8")
    );
  }
} catch (erreur) {
  console.error(
    "❌ Impossible de charger xp.json :",
    erreur
  );

  xpData = {};
}

const xpCooldowns = new Map();

const XP_PAR_MESSAGE = 10;
const XP_COOLDOWN = 30 * 1000;

function xpPourNiveau(niveau) {
  return 100 + 50 * (niveau - 1);
}

function calculerNiveau(xp) {

  let niveau = 1;
  let xpNecessaire = 0;

  while (
    xp >=
    xpNecessaire + xpPourNiveau(niveau)
  ) {

    xpNecessaire +=
      xpPourNiveau(niveau);

    niveau++;
  }

  return {
    niveau,
    xpDansNiveau:
      xp - xpNecessaire,
    xpPourProchain:
      xpPourNiveau(niveau)
  };
}

function sauvegarderXP() {

  try {

    fs.writeFileSync(
      XP_FILE,
      JSON.stringify(
        xpData,
        null,
        2
      )
    );

  } catch (erreur) {

    console.error(
      "❌ Erreur sauvegarde XP :",
      erreur
    );
  }
}

async function ajouterXP(member) {

  if (!member || member.user.bot)
    return;

  const id = member.id;
  const maintenant = Date.now();

  const dernierXP =
    xpCooldowns.get(id) || 0;

  if (
    maintenant - dernierXP <
    XP_COOLDOWN
  ) {
    return;
  }

  xpCooldowns.set(
    id,
    maintenant
  );

  if (!xpData[id]) {
    xpData[id] = {
      xp: 0
    };
  }

  const ancienNiveau =
    calculerNiveau(
      xpData[id].xp
    ).niveau;

  xpData[id].xp += XP_PAR_MESSAGE;

  const nouveauNiveau =
    calculerNiveau(
      xpData[id].xp
    ).niveau;

  sauvegarderXP();

  if (
    nouveauNiveau >
    ancienNiveau
  ) {

    try {

      await member.guild.systemChannel?.send(
        `🎉 **Nouveau niveau !** 🎉\n\n` +
        `Bravo ${member} ! 🌙✨\n` +
        `Tu viens d'atteindre le **niveau ${nouveauNiveau}** ! 💫`
      );

    } catch (erreur) {

      console.error(
        "Erreur message level up :",
        erreur
      );
    }
  }
}

// =====================================================
// 🔢 DÉCOMPTE
// =====================================================

const COUNTING_FILE =
  "./counting.json";

let countingData = {
  count: 0,
  record: 0,
  recordUserId: null,
  participants: {},
  lastDate: null
};

try {

  if (
    fs.existsSync(
      COUNTING_FILE
    )
  ) {

    countingData =
      JSON.parse(
        fs.readFileSync(
          COUNTING_FILE,
          "utf8"
        )
      );
  }

} catch (erreur) {

  console.error(
    "❌ Impossible de charger counting.json :",
    erreur
  );
}

function dateFrance() {

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());
}

function verifierNouveauJour() {

  const aujourdHui =
    dateFrance();

  if (
    countingData.lastDate !==
    aujourdHui
  ) {

    countingData.participants = {};
    countingData.lastDate =
      aujourdHui;

    sauvegarderCounting();
  }
}

function sauvegarderCounting() {

  try {

    fs.writeFileSync(
      COUNTING_FILE,
      JSON.stringify(
        countingData,
        null,
        2
      )
    );

  } catch (erreur) {

    console.error(
      "❌ Erreur sauvegarde décompte :",
      erreur
    );
  }
}

// =====================================================
// 🚨 ANTI-INSULTES
// =====================================================

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

// =====================================================
// 👋 BIENVENUE
// =====================================================

client.once(
  "clientReady",
  () => {

    console.log(
      "🌙 Dream Community connecté en tant que " +
      client.user.tag
    );
  }
);

client.on(
  "guildMemberAdd",
  async member => {

    const channel =
      member.guild.systemChannel;

    if (!channel)
      return;

    await channel.send(
      `👋 **Bienvenue ${member} !** 🌙✨\n\n` +
      `Nous sommes heureux de t'accueillir dans **Dream Community** ! 💫\n` +
      `Prends ton temps, découvre la communauté et amuse-toi bien. 🫶`
    ).catch(console.error);
  }
);

// =====================================================
// 💬 MESSAGES
// =====================================================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot)
      return;

    const contenu =
      message.content
        .trim()
        .toLowerCase();

    // =================================================
    // 🚨 ANTI-INSULTES
    // =================================================

    const messageNormalise =
      message.content
        .toLowerCase();

    const contientInsulte =
      insultes.some(
        insulte =>
          messageNormalise.includes(
            insulte
          )
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
    // 🔢 DÉCOMPTE
    // =================================================

    verifierNouveauJour();

    if (
      message.channel.name ===
      "🔢・décompte"
    ) {

      const nombre =
        Number(
          message.content.trim()
        );

      // Ignore les messages non numériques
      if (
        !Number.isInteger(nombre)
      ) {
        return;
      }

      const utilisateur =
        message.author.id;

      // Une seule participation par jour
      if (
        countingData.participants[
          utilisateur
        ]
      ) {

        await message.reply(
          `🌙 **Tu as déjà participé aujourd'hui !**\n\n` +
          `✨ Merci pour ta participation. ` +
          `Tu pourras retenter ta chance demain ! 💫`
        ).catch(() => {});

        return;
      }

      const attendu =
        countingData.count + 1;

      // =================================================
      // ✅ BON NOMBRE
      // =================================================

      if (
        nombre === attendu
      ) {

        countingData.count =
          nombre;

        countingData.participants[
          utilisateur
        ] = true;

        // Nouveau record
        if (
          countingData.count >
          countingData.record
        ) {

          countingData.record =
            countingData.count;

          countingData.recordUserId =
            utilisateur;

          await message.react("🏆")
            .catch(() => {});
        } else {

          await message.react("✅")
            .catch(() => {});
        }

        sauvegarderCounting();

        return;
      }

      // =================================================
      // ❌ MAUVAIS NOMBRE
      // =================================================

      countingData.participants[
        utilisateur
      ] = true;

      countingData.count = 0;

      await message.react("💫")
        .catch(() => {});

      await message.reply(
        `🌙 **Oups !** Ce n'était pas le bon chiffre.\n\n` +
        `✨ Il fallait écrire **${attendu}**.\n` +
        `🔄 Pas grave, on recommence tranquillement à **0** !\n\n` +
        `🏆 Record actuel : **${countingData.record}**`
      ).catch(() => {});

      sauvegarderCounting();

      return;
    }

    // =================================================
    // ⭐ XP
    // =================================================

    await ajouterXP(
      message.member
    );

    // =================================================
    // 📜 RÈGLEMENT
    // =================================================

    if (
      contenu === "!reglement"
    ) {

      return message.reply(
        `📜 **Règlement Dream Community** 🌙\n\n` +
        `🤝 Respect entre les membres\n` +
        `🚫 Pas de harcèlement\n` +
        `🚫 Pas de menaces\n` +
        `🚫 Pas d'insultes\n` +
        `🔞 Pas de contenu inapproprié\n\n` +
        `✨ Merci de contribuer à une communauté agréable pour tout le monde !`
      );
    }

    // =================================================
    // 🌙 DREAM
    // =================================================

    if (
      contenu === "!dream"
    ) {

      return message.reply(
        `🌙 **Dream Community** ✨\n\n` +
        `Bienvenue dans notre communauté ! 💫\n` +
        `Profite des événements, des discussions et de toutes les nouveautés. 🫶`
      );
    }

    // =================================================
    // 🔢 COMPTEUR
    // =================================================

    if (
      contenu === "!compteur"
    ) {

      return message.reply(
        `🔢 **Décompte actuel : ${countingData.count}**\n\n` +
        `✨ Prochain chiffre : **${countingData.count + 1}**\n` +
        `🏆 Record : **${countingData.record}**`
      );
    }

    // =================================================
    // 🏆 RECORD
    // =================================================

    if (
      contenu === "!record"
    ) {

      let recordeur =
        "Personne pour le moment";

      if (
        countingData.recordUserId
      ) {

        recordeur =
          `<@${countingData.recordUserId}>`;
      }

      return message.reply(
        `🏆 **Record du décompte**\n\n` +
        `✨ Record : **${countingData.record}**\n` +
        `🌙 Réalisé par : ${recordeur}\n\n` +
        `💫 Peut-être que le prochain record sera encore plus grand !`
      );
    }

    // =================================================
    // ⭐ RANK
    // =================================================

    if (
      contenu === "!rank" ||
      contenu === "!xp"
    ) {

      const id =
        message.author.id;

      const xp =
        xpData[id]?.xp || 0;

      const niveau =
        calculerNiveau(xp);

      return message.reply(
        `⭐ **Ton profil XP**\n\n` +
        `👤 ${message.author}\n` +
        `🌟 Niveau : **${niveau.niveau}**\n` +
        `✨ XP : **${niveau.xpDansNiveau}/${niveau.xpPourProchain}**`
      );
    }

    // =================================================
    // 🏆 LEADERBOARD
    // =================================================

    if (
      contenu === "!leaderboard" ||
      contenu === "!lb"
    ) {

      const classement =
        Object.entries(xpData)
          .sort(
            (a, b) =>
              b[1].xp - a[1].xp
          )
          .slice(0, 10);

      let texte =
        "🏆 **Classement XP Dream Community**\n\n";

      if (
        classement.length === 0
      ) {

        texte +=
          "🌙 Aucun classement pour le moment.";
      }

      for (
        let i = 0;
        i < classement.length;
        i++
      ) {

        const [
          userId,
          data
        ] = classement[i];

        const membre =
          await message.guild.members
            .fetch(userId)
            .catch(() => null);

        const nom =
          membre
            ? membre.user.username
            : "Membre inconnu";

        const niveau =
          calculerNiveau(
            data.xp
          ).niveau;

        texte +=
          `**${i + 1}.** ${nom} — ` +
          `⭐ ${data.xp} XP — ` +
          `Niveau ${niveau}\n`;
      }

      return message.reply(
        texte
      );
    }

    // =================================================
    // 🚨 SIGNALEMENT
    // =================================================

    if (
      contenu.startsWith(
        "!report"
      )
    ) {

      const membre =
        message.mentions.members.first();

      if (!membre) {

        return message.reply(
          "🌙 Utilise `!report @membre raison` pour envoyer un signalement."
        );
      }

      const raison =
        message.content
          .split(" ")
          .slice(2)
          .join(" ");

      if (!raison) {

        return message.reply(
          "💫 Pense à préciser la raison du signalement."
        );
      }

      const salon =
        message.guild.channels.cache.find(
          channel =>
            channel.name ===
            "🚨・signalements"
        );

      if (!salon) {

        return message.reply(
          "🌙 Le salon **🚨・signalements** n'a pas été trouvé."
        );
      }

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🚨 Nouveau signalement"
          )
          .setColor(0xffaa00)
          .addFields(
            {
              name: "👤 Membre signalé",
              value:
                `${membre}`,
              inline: true
            },
            {
              name: "📝 Raison",
              value:
                raison,
              inline: false
            },
            {
              name: "📨 Signalé par",
              value:
                `${message.author}`,
              inline: true
            }
          )
          .setTimestamp();

      await salon.send({
        embeds: [embed]
      });

      return message.reply(
        "💫 Merci ! Ton signalement a bien été transmis à l'équipe."
      );
    }

    // =================================================
    // 🎫 TICKET
    // =================================================

    if (
      contenu === "!ticket"
    ) {

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId(
            "menu_ticket"
          )
          .setPlaceholder(
            "✨ Choisis une catégorie"
          )
          .addOptions(
            {
              label:
                "Devenir Admin",
              description:
                "Découvrir comment rejoindre l'équipe",
              value:
                "devenir_admin",
              emoji: "👑"
            },
            {
              label:
                "Site Web",
              description:
                "Accéder au site de Dream Community",
              value:
                "site_web",
              emoji: "🌐"
            },
            {
              label:
                "Contacter le Support",
              description:
                "Besoin d'aide ?",
              value:
                "contacter_support",
              emoji: "🛟"
            }
          );

      const row =
        new ActionRowBuilder()
          .addComponents(
            menu
          );

      return message.reply({
        content:
          `🎫 **Centre de support** 🌙\n\n` +
          `Besoin d'aide ou d'une information ?\n` +
          `Choisis simplement une option ci-dessous. ✨`,
        components: [row]
      });
    }

    // =================================================
    // ⚠️ WARN
    // =================================================

    if (
      contenu.startsWith("!warn")
    ) {

      if (
        !message.member.permissions
          .has(
            PermissionFlagsBits.ModerateMembers
          )
      ) {

        return message.reply(
          "🌙 Tu n'as pas les permissions nécessaires pour utiliser cette commande."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {

        return message.reply(
          "💫 Mentionne le membre concerné."
        );
      }

      const raison =
        message.content
          .split(" ")
          .slice(2)
          .join(" ") ||
        "Aucune raison précisée";

      await ajouterAvertissement(
        membre,
        message.channel,
        raison
      );

      return;
    }

    // =================================================
    // 📊 WARNS
    // =================================================

    if (
      contenu === "!warns"
    ) {

      const nombre =
        avertissements.get(
          message.author.id
        ) || 0;

      return message.reply(
        `🌙 Tu as actuellement **${nombre}/3 avertissements**.`
      );
    }

    // =================================================
    // 🔇 MUTE
    // =================================================

    if (
      contenu.startsWith("!mute")
    ) {

      if (
        !message.member.permissions
          .has(
            PermissionFlagsBits.ModerateMembers
          )
      ) {

        return message.reply(
          "🌙 Tu n'as pas les permissions nécessaires."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {

        return message.reply(
          "💫 Mentionne le membre à mettre en pause."
        );
      }

      try {

        await membre.timeout(
          60 * 60 * 1000,
          "Mute par la modération"
        );

        return message.reply(
          `🌙 ${membre} a été mis en pause pendant **1 heure**.`
        );

      } catch (erreur) {

        console.error(erreur);

        return message.reply(
          "💫 Je n'ai pas réussi à appliquer cette action."
        );
      }
    }

    // =================================================
    // 👢 KICK
    // =================================================

    if (
      contenu.startsWith("!kick")
    ) {

      if (
        !message.member.permissions
          .has(
            PermissionFlagsBits.KickMembers
          )
      ) {

        return message.reply(
          "🌙 Tu n'as pas les permissions nécessaires."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {

        return message.reply(
          "💫 Mentionne le membre concerné."
        );
      }

      try {

        await membre.kick(
          "Expulsion par la modération"
        );

        return message.reply(
          `🌙 ${membre.user.username} a été retiré du serveur.`
        );

      } catch (erreur) {

        console.error(erreur);

        return message.reply(
          "💫 Je n'ai pas réussi à effectuer cette action."
        );
      }
    }

    // =================================================
    // 🚫 BAN
    // =================================================

    if (
      contenu.startsWith("!ban")
    ) {

      if (
        !message.member.permissions
          .has(
            PermissionFlagsBits.BanMembers
          )
      ) {

        return message.reply(
          "🌙 Tu n'as pas les permissions nécessaires."
        );
      }

      const membre =
        message.mentions.members.first();

      if (!membre) {

        return message.reply(
          "💫 Mentionne le membre concerné."
        );
      }

      try {

        await membre.ban({
          reason:
            "Bannissement par la modération"
        });

        return message.reply(
          `🌙 ${membre.user.username} a été retiré du serveur.`
        );

      } catch (erreur) {

        console.error(erreur);

        return message.reply(
          "💫 Je n'ai pas réussi à effectuer cette action."
        );
      }
    }
  }
);

// =====================================================
// ⚠️ SYSTÈME D'AVERTISSEMENTS
// =====================================================

async function ajouterAvertissement(
  membre,
  channel,
  raison
) {

  if (!membre)
    return;

  const id =
    membre.id;

  const nouveauNombre =
    (avertissements.get(id) || 0) + 1;

  avertissements.set(
    id,
    nouveauNombre
  );

  if (
    nouveauNombre === 1
  ) {

    await channel.send(
      `🌙 ${membre} reçoit son **1er avertissement**.\n\n` +
      `📝 Raison : ${raison}\n` +
      `📊 Avertissements : **1/3**\n\n` +
      `💫 Pas d'inquiétude, fais simplement attention pour la suite.`
    );

    return;
  }

  if (
    nouveauNombre === 2
  ) {

    await channel.send(
      `🌙 ${membre} reçoit son **2e avertissement**.\n\n` +
      `📝 Raison : ${raison}\n` +
      `📊 Avertissements : **2/3**\n\n` +
      `✨ Il reste encore une étape avant une éventuelle suspension.`
    );

    return;
  }

  if (
    nouveauNombre === 3
  ) {

    try {

      await membre.timeout(
        24 * 60 * 60 * 1000,
        "3 avertissements - Suspension Dream Community"
      );

      await channel.send(
        `⏳ ${membre} atteint **3 avertissements**.\n\n` +
        `🌙 Une suspension de **24 heures** a été appliquée.\n` +
        `📝 Dernière raison : ${raison}\n\n` +
        `✨ Après cette pause, tu pourras revenir tranquillement dans la communauté.`
      );

    } catch (erreur) {

      console.error(
        erreur
      );

      await channel.send(
        `🌙 ${membre} atteint **3 avertissements**.\n\n` +
        `💫 Je n'ai pas réussi à appliquer automatiquement la suspension.`
      );
    }

    return;
  }
}

// =====================================================
// 🎫 INTERACTIONS DES TICKETS
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId ===
        "menu_ticket"
    ) {

      const choix =
        interaction.values[0];

      // 👑 ADMIN
      if (
        choix ===
        "devenir_admin"
      ) {

        return interaction.reply({
          content:
            `👑 **Devenir Admin**\n\n` +
            `🌙 Merci pour ton intérêt !\n` +
            `Les candidatures et recrutements sont étudiés par l'équipe Dream Community. ✨`,
          ephemeral: true
        });
      }

      // 🌐 SITE
      if (
        choix ===
        "site_web"
      ) {

        return interaction.reply({
          content:
            `🌐 **Site officiel**\n\n` +
            `✨ Tu peux retrouver Dream Community ici :\n` +
            `http://6aaae97cbf7b6.site123.me/`,
          ephemeral: true
        });
      }

      // 🛟 SUPPORT
      if (
        choix ===
        "contacter_support"
      ) {

        await interaction
          .deferReply({
            ephemeral: true
          });

        try {

          const guild =
            interaction.guild;

          const membre =
            interaction.member;

          if (
            !guild.members.me.permissions.has(
              PermissionFlagsBits.ManageChannels
            )
          ) {

            return interaction.editReply(
              "🌙 Je n'ai pas la permission de créer des salons."
            );
          }

          const nomTicket =
            `ticket-${interaction.user.id}`;

          const existant =
            guild.channels.cache.find(
              channel =>
                channel.name ===
                nomTicket
            );

          if (existant) {

            return interaction.editReply(
              `💫 Tu as déjà un ticket ouvert : ${existant}`
            );
          }

          let categorie =
            guild.channels.cache.find(
              channel =>
                channel.name ===
                  "🎫 TICKETS" &&
                channel.type ===
                  ChannelType.GuildCategory
            );

          if (!categorie) {

            categorie =
              await guild.channels.create({
                name:
                  "🎫 TICKETS",
                type:
                  ChannelType.GuildCategory
              });
          }

          const roleStaff =
            guild.roles.cache.find(
              role =>
                role.name.toLowerCase() ===
                "staff"
            );

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

          if (roleStaff) {

            permissions.push({
              id:
                roleStaff.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels
              ]
            });
          }

          const ticket =
            await guild.channels.create({
              name:
                nomTicket,
              type:
                ChannelType.GuildText,
              parent:
                categorie.id,
              permissionOverwrites:
                permissions
            });

          const fermer =
            new ButtonBuilder()
              .setCustomId(
                "fermer_ticket"
              )
              .setLabel(
                "Fermer le ticket"
              )
              .setEmoji("🔒")
              .setStyle(
                ButtonStyle.Danger
              );

          const row =
            new ActionRowBuilder()
              .addComponents(
                fermer
              );

          await ticket.send({
            content:
              `🛟 **Bienvenue dans ton ticket !** 🌙\n\n` +
              `✨ Explique tranquillement ta demande.\n` +
              `Un membre de l'équipe viendra te répondre dès que possible. 💫`,
            components: [row]
          });

          return interaction.editReply(
            `✨ Ton ticket est prêt : ${ticket}`
          );

        } catch (erreur) {

          console.error(
            "❌ ERREUR CRÉATION TICKET :",
            erreur
          );

          return interaction.editReply(
            "💫 Une petite erreur est survenue lors de la création du ticket."
          );
        }
      }
    }

    // =================================================
    // 🔒 FERMER TICKET
    // =================================================

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
            "🌙 Seuls les membres de l'équipe peuvent fermer ce ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Le ticket va se fermer doucement..."
      );

      setTimeout(
        async () => {

          await interaction.channel
            .delete()
            .catch(() => {});

        },
        2000
      );
    }
  }
);

// =====================================================
// 🤖 CONNEXION
// =====================================================

client.login(
  process.env.DISCORD_TOKEN
);
