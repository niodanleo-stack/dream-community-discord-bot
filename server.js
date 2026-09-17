const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits
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

client.once("ready", () => {
  console.log("Dream Community connecte en tant que " + client.user.tag);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const contenu = message.content.toLowerCase();

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

  if (contenu === "!dream") {
    return message.reply(
      "🌙 **DREAM COMMUNITY — SAISON 3** 🌙\n\n" +
      "Une communaute pour discuter, partager et participer a des evenements !\n\n" +
      "🔨 Saison 3 : en construction !"
    );
  }

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

client.login(process.env.DISCORD_TOKEN);
