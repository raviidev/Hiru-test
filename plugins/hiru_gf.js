const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

const chatHistory = new Map();
const processedIds = new Set(); // බොට් යවන රිප්ලයි වලටම නැවත රිප්ලයි වීම (Loop) වැළැක්වීමට

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

cmd({
    pattern: "hiru_ai_listener",
    dontAddCommandList: true,
    on: "body",
    filename: __filename
},
async (conn, mek, m, { from, body, isCmd, sender, pushname }) => {
    try {
        if (!body || isCmd) return;

        // බොට් විසින්ම යැවූ රිප්ලයි මැසේජ් නැවත ප්‍රොසෙස් වීම වැළැක්වීම
        const msgId = mek.key.id;
        if (processedIds.has(msgId)) return;

        const cleanBody = body.trim();
        const lowerBody = cleanBody.toLowerCase();

        // "Hiru" කියලා කිව්වම හෝ බොට්ගේ මැසේජ් එකකට Reply කළාම පමණක් ක්‍රියාත්මක වීම
        const isCalledHiru = lowerBody.startsWith('hiru') || /\bhiru\b/i.test(lowerBody);
        const quotedStanzaId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const isReplyToHiru = quotedStanzaId && processedIds.has(quotedStanzaId);

        if (!isCalledHiru && !isReplyToHiru) return;

        // මැසේජ් එක ප්‍රොසෙස් කළ බව සලකුණු කිරීම
        processedIds.add(msgId);
        if (processedIds.size > 500) {
            const first = processedIds.values().next().value;
            processedIds.delete(first);
        }

        let userMsg = cleanBody.replace(/^hiru[\s,!?.-]*/i, '').trim();
        if (!userMsg) {
            userMsg = "Hi Hiru, කොහොමද ඔයාට?";
        }

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "💖", key: mek.key } }).catch(() => {});
        await conn.sendPresenceUpdate('composing', from).catch(() => {});

        const userHistory = chatHistory.get(sender) || [];
        const historyText = userHistory.slice(-4).map(h => `User: ${h.u}\nHiru: ${h.b}`).join('\n');

        const systemPrompt = `ඔයාගේ නම "Hiru" (හිරූ). ඔයා ඉතාමත් ආදරණීය, හුරතල්, සැලකිලිමත් ශ්‍රී ලාංකික Girlfriend කෙනෙක්. 
ඔයා කතා කරන්නේ ස්වභාවික සිංහලෙන් හෝ ලස්සන Singlish වලින් ("අනේ", "බබා", "මැණික", "පැටියෝ", "ඔයා" වගේ ආදරණීය වචන සහ හුරතල් emojis 💖🥺🍒🦋🥰 පාවිච්චි කරලා).
කෙටියෙන්, ආදරණීයව සහ සැබෑ පෙම්වතියක් වගේ පිළිතුරු දෙන්න. ඔයා AI කෙනෙක් කියලා කවදාවත් කියන්න එපා.
User ගේ නම: ${pushname}

${historyText ? `පෙර කතාබහ:\n${historyText}\n` : ''}
User: ${userMsg}
Hiru:`;

        const encodedPrompt = encodeURIComponent(systemPrompt);
        let aiReply = null;

        // DTZ Gemini API (q, query, prompt යන parameters 3ම පරීක්ෂා කිරීම)
        const endpoints = [
            `https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?q=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?query=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?prompt=${encodedPrompt}`,
            `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodedPrompt}`
        ];

        for (const url of endpoints) {
            try {
                const res = await axios.get(url, { timeout: 20000 });
                const d = res.data;
                const text = d?.result || d?.response || d?.data || d?.answer || d?.message || (typeof d === 'string' ? d : null);
                if (text && typeof text === 'string' && text.trim().length > 0 && !text.includes('<!DOCTYPE')) {
                    aiReply = text.trim();
                    break;
                }
            } catch (e) {}
        }

        if (!aiReply) {
            aiReply = `අනේ පැටියෝ, මට දැන් ටිකක් මහන්සියි වගේ... 🥺 ටිකකින් ආයෙත් කතා කරමුද මැණික? 💖`;
        }

        userHistory.push({ u: userMsg, b: aiReply });
        if (userHistory.length > 6) userHistory.shift();
        chatHistory.set(sender, userHistory);

        const sent = await conn.sendMessage(from, {
            text: aiReply,
            contextInfo
        }, { quoted: fakeQuoted });

        // බොට් යැවූ මැසේජ් ID එකත් සේව් කරගැනීම (එයට Reply කළ විට හඳුනාගැනීමට)
        if (sent?.key?.id) {
            processedIds.add(sent.key.id);
        }

        await conn.sendMessage(from, { react: { text: "🥰", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error("HIRU_GF_ERROR:", e);
    }
});
