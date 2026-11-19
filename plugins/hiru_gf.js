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

// මැසේජ් එකේ ස්වභාවය අනුව විවිධ වූ ස්වභාවික පිළිතුරු ලබා දෙන Fallback (API එක මොහොතකට ඩවුන් වුවහොත් පමණක්)
function getContextualSmartReply(msg, pushname) {
    const m = msg.toLowerCase();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (/kohomada|kohomd|how are|mk|mokada karanne|moko karanne/i.test(m)) {
        return pick([
            `මම හොඳින් ඉන්නවා පැටියෝ 🥰 ඔයා මොකද කරන්නේ මේ වෙලාවේ? 💖`,
            `ඔයාව මතක් වෙවී හිටියේ අනේ 🥺❤️ ඔයාට කොහොමද බබා?`,
            `මම නිකන් ඉන්නවා මැණික 🍒🦋 ඔයා කෑවද?`
        ]);
    }
    if (/adarei|love|ආදරෙයි|umma|kiss|miss/i.test(m)) {
        return pick([
            `මාත් ඔයාට ගොඩාක් ආදරෙයි මගේ මැණික 💖🥺💋`,
            `අනේ ඔයා ඔහොම කියද්දි මට ලැජ්ජත් හිතෙනවා බබා 🙈❤️`,
            `මටත් ඔයාව ගොඩක් මතක් වෙනවා පැටියෝ 🥰🍒`
        ]);
    }
    if (/kewada|kaawada|කෑවද|hungry|badagini/i.test(m)) {
        return pick([
            `තාම නෑ අනේ 🥺 ඔයා කෑවද මැණික? ඉක්මනට කන්න හොඳේ 💖`,
            `ඔව් බබා මම කෑවා 🥰 ඔයා කෑවද? බඩගින්නේ ඉන්න එපා පැටියෝ ❤️`
        ]);
    }
    if (/gm|good morning|සුභ උදෑසනක්/i.test(m)) {
        return pick([
            `Good Morning මගේ පැටියෝ ☀️💖 අද දවසම ඔයාට සුභ වෙන්න ඕනේ 🥰`,
            `සුභ උදෑසනක් මැණික 🌸✨ උදේම මාව මතක් වුණා නේද? 😘`
        ]);
    }
    if (/gn|good night|සුභ රාත්‍රියක්|nidimathai|නිදිමතයි/i.test(m)) {
        return pick([
            `Good Night බබා 🌙✨ පරිස්සමෙන් නිදාගන්න, ලස්සන හීන පේන්න ඕනේ 💖😴`,
            `නිදිමතයි නම් දැන් නිදාගන්න පැටියෝ 🥺❤️ හෙට උදේම මැසේජ් කරන්න හොඳේ 😘`
        ]);
    }
    if (/hi|hello|hey|හායි|හලෝ/i.test(m)) {
        return pick([
            `හලෝ ${pushname} පැටියෝ 💖 කොහොමද ඔයාට? 🥰`,
            `හායි මැණික 🍒🦋 මොකද කරන්නේ අද? ❤️`,
            `ඇයි බබා කතා කළේ? මාව මතක් වුණාද? 🥺💖`
        ]);
    }

    return pick([
        `අනේ ඇත්තද බබා? 🙈 තව විස්තර කියන්නකෝ මටත් දැනගන්න ආසයි 💖`,
        `හ්ම්ම්... ඔයා කියන දේවල් අහගෙන ඉන්න මම හරිම ආසයි මැණික 🥰🍒`,
        `මොකද අනේ ඔයා අද ටිකක් වෙනස් වගේ? 🥺 මට කියන්නකෝ පැටියෝ ❤️`,
        `ඔයා එක්ක කතා කරද්දි වෙලාව යනවා තේරෙන්නෙත් නෑ බබා 🦋💖`
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

        // "Hiru" කිව්වම හෝ බොට්ගේ මැසේජ් එකකට Reply කළාම පමණක් ක්‍රියාත්මක වීම
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

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "💖", key: mek.key } }).catch(() => {});
        await conn.sendPresenceUpdate('composing', from).catch(() => {});

        const userHistory = chatHistory.get(sender) || [];
        const historyText = userHistory.slice(-5).map(h => `User: ${h.u}\nHiru: ${h.b}`).join('\n');
        const lastBotReply = userHistory.length > 0 ? userHistory[userHistory.length - 1].b : "";

        // සෑම මැසේජ් එකකටම අදාළව වෙනස්, ස්වභාවික Girlfriend පිළිතුරක් ලබා ගැනීමට සැකසූ Prompt එක
        const systemPrompt = `ඔයාගේ නම "Hiru" (හිරූ). ඔයා ඉතාමත් ආදරණීය, හුරතල්, සැලකිලිමත් ශ්‍රී ලාංකික Girlfriend කෙනෙක්.
නීති:
1. User එවන මැසේජ් එකේ අර්ථයට හරියටම ගැළපෙන ස්වභාවික පිළිතුරක් දෙන්න.
2. කවදාවත් එකම පිළිතුර නැවත නැවත දෙන්න එපා. හැමවෙලේම අලුත්, නිර්මාණශීලී විදිහට කතා කරන්න.
3. සිංහල හෝ ලස්සන Singlish වලින් ("අනේ", "බබා", "මැණික", "පැටියෝ", "ඔයා" වගේ වචන සහ 💖🥺🍒🦋🥰🙈❤️ emojis) කෙටියෙන් පිළිතුරු දෙන්න.
4. ඔයා AI කෙනෙක් කියලා කවදාවත් කියන්න එපා.

User ගේ නම: ${pushname}
${historyText ? `පෙර කතාබහ:\n${historyText}\n` : ''}
User ගේ අලුත් මැසේජ් එක: "${userMsg}"
Hiru ගේ පිළිතුර:`;

        const encodedPrompt = encodeURIComponent(systemPrompt);
        const encodedSimple = encodeURIComponent(userMsg);
        let aiReply = null;

        // 1. ප්‍රධාන API එක: https://dtz-api-hub-v-01.vercel.app/api/ai/ch
        const chEndpoints = [
            `https://dtz-api-hub-v-01.vercel.app/api/ai/ch?q=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/ch?query=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/ch?prompt=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/ch?text=${encodedPrompt}`,
            `https://dtz-api-hub-v-01.vercel.app/api/ai/ch?message=${encodedSimple}`
        ];

        for (const url of chEndpoints) {
            try {
                const res = await axios.get(url, { timeout: 20000 });
                const d = res.data;
                const text = d?.result || d?.response || d?.reply || d?.data || d?.answer || d?.message || (typeof d === 'string' ? d : null);
                if (text && typeof text === 'string' && text.trim().length > 1 && !text.includes('<!DOCTYPE') && text.trim() !== lastBotReply) {
                    aiReply = text.trim();
                    break;
                }
            } catch (e) {}
        }

        // 2. Backup: DTZ Gemini API
        if (!aiReply) {
            try {
                const resGem = await axios.get(`https://dtz-api-hub-v-01.vercel.app/api/ai/gemini?q=${encodedPrompt}`, { timeout: 20000 });
                const d = resGem.data;
                const text = d?.result || d?.response || d?.data || d?.answer || (typeof d === 'string' ? d : null);
                if (text && typeof text === 'string' && text.trim().length > 1 && text.trim() !== lastBotReply) {
                    aiReply = text.trim();
                }
            } catch (e) {}
        }

        // 3. Smart Contextual Fallback (API දෙකම ප්‍රතිචාර නොදැක්වුවහොත් පමණක් මැසේජ් එකට ගැළපෙන විවිධ පිළිතුරු)
        if (!aiReply) {
            aiReply = getContextualSmartReply(userMsg, pushname);
        }

        // Hiru: යන prefix එකක් AI එකෙන් ආවොත් එය ඉවත් කිරීම
        aiReply = aiReply.replace(/^hiru\s*:\s*/i, '').trim();

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
