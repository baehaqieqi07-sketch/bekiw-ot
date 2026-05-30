const axios = require("axios");
const config = require("../config.json");

function cleanText(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function channelMention(id, fallback) {
  if (!id || id.includes("ISI_") || id.includes("ID_")) return fallback;
  return `<#${id}>`;
}

function hasAny(msg, words) {
  return words.some((word) => msg.includes(word));
}

function makeHelpfulAnswer(userText, mode = "normal") {
  const text = cleanText(userText);
  const msg = text.toLowerCase();

  if (mode === "juragan") {
    return [
      "💎 **Halo Juragan, Bekiw OT Premium siap bantu.**",
      "",
      `Aku paham kamu lagi bahas: **${text || "sesuatu yang ingin kamu tanyakan"}**`,
      "",
      "Biar jawabannya tepat dan nggak ngasal, Bekiw akan bantu dengan cara yang rapi:",
      "➤ jelaskan masalah atau tujuan kamu dulu",
      "➤ kasih detail channel/role/fitur yang dimaksud",
      "➤ kalau ada error, kirim teks errornya",
      "",
      "Kalau kamu mau setting server, fitur Discord, ide event, benefit Juragan, atau perbaikan bot, Bekiw bisa bantu susun step-by-step sampai jelas 😎"
    ].join("\n");
  }

  if (!msg || hasAny(msg, ["halo", "hai", "hi", "p", "woi"])) {
    return [
      "Halo, aku **Bekiw OT V3** 🤍",
      "",
      `Aku siap bantu warga **${config.serverName}** dengan jawaban yang jelas, rapi, dan gampang dipahami.`,
      "",
      "Kamu bisa tanya soal server, rules, ticket, boost Juragan, fitur Discord, ide channel, bot, atau ngobrol santai. Tulis aja pertanyaannya, nanti Bekiw bantu jawab sebaik mungkin."
    ].join("\n");
  }

  if (hasAny(msg, ["owner", "pemilik", "punya siapa"])) {
    return [
      `👑 Owner **${config.serverName}** adalah **${config.ownerName}** 🤍`,
      "",
      "Kalau kamu butuh bantuan penting soal server, kamu bisa hubungi owner atau staff yang sedang aktif."
    ].join("\n");
  }

  if (hasAny(msg, ["rules", "rule", "aturan", "peraturan"])) {
    return [
      `📌 Rules server bisa kamu cek di ${channelMention(config.rulesChannelId, "channel rules")}.`,
      "",
      "Saran Bekiw, baca pelan-pelan dulu supaya kamu paham batasan server dan bisa nyaman ngobrol bareng warga lain. Kalau ada aturan yang kurang jelas, tanya staff aja dengan sopan ya 🤍"
    ].join("\n");
  }

  if (hasAny(msg, ["ticket", "bantuan", "lapor", "report", "masalah"])) {
    return [
      `🎫 Kalau butuh bantuan, report, atau urusan private, kamu bisa buka ticket di ${channelMention(config.ticketChannelId, "channel ticket")}.`,
      "",
      "Biar cepat dibantu, tulis masalahnya dengan jelas: apa yang terjadi, siapa yang terlibat, dan bukti kalau ada. Jangan spam ticket ya 🤍"
    ].join("\n");
  }

  if (hasAny(msg, ["boost", "juragan", "booster", "sultan"])) {
    return [
      "💎 **Juragan OT** adalah benefit spesial untuk warga yang boost server.",
      "",
      "Kalau kamu boost, sistem Bekiw akan otomatis memberi role Juragan, mengirim ucapan terima kasih, dan membuka akses ke ruang khusus Juragan seperti chat, voice, dan AI Juragan.",
      "",
      "Benefit ini dibuat sebagai bentuk terima kasih karena kamu sudah bantu support **ORANG TULUS** 🤍"
    ].join("\n");
  }

  if (hasAny(msg, ["saran", "kritik", "ide", "masukan"])) {
    return [
      "💡 Kalau kamu punya kritik atau saran, tulis dengan jelas dan sopan ya.",
      "",
      "Saran yang bagus biasanya berisi:",
      "➤ masalah yang ingin diperbaiki",
      "➤ ide solusinya",
      "➤ alasan kenapa itu bagus buat server",
      "",
      `Kirim lewat channel saran: ${channelMention(config.suggestionChannelId, "channel kritik & saran")} 🤍`
    ].join("\n");
  }

  if (hasAny(msg, ["event", "giveaway", "acara"])) {
    return [
      `🎉 Info event atau giveaway biasanya diumumkan di ${channelMention(config.eventChannelId, "channel pengumuman/event")}.`,
      "",
      "Kalau belum ada event aktif, tunggu update dari staff. Kamu juga boleh kasih ide event lewat fitur saran."
    ].join("\n");
  }

  return [
    `Aku paham kamu bertanya tentang: **${text}**`,
    "",
    "Jawaban Bekiw:",
    "Aku belum punya data spesifik yang cukup untuk memastikan jawaban paling tepat. Tapi aku bisa bantu arahin dengan cara yang jelas.",
    "",
    "Coba jelaskan sedikit lebih detail, misalnya:",
    "➤ ini masalah di Discord, bot, server, atau fitur tertentu?",
    "➤ kamu ingin cara setting, contoh teks, atau perbaikan code?",
    "➤ error yang muncul seperti apa?",
    "",
    "Nanti Bekiw bantu jawab lebih panjang, rapi, dan sesuai kebutuhan kamu 🤍"
  ].join("\n");
}

function makeCurhatAnswer(userText) {
  const text = cleanText(userText);

  return [
    "Aku dengerin ya 🤍",
    "",
    "Makasih sudah mau cerita. Perasaan yang lagi berat itu valid, dan kamu nggak harus langsung kuat saat itu juga. Pelan-pelan aja, yang penting kamu punya tempat buat ngeluarin isi pikiran dengan aman.",
    "",
    `Dari yang kamu ceritain, aku nangkep intinya tentang: **${text || "perasaan yang lagi kamu pendam"}**.`,
    "",
    "Coba kita urutin pelan-pelan:",
    "➤ Apa yang paling bikin kamu kepikiran?",
    "➤ Itu terjadi baru-baru ini atau sudah lama?",
    "➤ Kamu lebih butuh didengerin dulu, atau mau Bekiw bantu cari solusi?",
    "",
    "Cerita sedikit demi sedikit juga nggak apa-apa. Bekiw bakal jawab dengan lembut dan nggak nge-judge."
  ].join("\n");
}

function localFallback(text = "", mode = "normal") {
  if (mode === "curhat") return makeCurhatAnswer(text);
  return makeHelpfulAnswer(text, mode);
}

async function askAI(text, mode = "normal") {
  const userText = cleanText(text);

  if (!userText) {
    return localFallback("halo", mode);
  }

  if (!process.env.AI_KEY) {
    return localFallback(userText, mode);
  }

  const systemPrompt =
    mode === "curhat"
      ? [
          `Kamu adalah Bekiw OT V3, teman curhat di server ${config.serverName}.`,
          `Owner server adalah ${config.ownerName}.`,
          "Jawab dalam bahasa Indonesia yang natural, rapi, panjang secukupnya, empati, dan tidak menghakimi.",
          "Jangan mengarang fakta pribadi user. Kalau tidak tahu, bilang belum tahu dengan sopan.",
          "Bantu user memahami perasaannya dengan aman. Jangan memberi instruksi berbahaya.",
          "Akhiri dengan pertanyaan lembut agar user bisa lanjut cerita."
        ].join(" ")
      : mode === "juragan"
        ? [
            `Kamu adalah Bekiw OT V3 Premium khusus role Juragan di server ${config.serverName}.`,
            `Owner server adalah ${config.ownerName}.`,
            "Jawab bahasa Indonesia yang sangat jelas, rapi, natural, panjang secukupnya, dan terasa premium.",
            "Bantu user seperti asisten pintar: berikan langkah, contoh, alasan, dan tips jika perlu.",
            "Jangan ngasal. Kalau tidak yakin, jujur bilang belum tahu dan minta detail.",
            "Tetap ramah, santai, dan punya vibe Bekiw OT."
          ].join(" ")
        : [
            `Kamu adalah Bekiw OT V3, AI assistant server ${config.serverName}.`,
            `Owner server adalah ${config.ownerName}.`,
            "Jawab bahasa Indonesia yang jelas, panjang secukupnya, natural, rapi, dan tanpa typo.",
            "Kalau user bertanya tentang server, gunakan konteks berikut:",
            `AI channel: ${channelMention(config.aiChannelId, "channel AI")}.`,
            `Curhat channel: ${channelMention(config.curhatChannelId, "channel curhat")}.`,
            `Saran channel: ${channelMention(config.suggestionChannelId, "channel kritik & saran")}.`,
            `Ticket channel: ${channelMention(config.ticketChannelId, "channel ticket")}.`,
            "Jangan ngasal. Kalau tidak yakin, jujur bilang belum tahu dan minta detail yang dibutuhkan.",
            "Gunakan gaya ramah khas Bekiw OT, tapi tetap informatif."
          ].join(" ");

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: config.ai?.openRouterModel || "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
        temperature: mode === "curhat" ? 0.7 : 0.55,
        max_tokens: mode === "juragan" ? 750 : 650
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/",
          "X-Title": "Bekiw OT V3"
        },
        timeout: 25000
      }
    );

    return res.data?.choices?.[0]?.message?.content?.trim() || localFallback(userText, mode);
  } catch (err) {
    console.log("AI ERROR:", err.response?.data || err.message);
    return localFallback(userText, mode);
  }
}

module.exports = { askAI };
