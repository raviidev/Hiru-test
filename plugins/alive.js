const { cmd, command } = require('../command');
const config = require('../config');
const { runtime } = require('../lib/functions');

cmd({
    pattern: "alive",
    alias: ["status", "bot"],
    desc: "Check if the bot is running and view system status.",
    category: "main",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, reply }) => {
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏ🇦*';
        const prefix = config.PREFIX || '.';

        const uptime = typeof runtime !== 'undefined' ? runtime(process.uptime()) : process.uptime();
        const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });

        const aliveText = `╭━━━〔 *${botName}* 〕━━━┈⊷
┃ ⚡ *ɪ'ᴍ ᴀʟɪᴠᴇ ɴᴏᴡ & ʀᴇᴀᴅʏ!*
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 📊 *𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒* 〕──┈⊷
┃ 👑 *User:* ${pushname}
┃ ⏱️ *Uptime:* \`${uptime}\`
┃ 🔑 *Prefix:* [ \`${prefix}\` ]
┃ 🕒 *Time:* ${currentTime}
┃ 🚀 *Mode:* ${config.WORK_TYPE || 'Public'}
╰━━━━━━━━━━━━━━━┈⊷

_🫟 සියලුම පද්ධති සක්‍රීයව සහ සුමටව ක්‍රියාත්මක වේ!_

${botFooter}`;

        await conn.sendMessage(from, {
            image: { url: botLogo },
            caption: aliveText,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363321472746562@newsletter',
                    newsletterName: `${botName} updates`,
                    serverMessageId: 143
                },
                externalAdReply: {
                    title: "⚡ SYSTEM ALIVE & ONLINE",
                    body: botFooter,
                    mediaType: 1,
                    thumbnailUrl: botLogo,
                    sourceUrl: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28",
                    renderLargerThumbnail: false
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.error("Alive Error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});
