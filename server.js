const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`🌙 Dream Community connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const contenu = message.content.toLowerCase();

  // 📜 RÈGLEMENT
  if (contenu === "!reglement") {
    return message.reply(
      "📜 **RÈGLEMENT — DREAM COMMUNITY**\n\n" +
      "🤝 Respect obligatoire\n" +
      "🚫 Pas de harcèlement\n" +
      "🚫 Pas d'insultes ou menaces\n" +
      "🚫 Pas de spam\n" +
      "🔞 Pas de contenu inapproprié\n" +
      "⚠️ Le Staff peut sanctionner en cas d'infraction."
    );
  }

  // 🌙 INFORMATIONS
  if (contenu === "!dream") {
    return message.reply(
      "🌙✨ **DREAM COMMUNITY — SAISON 3** ✨🌙\n\n" +
      "Une communauté pour discuter, partager et participer à des événements !\n\n" +
      "🔨 Saison 3 : en construction !"
    );
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
      "Aucune raison précisée.";

    return message.reply(
      `⚠️ **Avertissement**\n${membre} a reçu un avertissement.\n📝 Raison : ${raison}`
    );
  }

  // 🔇 TIMEOUT
  if (contenu.startsWith("!mute ")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const membre = message.mentions.members.first();

    if (!membre) {
      return message.reply("❌ Mentionne un membre.");
    }

    try {
      await membre.timeout(10 * 60 * 1000, "Sanction Dream Community");

      return message.reply(
        `🔇 ${membre} a été mis en silence pendant **10 minutes**.`
      );
    } catch {
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
      return message.reply(`👢 ${membre.user.tag} a été expulsé.`);
    } catch {
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
      await membre.ban({ reason: "Sanction Dream Community" });
      return message.reply(`🚫 ${membre.user.tag} a été banni.`);
    } catch {
      return message.reply("❌ Impossible de bannir ce membre.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
