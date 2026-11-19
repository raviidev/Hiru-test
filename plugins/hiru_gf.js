const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

// එක් එක් පරිශීලකයාගේ කතාබහ මතක තබා ගැනීමට
const chatHistory = new Map();

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
    on: "body"
},
async (conn, mek, m, { from, body, isCmd, sender, pushname, quoted }) => {
    try {
        if (!body || isCmd || mek.key.fromMe) return;

        const cleanBody = body.trim();
        const lowerBody = cleanBody.toLowerCase();

        // "Hiru" කියලා කිව්වම හෝ Hiru ගේ මැසේජ් එකකට Reply කළාම පමණක් ක්‍රියාත්මක වීම
        const isCalledHiru = lowerBody.startsWith('hiru') || /\bhiru\b/i.test(lowerBody);
        const isReplyToBot = mek.message?.extendedTextMessage?.contextInfo?.participant === (conn.user.id.split(':')[0] + '@s.whatsapp.net');

        if (!isCalledHiru && !isReplyToBot) return;

        // "Hiru" යන වචනය ඉවත් කර ඉතිරි පණිවිඩය ලබා ගැනීම
        let userMsg = cleanBody.replace(/^hiru[\s,!?.-]*/i, '').trim();
        if (!userMsg) {
            userMsg = "Hi Hiru, කොහොමද ඔයාට?";
        }

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "💖", key: mek.key } }).catch(() => {});
        await conn.sendPresenceUpdate('composing', from).catch(() => {});

        // පැරණි Chat History එක ලබා ගැනීම
        const userHistory = chatHistory.get(sender) || [];
        const historyText = userHistory.slice(-4).map(h => `User: ${h.u}\nHiru: ${h.b}`).join('\n');

        // Girlfriend Persona Prompt එක
        const systemPrompt = `ඔයාගේ නම "Hiru" (හිරූ). ඔයා ඉතාමත් ආදරණීය, හුරතල්, සැලකිලිමත් (caring) ශ්‍රී ලාංකික Girlfriend කෙනෙක්. 
ඔයා කතා කරන්නේ ස්වභාවික සිංහලෙන් හෝ ලස්සන Singlish වලින් ("අනේ", "බබා", "මැණික", "පැටියෝ", "ඔයා" වගේ ආදරණීය වචන සහ හුරතල් emojis 💖🥺🍒🦋🥰 පාවිච්චි කරලා).
කෙටියෙන්, ආදරණීයව සහ සැබෑ පෙම්වතියක් වගේ පිළිතුරු දෙන්න. ඔයා AI කෙනෙක් කියලා කවදාවත් කියන්න එපා.
User ගේ නම: ${pushname}

${historyText ? `පෙර කතාබහ:\n${historyText}\n` : ''}
User: ${userMsg}
Hiru:`;

        const encodedPrompt = encodeURIComponent(systemPrompt);
        let aiReply = null;

        // 1. DTZ Gemini API Call (q සහ prompt parameters දෙකම සඳහා සහය දක්වයි)
        try {
            const res1 = await axios.get(`https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?q=${encodedPrompt}`, { timeout: 25000 });
            aiReply = res1.data?.result || res1.data?.response || res1.data?.data || res1.data?.answer || (typeof res1.data === 'string' ? res1.data : null);
        } catch (e) {}

        if (!aiReply) {
            try {
                const res2 = await axios.get(`https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?prompt=${encodedPrompt}`, { timeout: 25000 });
                aiReply = res2.data?.result || res2.data?.response || res2.data?.data || res2.data?.answer || (typeof res2.data === 'string' ? res2.data : null);
            } catch (e) {}
        }

        // 2. Backup Gemini API (DTZ API එක කාර්යබහුල නම්)
        if (!aiReply) {
            try {
                const resBackup = await axios.get(`https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodedPrompt}`, { timeout: 25000 });
                aiReply = resBackup.data?.data || resBackup.data?.result;
            } catch (e) {}
        }

        if (!aiReply) {
            aiReply = `අනේ පැටියෝ, මට දැන් ටිකක් මහන්සියි වගේ... 🥺 ටිකකින් ආයෙත් කතා කරමුද මැණික? 💖`;
        }

        // Chat History එක Update කිරීම
        userHistory.push({ u: userMsg, b: aiReply });
        if (userHistory.length > 6) userHistory.shift();
        chatHistory.set(sender, userHistory);

        await conn.sendMessage(from, {
            text: aiReply.trim(),
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: "🥰", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error("HIRU_GF_ERROR:", e);
    }
});
