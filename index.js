require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActivityType,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const config = require("./config.json");
const { askAI } = require("./ai/brain");
const { isCooldown, getRemaining } = require("./utils/cooldown");

const app = express();

app.get("/", (req, res) => {
  res.send("BEKIW OT V3 ONLINE");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Railway Web Server Aktif");
});

process.on("unhandledRejection", (reason) => {
  console.log("UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION:", err);
});

const suggestionVotes = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function color() {
  const raw = String(config.embedColor || "#FFFFFF").replace("#", "");
  const parsed = Number.parseInt(raw, 16);
  return Number.isNaN(parsed) ? 0xffffff : parsed;
}

function isFilledId(id) {
  return Boolean(id && !String(id).includes("ISI_") && !String(id).includes("ID_"));
}

function getTextChannel(guild, id) {
  if (!guild || !isFilledId(id)) return null;
  return guild.channels.cache.get(id) || null;
}

function trimReply(text) {
  const max = config.ai?.maxMessageLength || 1900;
  if (!text) return "Bekiw belum nemu jawaban yang pas 😭";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 25)}\n\n...(dipendekin biar muat)`;
}

async function safeReply(message, payload) {
  try {
    return await message.reply(payload);
  } catch {
    try {
      return await message.channel.send(payload);
    } catch (err) {
      console.log("SAFE REPLY ERROR:", err.message);
    }
  }
}

async function safeSend(channel, payload) {
  try {
    if (!channel) return null;
    return await channel.send(payload);
  } catch (err) {
    console.log("SAFE SEND ERROR:", err.message);
    return null;
  }
}



function anonimPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("curhat_anonim_open")
      .setLabel("Curhat Yu")
      .setEmoji("☁️")
      .setStyle(ButtonStyle.Secondary)
  );
}

function anonimPostRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("curhat_anonim_open")
      .setLabel("Curhat Yu")
      .setEmoji("☁️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("curhat_anonim_reply")
      .setLabel("Balas")
      .setEmoji("💬")
      .setStyle(ButtonStyle.Primary)
  );
}

async function sendAnonimPanel(channel) {
  if (!channel) return;

  try {
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    const alreadyHasPanel = recent?.some((msg) =>
      msg.author?.id === client.user.id &&
      msg.embeds?.[0]?.footer?.text?.includes("PANEL_CURHAT_ANONIM")
    );

    if (alreadyHasPanel) return;

    const embed = new EmbedBuilder()
      .setColor(color())
      .setTitle("☁️ Curhat Anonim ORANG TULUS")
      .setDescription(
        "Punya sesuatu yang ingin kamu ceritakan tanpa menampilkan identitas?\n\n" +
        "Klik tombol **☁️ Curhat Yu** di bawah ini. Curhatan kamu akan dikirim sebagai **Anonymous** dan warga bisa membalas lewat thread diskusi 🤍"
      )
      .setFooter({ text: "Bekiw OT V3 • PANEL_CURHAT_ANONIM" })
      .setTimestamp();

    await safeSend(channel, {
      embeds: [embed],
      components: [anonimPanelRow()]
    });
  } catch (err) {
    console.log("SEND ANONIM PANEL ERROR:", err.message);
  }
}




async function safeShowModal(interaction, modal) {
  try {
    if (!interaction || interaction.replied || interaction.deferred) return false;
    await interaction.showModal(modal);
    return true;
  } catch (err) {
    console.log("SHOW MODAL ERROR:", err.code || err.message);

    // 10062 = Unknown interaction, biasanya tombol sudah kedaluwarsa / telat diproses.
    // Jangan throw lagi supaya bot tidak crash.
    return false;
  }
}

function suggestionRow(yes = 0, no = 0) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("vote_yes")
      .setLabel(`Setuju (${yes})`)
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("vote_no")
      .setLabel(`Tidak Setuju (${no})`)
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("open_suggestion")
      .setLabel("Kasih Saran")
      .setEmoji("💡")
      .setStyle(ButtonStyle.Secondary)
  );
}


async function setupJuraganChannels(guild) {
  try {
    if (!config.juragan?.enabled) return;
    if (!isFilledId(config.juragan.roleId)) return;

    const roleId = config.juragan.roleId;

    let textCategory = guild.channels.cache.find(
      (c) => c.name === "💎｜OBROLAN JURAGAN" && c.type === ChannelType.GuildCategory
    );

    if (!textCategory) {
      textCategory = await guild.channels.create({
        name: "💎｜OBROLAN JURAGAN",
        type: ChannelType.GuildCategory
      });
    }

    const textPerms = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AddReactions
        ]
      }
    ];

    const voicePerms = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.UseVAD
        ]
      }
    ];

    const textChannels = [
      { name: "👋・welcome-juragan", topic: "Tempat menyambut Juragan baru ORANG TULUS." },
      { name: "💬・chat-juragan", topic: "Ruang ngobrol khusus Juragan ORANG TULUS." },
      { name: config.juragan.aiChannelName || "🤖・ai-juragan", topic: "AI premium khusus Juragan ORANG TULUS." },
      { name: "📢・info-juragan", topic: "Informasi khusus role Juragan." },
      { name: "🎁・benefit-juragan", topic: "Daftar benefit dan privilege Juragan." },
      { name: "📸・media-juragan", topic: "Tempat share media khusus Juragan." },
      { name: "💡・saran-juragan", topic: "Tempat ide dan masukan khusus Juragan." }
    ];

    for (const ch of textChannels) {
      const exists = guild.channels.cache.find(
        (c) => c.name === ch.name && c.type === ChannelType.GuildText
      );

      if (!exists) {
        await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          parent: textCategory.id,
          topic: ch.topic,
          permissionOverwrites: textPerms
        });
      }
    }

    let voiceCategory = guild.channels.cache.find(
      (c) => c.name === "🔊｜VOICE JURAGAN" && c.type === ChannelType.GuildCategory
    );

    if (!voiceCategory) {
      voiceCategory = await guild.channels.create({
        name: "🔊｜VOICE JURAGAN",
        type: ChannelType.GuildCategory
      });
    }

    const voiceChannels = [
      { name: "🔊・Voice Juragan", userLimit: 10 },
      { name: "🎮・Gaming Juragan", userLimit: 8 },
      { name: "🎵・Music Juragan", userLimit: 10 },
      { name: "😴・AFK Juragan", userLimit: 10 }
    ];

    for (const ch of voiceChannels) {
      const exists = guild.channels.cache.find(
        (c) => c.name === ch.name && c.type === ChannelType.GuildVoice
      );

      if (!exists) {
        await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildVoice,
          parent: voiceCategory.id,
          bitrate: Math.min(guild.maximumBitrate || 96000, 96000),
          userLimit: ch.userLimit,
          permissionOverwrites: voicePerms
        });
      }
    }

    console.log(`✅ Channel Juragan siap di server ${guild.name}`);
  } catch (err) {
    console.log("SETUP JURAGAN CHANNEL ERROR:", err.message);
  }
}


client.once(Events.ClientReady, async () => {
  console.log(`🤍 ${client.user.tag} ONLINE sebagai Bekiw OT V3`);

  client.user.setPresence({
    activities: [{
      name: config.activityText || "ORANG TULUS 🤍",
      type: ActivityType.Watching
    }],
    status: "online"
  });


  for (const guild of client.guilds.cache.values()) {
    await setupJuraganChannels(guild);
  }


  const anonimChannel = client.channels.cache.get(config.anonymousCurhatChannelId);
  if (anonimChannel) {
    await sendAnonimPanel(anonimChannel);
  }

  if (config.panels?.sendSuggestionPanelOnReady && isFilledId(config.suggestionChannelId)) {
    const channel = client.channels.cache.get(config.suggestionChannelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(color())
        .setTitle(config.suggestion?.title || "💡 ORANG TULUS • Kritik & Saran")
        .setDescription(config.suggestion?.description || "Klik tombol di bawah untuk mengirim saran.")
        .setFooter({ text: "Bekiw OT V3 • Sistem Saran" })
        .setTimestamp();

      await safeSend(channel, {
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("open_suggestion")
              .setLabel("Kasih Saran")
              .setEmoji("💡")
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }
  }
});

// ================= WELCOME MEMBER =================
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (!config.welcome?.enabled) return;

    const targetId = config.welcome.sendToChatWarga
      ? config.chatWargaChannelId
      : config.welcomeChannelId;

    const channel = getTextChannel(member.guild, targetId);
    if (!channel) {
      console.log("WELCOME: channel belum diisi atau tidak ditemukan.");
      return;
    }

    const description = String(config.welcome.message || "Halo {user}, selamat datang di **{server} 🤍**")
      .replaceAll("{user}", `${member}`)
      .replaceAll("{server}", config.serverName)
      .replaceAll("{memberCount}", `${member.guild.memberCount}`);

    const embed = new EmbedBuilder()
      .setColor(color())
      .setAuthor({
        name: `${config.serverName} • Warga Baru`,
        iconURL: member.user.displayAvatarURL({ dynamic: true })
      })
      .setTitle(config.welcome.title || "👋 Warga Baru Datang!")
      .setDescription(description)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setFooter({ text: "ORANG TULUS • Tempat warga baik berkumpul" })
      .setTimestamp();

    await safeSend(channel, {
      content: `🤍 Sambut warga baru kita ${member}!`,
      embeds: [embed]
    });

  } catch (err) {
    console.log("WELCOME ERROR:", err);
  }
});


function juraganEmbed(member) {
  return new EmbedBuilder()
    .setColor(0xff4fd8)
    .setAuthor({
      name: `${config.serverName} • Juragan Baru`,
      iconURL: member.user.displayAvatarURL({ dynamic: true })
    })
    .setTitle("💎 SELAMAT DATANG JURAGAN! 💎")
    .setDescription(
      `Terima kasih sudah mendukung server ini ${member}.\n` +
      `Sekarang kamu dapat menikmati benefit dari role **Juragan OT**:\n\n` +
      `➤ 🏆 Display role di member list\n` +
      `➤ 🎨 Role spesial Juragan\n` +
      `➤ ⚡ Bonus point extra **+15%**\n` +
      `➤ 🤖 Akses **AI Juragan Premium**\n` +
      `➤ 🔐 Akses ke voice channel VIP\n` +
      `➤ 💬 Akses ke text channel Juragan\n` +
      `➤ 🎁 Akses giveaway spesial\n\n` +
      `Selamat menikmati benefit Juragan. Kamu keren banget 😎`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .setFooter({ text: `${config.serverName} • Juragan System` })
    .setTimestamp();
}

async function sendJuraganWelcome(member) {
  const boostChannel = getTextChannel(member.guild, config.juragan?.boostChannelId);

  if (!boostChannel) {
    console.log("BOOST CHANNEL ERROR: boostChannelId belum valid atau bot tidak bisa akses channel.");
    return false;
  }

  await safeSend(boostChannel, {
    content: `💎 ${member} baru saja menjadi **Juragan OT**!`,
    embeds: [juraganEmbed(member)]
  });

  return true;
}


// ================= AUTO BOOST / JURAGAN =================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    if (!config.juragan?.enabled) return;

    const baruBoost = !oldMember.premiumSince && newMember.premiumSince;
    if (!baruBoost) return;

    const role = isFilledId(config.juragan.roleId)
      ? newMember.guild.roles.cache.get(config.juragan.roleId)
      : null;

    if (role) {
      await newMember.roles.add(role).catch((err) => {
        console.log("ROLE JURAGAN ERROR:", err.message);
      });
    }

    await sendJuraganWelcome(newMember);

    let category = newMember.guild.channels.cache.find(
      (c) => c.name === config.juragan.categoryName &&
      c.type === ChannelType.GuildCategory
    );

    if (!category) {
      category = await newMember.guild.channels.create({
        name: config.juragan.categoryName || "💎｜JURAGAN OT",
        type: ChannelType.GuildCategory
      });
    }

    const textExists = newMember.guild.channels.cache.find(
      (c) => c.name === "💬・chat-juragan" && c.type === ChannelType.GuildText
    );

    if (!textExists) {
      await newMember.guild.channels.create({
        name: "💬・chat-juragan",
        type: ChannelType.GuildText,
        parent: category.id,
        topic: "Ruang ngobrol khusus Juragan ORANG TULUS.",
        permissionOverwrites: [
          {
            id: newMember.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: config.juragan.roleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.AddReactions
            ]
          }
        ]
      });
    }


    const aiJuraganExists = newMember.guild.channels.cache.find(
      (c) => c.name === (config.juragan.aiChannelName || "🤖・ai-juragan") && c.type === ChannelType.GuildText
    );

    if (!aiJuraganExists) {
      await newMember.guild.channels.create({
        name: config.juragan.aiChannelName || "🤖・ai-juragan",
        type: ChannelType.GuildText,
        parent: category.id,
        topic: "AI premium khusus Juragan ORANG TULUS.",
        permissionOverwrites: [
          {
            id: newMember.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: config.juragan.roleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.AddReactions
            ]
          }
        ]
      });
    }

    const voiceExists = newMember.guild.channels.cache.find(
      (c) => c.name === "🔊・Voice Juragan" && c.type === ChannelType.GuildVoice
    );

    if (!voiceExists) {
      await newMember.guild.channels.create({
        name: "🔊・Voice Juragan",
        type: ChannelType.GuildVoice,
        parent: category.id,
        bitrate: Math.min(newMember.guild.maximumBitrate || 96000, 96000),
        userLimit: 10,
        permissionOverwrites: [
          {
            id: newMember.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: config.juragan.roleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.UseVAD
            ]
          }
        ]
      });
    }

  } catch (err) {
    console.log("BOOST ERROR:", err);
  }
});

// ================= MESSAGE COMMAND + AI =================
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    const prefix = config.prefix || "!";
    const lower = message.content.toLowerCase();

    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const cmd = (args.shift() || "").toLowerCase();

      if (cmd === "ping") {
        return safeReply(message, `🏓 Pong! Ping bot: **${client.ws.ping}ms**`);
      }

      if (cmd === "status") {
        const embed = new EmbedBuilder()
          .setColor(color())
          .setTitle("🤖 Bekiw OT V3 Status")
          .setDescription(
            `✅ Bot online dan stabil\n` +
            `🏠 Server: **${message.guild.name}**\n` +
            `👥 Member: **${message.guild.memberCount}**\n` +
            `⚡ Ping: **${client.ws.ping}ms**\n` +
            `💬 AI Channel: ${isFilledId(config.aiChannelId) ? `<#${config.aiChannelId}>` : "belum diisi"}\n` +
            `💡 Saran: ${config.suggestion?.enabled ? "aktif" : "mati"}\n` +
            `💎 Juragan: ${config.juragan?.enabled ? "aktif" : "mati"}`
          )
          .setFooter({ text: "Bekiw OT V3 • ORANG TULUS" })
          .setTimestamp();

        return safeReply(message, { embeds: [embed] });
      }


      if (cmd === "testboost") {
        if (!config.juragan?.enabled) {
          return safeReply(message, "Fitur Juragan sedang dimatikan di config.");
        }

        const role = isFilledId(config.juragan.roleId)
          ? message.guild.roles.cache.get(config.juragan.roleId)
          : null;

        if (role && !message.member.roles.cache.has(role.id)) {
          await message.member.roles.add(role).catch((err) => {
            console.log("TESTBOOST ROLE ERROR:", err.message);
          });
        }

        await sendJuraganWelcome(message.member);

        return safeReply(message, "✅ Test boost Juragan dikirim. Cek channel boost/Juragan OT.");
      }

      if (cmd === "help") {
        return safeReply(message, [
          "🤍 **Bekiw OT V3 Help**",
          "",
          "`!ping` - cek ping bot",
          "`!status` - cek status bot",
          "`!testboost` - test embed/role Juragan",
          "`!help` - lihat bantuan",
          "`!saran` - kirim panel saran di channel ini\n`!anonim` - tampilkan panel curhat anonim",
          "",
          "AI aktif di channel AI, channel curhat, atau saat bot di-mention.",
          "Fitur Juragan aktif otomatis saat ada member boost server."
        ].join("\n"));
      }

      if (cmd === "saran") {
        if (!config.suggestion?.enabled) {
          return safeReply(message, "Fitur saran sedang dimatikan di config.");
        }

        const embed = new EmbedBuilder()
          .setColor(color())
          .setTitle(config.suggestion?.title || "💡 ORANG TULUS • Kritik & Saran")
          .setDescription(config.suggestion?.description || "Klik tombol di bawah untuk mengirim saran.")
          .setFooter({ text: "Bekiw OT V3 • Sistem Saran" })
          .setTimestamp();

        return safeReply(message, {
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("open_suggestion")
                .setLabel("Kasih Saran")
                .setEmoji("💡")
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      if (cmd === "anonim" || cmd === "curhatanonim") {
        const embed = new EmbedBuilder()
          .setColor(color())
          .setTitle("☁️ Curhat Anonim ORANG TULUS")
          .setDescription(
            "Klik tombol **☁️ Curhat Yu** di bawah ini untuk mengirim curhatan anonim.\n\n" +
            "Identitas kamu tidak akan ditampilkan. Curhatan akan masuk sebagai **Anonymous** 🤍"
          )
          .setFooter({ text: "Bekiw OT V3 • Curhat Anonim" })
          .setTimestamp();

        return safeReply(message, {
          embeds: [embed],
          components: [anonimPanelRow()]
        });
      }

    }
    const mentioned = message.mentions.has(client.user);
    const inAiChannel = message.channel.id === config.aiChannelId;
    const inCurhatChannel = message.channel.id === config.curhatChannelId;
    const inJuraganAi = message.channel.name === (config.juragan?.aiChannelName || "🤖・ai-juragan");

    if (!inAiChannel && !inCurhatChannel && !inJuraganAi && !mentioned) return;

    const cooldownMs = config.ai?.cooldownMs || 4500;
    if (isCooldown(message.author.id, cooldownMs)) {
      const sisa = getRemaining(message.author.id);
      return safeReply(message, `⏳ Tunggu **${sisa} detik** dulu sebelum chat Bekiw lagi ya.`);
    }

    await message.channel.sendTyping();

    let clean = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .trim();

    if (!clean && mentioned) clean = "halo";

    if (lower.includes("owner") || lower.includes("pemilik")) {
      return safeReply(message, `👑 Owner **${config.serverName}** adalah **${config.ownerName}** 🤍`);
    }

    let mode = inCurhatChannel ? "curhat" : "normal";
    if (inJuraganAi) mode = "juragan";
    const reply = await askAI(clean || "halo", mode);

    return safeReply(message, trimReply(reply));
  } catch (err) {
    console.log("MESSAGE ERROR:", err);
    return safeReply(message, "Maaf ya, Bekiw lagi error sebentar. Coba lagi nanti 🤍");
  }
});

// ================= INTERACTION SARAN =================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {


      if (interaction.customId === "curhat_anonim_open" || interaction.customId === "open_anonim_curhat") {
        const modal = new ModalBuilder()
          .setCustomId("anonim_curhat_modal")
          .setTitle("Curhat Anonim ORANG TULUS");

        const contentInput = new TextInputBuilder()
          .setCustomId("anonim_content")
          .setLabel("Isi curhat")
          .setPlaceholder("Tulis curhatan kamu di sini. Identitas kamu tidak akan ditampilkan.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1200)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(contentInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "curhat_anonim_reply") {
        const msg = interaction.message;

        let thread = null;
        if (msg.hasThread && msg.thread) {
          thread = msg.thread;
        } else {
          thread = await msg.startThread({
            name: "💬 Diskusi Curhat",
            autoArchiveDuration: 1440,
            reason: "Thread diskusi curhat anonim"
          }).catch(() => null);
        }

        if (!thread) {
          return interaction.reply({
            content: "❌ Bekiw belum bisa membuat thread. Pastikan bot punya izin Create Public Threads dan Send Messages in Threads.",
            flags: 64
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`anonim_reply_modal_${msg.id}`)
          .setTitle("Balas Curhat Anonim");

        const replyInput = new TextInputBuilder()
          .setCustomId("anonim_reply_content")
          .setLabel("Isi balasan")
          .setPlaceholder("Tulis balasan kamu dengan sopan. Identitas kamu tidak akan ditampilkan.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(replyInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "open_suggestion") {
        if (!config.suggestion?.enabled) {
          return interaction.reply({ content: "Fitur saran sedang dimatikan.", flags: 64 });
        }

        const modal = new ModalBuilder()
          .setCustomId("suggestion_modal")
          .setTitle("Kasih Saran ORANG TULUS");

        const titleInput = new TextInputBuilder()
          .setCustomId("suggestion_title")
          .setLabel("Judul saran")
          .setPlaceholder("Contoh: tambah channel rekomendasi film")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true);

        const contentInput = new TextInputBuilder()
          .setCustomId("suggestion_content")
          .setLabel("Isi saran")
          .setPlaceholder("Tulis saran kamu dengan jelas dan sopan")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(900)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(contentInput)
        );

        return safeShowModal(interaction, modal);
      }

      if (interaction.customId === "vote_yes" || interaction.customId === "vote_no") {
        const messageId = interaction.message.id;
        const userId = interaction.user.id;

        if (!suggestionVotes.has(messageId)) {
          suggestionVotes.set(messageId, { yes: new Set(), no: new Set() });
        }

        const data = suggestionVotes.get(messageId);

        if (interaction.customId === "vote_yes") {
          data.no.delete(userId);
          data.yes.add(userId);
        } else {
          data.yes.delete(userId);
          data.no.add(userId);
        }

        return interaction.update({
          components: [suggestionRow(data.yes.size, data.no.size)]
        });
      }
    }
    if (interaction.isModalSubmit() && interaction.customId === "anonim_curhat_modal") {
      await interaction.deferReply({ flags: 64 });

      const content = interaction.fields.getTextInputValue("anonim_content");

      const targetChannel = getTextChannel(interaction.guild, config.anonymousCurhatChannelId) || interaction.channel;

      const embed = new EmbedBuilder()
        .setColor(color())
        .setTitle("☁️ Pesan Curhat")
        .setDescription(content.slice(0, 1200))
        .setFooter({ text: "☁️ Anonymous" })
        .setTimestamp();

      const sent = await safeSend(targetChannel, {
        embeds: [embed],
        components: [anonimPostRow()]
      });

      if (sent) {
        const thread = await sent.startThread({
          name: "💬 Diskusi Curhat",
          autoArchiveDuration: 1440,
          reason: "Thread diskusi curhat anonim"
        }).catch(() => null);

        if (thread) {
          await thread.send("Thread ini dibuat untuk diskusi curhat anonim. Jawab dengan baik, sopan, dan jangan menghakimi 🤍").catch(() => {});
        }
      }

      return interaction.editReply({
        content: "✅ Curhat kamu sudah terkirim sebagai Anonymous 🤍"
      });
    }



    if (interaction.isModalSubmit() && interaction.customId.startsWith("anonim_reply_modal_")) {
      await interaction.deferReply({ flags: 64 });

      const messageId = interaction.customId.replace("anonim_reply_modal_", "");
      const content = interaction.fields.getTextInputValue("anonim_reply_content");

      const targetChannel = getTextChannel(interaction.guild, config.anonymousCurhatChannelId) || interaction.channel;

      const curhatMessage = await targetChannel.messages.fetch(messageId).catch(() => null);

      let thread = curhatMessage?.thread || null;
      if (!thread && curhatMessage) {
        thread = await curhatMessage.startThread({
          name: "💬 Diskusi Curhat",
          autoArchiveDuration: 1440,
          reason: "Thread diskusi balasan anonim"
        }).catch(() => null);
      }

      if (!thread) {
        return interaction.editReply({
          content: "❌ Bekiw belum bisa menemukan thread curhat ini. Coba klik tombol Balas dari pesan curhat yang masih ada."
        });
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(color())
        .setTitle("💬 Balasan Anonim")
        .setDescription(content.slice(0, 1000))
        .setFooter({ text: "☁️ Anonymous Reply" })
        .setTimestamp();

      await thread.send({ embeds: [replyEmbed] }).catch(() => null);

      return interaction.editReply({
        content: "✅ Balasan kamu sudah terkirim sebagai Anonymous 🤍"
      });
    }

    if (interaction.isModalSubmit() && interaction.customId === "suggestion_modal") {
      const title = interaction.fields.getTextInputValue("suggestion_title");
      const content = interaction.fields.getTextInputValue("suggestion_content");

      const embed = new EmbedBuilder()
        .setColor(color())
        .setTitle("💡 Saran Baru ORANG TULUS")
        .setDescription("Ada saran baru dari warga. Silakan vote dan diskusikan dengan baik 🤍")
        .addFields(
          { name: "Judul", value: title.slice(0, 1024) },
          { name: "Isi Saran", value: content.slice(0, 1024) },
          { name: "Pengirim", value: `${interaction.user}` }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: "Vote saran ini dengan tombol di bawah" })
        .setTimestamp();

      const suggestionChannel = getTextChannel(interaction.guild, config.suggestionChannelId) || interaction.channel;
      const sent = await safeSend(suggestionChannel, {
        embeds: [embed],
        components: [suggestionRow(0, 0)]
      });

      if (sent) suggestionVotes.set(sent.id, { yes: new Set(), no: new Set() });

      return interaction.reply({
        content: "✅ Saran kamu berhasil dikirim. Makasih sudah bantu bikin server makin bagus 🤍",
        flags: 64
      });
    }
  } catch (err) {
    console.log("INTERACTION ERROR:", err.code || err.message);

    // 10062 = Unknown interaction. Token tombol/modal sudah expired.
    // Jangan paksa reply karena pasti gagal dan bisa bikin error berulang.
    if (err.code === 10062) return;

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content: "Terjadi error sebentar ya. Coba klik tombol dari panel baru.", flags: 64 }).catch(() => {});
    }

    return interaction.reply({ content: "Terjadi error sebentar ya. Coba klik tombol dari panel baru.", flags: 64 }).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.log("❌ DISCORD_TOKEN belum diisi di .env atau Railway Variables.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
