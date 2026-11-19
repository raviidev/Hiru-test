const { cmd } = require('../command');
const config = require('../config');
const { fetchJson } = require('../lib/functions');
const axios = require('axios');

function getFakeHeader(botName) {
    const fakeQuoted = {
        key: {
            fromMe: false,
            participant: '0@s.whatsapp.net',
            remoteJid: 'status@broadcast'
        },
        message: {
            contactMessage: {
                displayName: `${botName} ✅`,
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
    pattern: "ff",
    alias: ["ffstalk", "freefire", "ffinfo"],
    desc: "Get Free Fire player profile information using UID.",
    category: "stalk",
    react: "🎮",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    let loadingMsg = null;
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        if (!q) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply(`╭━━━〔 *🎮 𝐅𝐑𝐄𝐄 𝐅𝐈𝐑𝐄 𝐒𝐓𝐀𝐋𝐊* 〕━━━┈⊷
┃ ⚠️ *Please provide a valid FF UID!*
┃ 📌 *Example:* \`.ff 213456789\`
╰━━━━━━━━━━━━━━━┈⊷

${botFooter}`);
        }

        const uid = q.trim().replace(/[^0-9]/g, '');
        if (!uid) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply("⚠️ *Invalid UID! කරුණාකර අංක පමණක් ඇතුළත් කරන්න.*");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

        loadingMsg = await conn.sendMessage(from, {
            text: `╭━━━〔 *⏳ 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐈𝐍𝐆...* 〕━━━┈⊷
┃ 🔍 *Fetching Free Fire Profile...*
┃ 🆔 *UID:* \`${uid}\`
╰━━━━━━━━━━━━━━━┈⊷

_Please wait a moment..._`,
            contextInfo
        }, { quoted: fakeQuoted });

        const apiUrl = `https://dtz-api-hub-v-01.vercel.app/api/stalk/ff?uid=${encodeURIComponent(uid)}`;
        let resData = await fetchJson(apiUrl).catch(() => null);

        if (!resData) {
            const postRes = await axios.post(`https://dtz-api-hub-v-01.vercel.app/api/stalk/ff`, { uid }, { timeout: 30000 }).catch(() => null);
            resData = postRes ? postRes.data : null;
        }

        const data = resData?.result || resData?.data || resData;
        const basic = data?.basicInfo || data?.accountInfo || data;

        if (!data || resData?.status === false || (!basic?.nickname && !basic?.name && !data?.username)) {
            if (loadingMsg?.key) await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
            return reply(`❌ *Player Not Found!* \`${uid}\` යන UID එකට අදාළ ගිණුමක් හමු නොවීය.`);
        }

        const nickname = basic.nickname || basic.name || data.username || 'N/A';
        const accountId = basic.accountId || basic.uid || uid;
        const level = basic.level || 'N/A';
        const exp = basic.exp || 'N/A';
        const likes = basic.liked || basic.likes || 'N/A';
        const region = basic.region || basic.server || 'N/A';
        const bio = data?.socialInfo?.signature || basic.bio || basic.signature || 'No Bio';
        const guildName = data?.clanBasicInfo?.clanName || data?.guild?.name || 'No Guild';
        const guildLevel = data?.clanBasicInfo?.clanLevel || data?.guild?.level || '-';
        const rank = basic.rank || basic.brRank || 'N/A';
        const csRank = basic.csRank || 'N/A';
        const createdAt = basic.createAt || basic.createdAt || 'N/A';
        const lastLogin = basic.lastLoginAt || basic.lastLogin || 'N/A';
        const bannerImg = data?.banner || data?.avatar || data?.profileImg || botLogo;

        const ffInfoText = `╭━━━〔 *${botName}* 〕━━━┈⊷
┃ 🎮 *𝐅𝐑𝐄𝐄 𝐅𝐈𝐑𝐄 𝐏𝐋𝐀𝐘𝐄𝐑 𝐈𝐍𝐅𝐎*
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 👤 *𝐀𝐂𝐂𝐎𝐔𝐍𝐓 𝐃𝐄𝐓𝐀𝐈𝐋𝐒* 〕──┈⊷
┃ 🏷️ *Name:* ${nickname}
┃ 🆔 *UID:* \`${accountId}\`
┃ 🆙 *Level:* ${level} (EXP: ${exp})
┃ 👍 *Likes:* ${likes}
┃ 🌍 *Region:* ${region}
┃ 🏆 *BR Rank:* ${rank}
┃ ⚔️ *CS Rank:* ${csRank}
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 🛡️ *𝐆𝐔𝐈𝐋𝐃 & 𝐒𝐎𝐂𝐈𝐀𝐋* 〕──┈⊷
┃ 🏰 *Guild:* ${guildName} (Lv.${guildLevel})
┃ 📅 *Created:* ${createdAt}
┃ 🕒 *Last Login:* ${lastLogin}
┃ 📝 *Bio:* _${bio}_
╰━━━━━━━━━━━━━━━┈⊷

${botFooter}`;

        await conn.sendMessage(from, {
            image: { url: bannerImg },
            caption: ffInfoText,
            contextInfo
        }, { quoted: fakeQuoted });

        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error("FF_STALK_ERROR:", e);
        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *Error:* Free Fire දත්ත ලබා ගැනීමට නොහැකි විය. පසුව නැවත උත්සාහ කරන්න.");
    }
});
