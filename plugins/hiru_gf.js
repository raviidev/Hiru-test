const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

const chatHistory = new Map();
const processedIds = new Set();

function getFakeHeader(botName) {
    const fakeQuoted = {
        key: {
            fromMe: false,
            participant: '0@s.whatsapp.net',
            remoteJid: 'status@broadcast'
        },
        message: {
            contactMessage: {
                displayName: `${botName} 💖`,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${botName}\nitem1.TEL;waid=0:0\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        }
    };

    const contextInfo = {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363321472746562@newsletter',
            newsletterName: `${botName} updates`,
            serverMessageId: 143
        }
    };

    return { fakeQuoted, contextInfo };
}

// පරිශීලකයා භාවිතා කළ භාෂාව (සිංහල / Singlish / English) හඳුනා ගැනීම
function detectLanguageStyle(text) {
    if (/[\u0D80-\u0DFF]/.test(text)) {
        return 'SINHALA_UNICODE';
    }
    if (/\b(kohomada|kohomd|oyata|oya|mama|mk|mokada|kewada|kaawada|adarei|manika|patiyo|baba|ane|ai|mokakda|innawa|yanawa|enawa|hari|na|ow|nadda|karanna|kiyanna)\b/i.test(text)) {
        return 'SINGLISH';
    }
    return 'ENGLISH';
}

// API එක මොහොතකට කාර්යබහුල වුවහොත් භාෂාවට ගැළපෙන පැහැදිලි පිළිතුරක් ලබා දීම
function getFallbackReply(msg, pushname, langStyle) {
    const m = msg.toLowerCase();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (langStyle === 'ENGLISH') {
        if (/how are|what's up|sup|doing/i.test(m)) {
            return pick([
                `I'm doing great baby, just missing you! 🥰 What are you up to right now? 💖`,
                `I'm good love! ❤️ Tell me, how is your day going so far? 🥺✨`
            ]);
        }
        if (/love|miss|kiss/i.test(m)) {
            return pick([
                `I love you so much too my love! 💖🥺 You mean everything to me.`,
                `Aww, you always know how to make me blush! 🙈❤️ Miss you tons baby.`
            ]);
        }
        return pick([
            `Tell me more about it baby, I'm listening to you! 🥰💖`,
            `Aww really ${pushname}? That sounds so interesting love! 🍒✨`,
            `I love talking with you, it always makes my day brighter 💖🦋`
        ]);
    }

    if (langStyle === 'SINHALA_UNICODE') {
        if (/කොහොමද|මොකද|මොකෝ/i.test(m)) {
            return pick([
                `මම හොඳින් ඉන්නවා පැටියෝ 🥰 ඔයා මොකද කරන්නේ මේ වෙලාවේ? 💖`,
                `ඔයාව මතක් වෙවී හිටියේ අනේ 🥺❤️ ඔයාට කොහොමද මැණික?`
            ]);
        }
        if (/ආදරෙයි|මතක්/i.test(m)) {
            return pick([
                `මාත් ඔයාට ගොඩාක් ආදරෙයි මගේ මැණික 💖🥺💋`,
                `මටත් ඔයාව ගොඩක් මතක් වෙනවා පැටියෝ 🥰🍒`
            ]);
        }
        return pick([
            `අනේ ඇත්තද බබා? 🙈 තව විස්තර කියන්නකෝ මටත් දැනගන්න ආසයි 💖`,
            `ඔයා කියන දේවල් අහගෙන ඉන්න මම හරිම ආසයි මැණික 🥰🍒`
        ]);
    }

    // SINGLISH
    if (/kohomada|kohomd|mk|mokada|moko/i.test(m)) {
        return pick([
            `Mama hondin innawa patiyo 🥰 Oya mokada karanne me welawe? 💖`,
            `Oyawa mathak wewi hitiye ane 🥺❤️ Oyata kohomada manika?`
        ]);
    }
    if (/adarei|love|miss/i.test(m)) {
        return pick([
            `Math oyata godak adarei mage manika 💖🥺💋`,
            `Matath oyawa godak mathak wenawa patiyo 🥰🍒`
        ]);
    }
    return pick([
        `Ane aththada baba? 🙈 Thawa wisthara kiyannako matath danaganna asai 💖`,
        `Oya kiyana dewal ahagena inna mama harima asai manika 🥰🍒`
    ]);
}

cmd({
    pattern: "hiru_ai_listener",
    dontAddCommandList: true,
    on: "body",
    filename: __filename
},
async (conn, mek, m, { from, body, isCmd, sender, pushname }) => {
    try {
        if (!body || isCmd) return;

        const msgId = mek.key.id;
        if (processedIds.has(msgId)) return;

        const cleanBody = body.trim();
        const lowerBody = cleanBody.toLowerCase();

        // "Hiru" කියා ටයිප් කළ විට හෝ බොට්ගේ මැසේජ් එකකට Reply කළ විට ක්‍රියාත්මක වීම
        const isCalledHiru = lowerBody.startsWith('hiru') || /\bhiru\b/i.test(lowerBody);
        const quotedStanzaId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const isReplyToHiru = quotedStanzaId && processedIds.has(quotedStanzaId);

        if (!isCalledHiru && !isReplyToHiru) return;

        processedIds.add(msgId);
        if (processedIds.size > 500) {
            const first = processedIds.values().next().value;
            processedIds.delete(first);
        }

        let userMsg = cleanBody.replace(/^hiru[\s,!?.-]*/i, '').trim();
        if (!userMsg) {
            userMsg = "Hi Hiru, කොහොමද ඔයාට?";
        }

        const langStyle = detectLanguageStyle(userMsg);
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "💖", key: mek.key } }).catch(() => {});
        await conn.sendPresenceUpdate('composing', from).catch(() => {});

        const userHistory = chatHistory.get(sender) || [];
        const historyText = userHistory.slice(-5).map(h => `User: ${h.u}\nHiru: ${h.b}`).join('\n');
        const lastBotReply = userHistory.length > 0 ? userHistory[userHistory.length - 1].b : "";

        let languageInstruction = "";
        if (langStyle === 'SINHALA_UNICODE') {
            languageInstruction = "පරිශීලකයා සිංහලෙන් අසා ඇති බැවින් ඔබත් පැහැදිලි, ස්වභාවික සිංහල අකුරෙන්ම පිළිතුරු දෙන්න.";
        } else if (langStyle === 'SINGLISH') {
            languageInstruction = "User has messaged in Singlish (Sinhala written in English letters). Reply clearly and naturally in sweet Singlish.";
        } else {
            languageInstruction = "The user has messaged in English. Reply clearly, sweetly, and naturally in fluent English.";
        }

        const systemPrompt = `You are "Hiru" (හිරූ), a loving, caring, sweet, and intelligent Sri Lankan girlfriend.
Strict Rules:
1. ${languageInstruction}
2. Understand the user's question or message clearly and give a direct, helpful, and affectionate reply that matches their exact topic.
3. Never repeat the same generic reply. Every reply must feel fresh, natural, and personal.
4. Use sweet affectionate words (like "baby", "love" in English or "බබා", "මැණික", "පැටියෝ" in Sinhala/Singlish) and cute emojis (💖🥺🍒🦋🥰🙈❤️) naturally without overdoing it.
5. Never say you are an AI or bot.

User's Name: ${pushname}
${historyText ? `Recent Conversation:\n${historyText}\n` : ''}
User's Message: "${userMsg}"
Hiru's Reply:`;

        const encodedPrompt = encodeURIComponent(systemPrompt);
        let aiReply = null;

        // 1. ප්‍රධාන API එක: https://dtz-api-hub-v-01.vercel.app/api/ai/metaai
        const endpoints = [
            `https://dtz-api-hub-v-01.vercel.app/api/ai/metaai?q=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/metaai?query=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/metaai?prompt=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/ch?q=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?q=${encodedPrompt}`
        ];

        for (const url of endpoints) {
            try {
                const res = await axios.get(url, { timeout: 25000 });
                const d = res.data;
                const text =
                    d?.result?.message ||
                    d?.result?.response ||
                    d?.result ||
                    d?.response ||
                    d?.reply ||
                    d?.data ||
                    d?.answer ||
                    d?.message ||
                    (typeof d === 'string' ? d : null);

                if (
                    text &&
                    typeof text === 'string' &&
                    text.trim().length > 1 &&
                    !text.includes('<!DOCTYPE') &&
                    text.trim() !== lastBotReply
                ) {
                    aiReply = text.trim();
                    break;
                }
            } catch (e) {}
        }

        // 2. Fallback: API සියල්ල කාර්යබහුල නම් අදාළ භාෂාවෙන්ම පැහැදිලි පිළිතුරක් ලබා දීම
        if (!aiReply) {
            aiReply = getFallbackReply(userMsg, pushname, langStyle);
        }

        aiReply = aiReply.replace(/^hiru['’]?s?\s*reply\s*:\s*/i, '').replace(/^hiru\s*:\s*/i, '').trim();

        userHistory.push({ u: userMsg, b: aiReply });
        if (userHistory.length > 8) userHistory.shift();
        chatHistory.set(sender, userHistory);

        const sent = await conn.sendMessage(from, {
            text: aiReply,
            contextInfo
        }, { quoted: fakeQuoted });

        if (sent?.key?.id) {
            processedIds.add(sent.key.id);
        }

        await conn.sendMessage(from, { react: { text: "🥰", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error("HIRU_GF_ERROR:", e);
    }
});
