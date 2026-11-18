const config = require('../config')
const { cmd, commands } = require('../command')
const os = require('os')

cmd({
    pattern: "ping",
    alias: ["speed", "pong"],
    desc: "Check bot's response time and server status.",
    category: "main",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        const startTime = Date.now();

        // Fake Verified Chat Header (Meta AI / Verified Business Style)
        const fakeQuoted = {
            key: {
                fromMe: false,
                participant: `0@s.whatsapp.net`,
                ...(from ? { remoteJid: "status@broadcast" } : {})
            },
            message: {
                contactMessage: {
                    displayName: `${config.BOT_NAME || "𝐐υєєη 𝐇ɪʀᴜ 𝐌ᴅ 🍒🦋"}`,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${config.BOT_NAME || "Queen Hiru MD"}\nitem1.TEL;waid=94700000000:+94 70 000 0000\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        // පළමු පණිවිඩය (Pinging...)
        const initialText = `╭━━━〔 *${config.BOT_NAME}* 〕━━━┈⊷
┃ 🦋 *𝐏 𝐎 𝐍 𝐆  𝐒 𝐘 𝐒 𝐓 𝐄 𝐌* 🍒
╰━━━━━━━━━━━━━━━━━━┈⊷

⚡ *𝙎𝙥𝙚𝙚𝙙*   : _Checking..._
📡 *𝙎𝙩𝙖𝙩𝙪𝙨*  : _Connecting_ 🟡

*© ${config.BOT_FOOTER}*`;

        const message = await conn.sendMessage(from, { 
            image: { url: config.BOT_LOGO }, 
            caption: initialText 
        }, { quoted: fakeQuoted });

        const endTime = Date.now();
        const ping = endTime - startTime;

        // Speed එක අනුව React Emoji එක සහ Status එක තෝරාගැනීම
        let speedEmoji = "🚀";
        let speedBadge = "𝙐𝙡𝙩𝙧𝙖 𝙁𝙖𝙨𝙩 🟢";
        if (ping > 500) {
            speedEmoji = "⚡";
            speedBadge = "𝙉𝙤𝙧𝙢𝙖𝙡 🟡";
        }
        if (ping > 1200) {
            speedEmoji = "🐢";
            speedBadge = "𝙎𝙡𝙤𝙬 🔴";
        }

        // Server RAM & Uptime ගණනය කිරීම
        const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

        // යාවත්කාලීන කළ පණිවිඩය
        const updatedPingText = `╭━━━〔 *${config.BOT_NAME}* 〕━━━┈⊷
┃ 🦋 *𝐏 𝐎 𝐍 𝐆  𝐒 𝐘 𝐒 𝐓 𝐄 𝐌* 🍒
╰━━━━━━━━━━━━━━━━━━┈⊷

${speedEmoji} *𝙎𝙥𝙚𝙚𝙙*   : *${ping} ms*
📡 *𝙎𝙩𝙖𝙩𝙪𝙨*  : ${speedBadge}
💾 *𝙍𝘼𝙈*      : ${usedRam} MB / ${totalRam} GB
👤 *𝙐𝙨𝙚𝙧*     : ${pushname || "User"}

*© ${config.BOT_FOOTER}*`;

        // Image caption එක update කිරීම (caption: භාවිතා කළ යුතුයි)
        await conn.sendMessage(from, { 
            image: { url: config.BOT_LOGO },
            caption: updatedPingText, 
            edit: message.key 
        });

        // අවසාන React Emoji එක යැවීම
        await conn.sendMessage(from, { 
            react: { text: speedEmoji, key: mek.key } 
        });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`*Error:* ${e.message}`);
    }
});
