const { cmd } = require('../command');
const config = require('../config');
const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

let dxzYtmp3 = null;
try {
    dxzYtmp3 = require('dxz-ytdl').ytmp3;
} catch (e) {}

// Fake Header (Verified Contact Quote + Forwarded Newsletter Header)
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

function extractUrl(data) {
    if (!data) return null;
    if (typeof data === 'string' && data.startsWith('http')) return data;
    return (
        data?.result?.downloadUrl ||
        data?.result?.download_url ||
        data?.result?.dl_url ||
        data?.result?.url ||
        data?.result?.link ||
        data?.data?.downloadUrl ||
        data?.data?.url ||
        data?.downloadUrl ||
        data?.url ||
        (typeof data?.result === 'string' && data.result.startsWith('http') ? data.result : null)
    );
}

// DTZ YTMP3 API + Auto Fallback (500 Error නොවී 100% වැඩ කිරීමට)
async function fetchYtmp3Safe(ytUrl, quality = '128k') {
    const encoded = encodeURIComponent(ytUrl);

    // 1. DTZ API (quality නැතුව - 500 error මගහැරීමට)
    try {
        const res1 = await axios.get(`https://dtz-api-hub-v-01.vercel.app/api/download/ytmp3?url=${encoded}`, { timeout: 20000 });
        const link1 = extractUrl(res1.data);
        if (link1) return link1;
    } catch (e) {}

    // 2. DTZ API (quality එක්ක)
    try {
        const res2 = await axios.get(`https://dtz-api-hub-v-01.vercel.app/api/download/ytmp3?url=${encoded}&quality=${quality}`, { timeout: 20000 });
        const link2 = extractUrl(res2.data);
        if (link2) return link2;
    } catch (e) {}

    // 3. Fallback: dxz-ytdl package
    if (dxzYtmp3) {
        try {
            const res3 = await dxzYtmp3(ytUrl, quality);
            const link3 = extractUrl(res3);
            if (link3) return link3;
        } catch (e) {}
    }

    // 4. Fallback API (Siputzx / DavidCyril)
    const backups = [
        `https://api.siputzx.my.id/api/d/ytmp3?url=${encoded}`,
        `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encoded}`
    ];

    for (const api of backups) {
        try {
            const resB = await axios.get(api, { timeout: 25000 });
            const linkB = extractUrl(resB.data);
            if (linkB) return linkB;
        } catch (e) {}
    }

    return null;
}

cmd({
    pattern: "song",
    alias: ["ytsong", "play"],
    use: '.song <query or url>',
    react: "🎧",
    desc: "Download songs with quality selection",
    category: "Download",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        if (!q) {
            await conn.sendMessage(from, { react: { text: '⚠️', key: mek.key } }).catch(() => {});
            return await reply('🔎 *𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝗮 𝘀𝗼𝗻𝗴 𝗻𝗮𝗺𝗲 𝗼𝗿 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗹𝗶𝗻𝗸!*');
        }

        const url = q.replace(/\?si=[^&]*/, '');
        const results = await yts(url);
        const result = results.videos[0];
        
        if (!result) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply("❌ *𝗦𝗼𝗻𝗴 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱!*");
        }

        let caption = `╭━━━〔 *${botName}* 〕━━━┈⊷
┃ 🎧 *𝗦𝗢𝗡𝗚 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥*
╰━━━━━━━━━━━━━━━┈⊷

*┌────────────────────┐*
*├ \`🎶 𝐓𝐢𝐭𝐥𝐞\` :* ${result.title}
*├ \`⌛ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧\` :* ${result.duration}
*├ \`📎 𝐔𝐑𝐋\` :* ${result.url}
*└────────────────────┘*

╭━━━〔 *🔢 𝐑𝐄𝐏𝐋𝐘 𝐍𝐔𝐌𝐁𝐄𝐑* 〕━━━┈⊷
┃ *🎶 ᴀᴜᴅɪᴏ ғᴏʀᴍᴀᴛ*
┃ 1️⃣ | 128𝗄𝖻𝗉𝗌 (𝖲𝗍𝖺𝗇𝖽𝖺𝗋𝖽)
┃ 2️⃣ | 320𝗄𝖻𝗉𝗌 (𝖧𝗂𝗀𝗁 𝖰𝗎𝖺𝗅𝗂𝗍𝗒)
┃
┃ *📂 ᴅᴏᴄᴜᴍᴇɴᴛ ғᴏʀᴍᴀᴛ*
┃ 3️⃣ | 128𝗄𝖻𝗉𝗌 (𝖲𝗍𝖺𝗇𝖽𝖺𝗋𝖽)
┃ 4️⃣ | 320𝗄𝖻𝗉𝗌 (𝖧𝗂𝗀𝗁 𝖰𝗎𝖺𝗅𝗂𝗍𝗒)
┃
┃ *🎤 ᴠᴏɪᴄᴇ ғᴏʀᴍᴀᴛ*
┃ 5️⃣ | 𝖵𝗈𝗂𝖼𝖾 𝖭𝗈𝗍𝖾
╰━━━━━━━━━━━━━━━┈⊷

_🔢 Please reply with the corresponding number._

${botFooter}`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: result.thumbnail },
            caption: caption,
            contextInfo
        }, { quoted: fakeQuoted });

        const msgId = sentMsg.key.id;
        global.numberStore = global.numberStore || {};
        global.numberStore[msgId] = {
            "1": `ytaa 128k&${result.url}`,
            "2": `ytaa 320k&${result.url}`,
            "3": `ytad 128k&${result.url}&${result.thumbnail}&${result.title}`,
            "4": `ytad 320k&${result.url}&${result.thumbnail}&${result.title}`,
            "5": `ytaap ${result.url}`
        };

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        reply('❌ *Error finding song.*');
    }
});

cmd({
    pattern: "ytaa",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return;
    try {
        const [quality, ...urlParts] = q.split('&');
        const url = urlParts.join('&');
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: '⬇️', key: mek.key } }).catch(() => {});

        const dlUrl = await fetchYtmp3Safe(url, quality);
        if (!dlUrl) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return await reply('❌ *𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗹𝗶𝗻𝗸 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱.*');
        }

        await conn.sendMessage(from, { react: { text: '⬆️', key: mek.key } }).catch(() => {});

        await conn.sendMessage(from, { 
            audio: { url: dlUrl }, 
            mimetype: 'audio/mpeg',
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        reply('❌ *Audio Download Failed!*');
    }
});

cmd({
    pattern: "ytad",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return;
        const [quality, url, thumb, ...titleParts] = q.split("&");
        const title = titleParts.join("&");
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: '⬇️', key: mek.key } }).catch(() => {});

        const dlUrl = await fetchYtmp3Safe(url, quality);
        if (!dlUrl) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return await reply('❌ *𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗹𝗶𝗻𝗸 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱.*');
        }

        let botimgBuffer;
        try {
            const response = await axios.get(thumb, { responseType: 'arraybuffer' });
            botimgBuffer = Buffer.from(response.data);
        } catch (e) {}

        await conn.sendMessage(from, { react: { text: '⬆️', key: mek.key } }).catch(() => {});

        await conn.sendMessage(from, {
            document: { url: dlUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title} (${quality}).mp3`,
            jpegThumbnail: botimgBuffer,
            caption: `📂 *𝖰𝗎𝖺𝗅𝗂𝗍𝗒:* ${quality}\n${botFooter}`,
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        reply('❌ *Document Download Failed!*');
    }
});

cmd({
    pattern: "ytaap",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return;
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: '⬇️', key: mek.key } }).catch(() => {});

        const dlUrl = await fetchYtmp3Safe(q, '128k');
        if (!dlUrl) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return await reply('❌ *𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗹𝗶𝗻𝗸 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱.*');
        }

        const response = await axios.get(dlUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        const ran = (Math.random() + 1).toString(36).substring(7);
        const mp3File = path.join(__dirname, `${ran}.mp3`);
        const oggFile = path.join(__dirname, `${ran}.ogg`);

        fs.writeFileSync(mp3File, buffer);

        await conn.sendMessage(from, { react: { text: '⬆️', key: mek.key } }).catch(() => {});

        ffmpeg(mp3File)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('end', async () => {
                await conn.sendMessage(from, {
                    audio: fs.readFileSync(oggFile),
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                    contextInfo
                }, { quoted: fakeQuoted });
                if (fs.existsSync(mp3File)) fs.unlinkSync(mp3File);
                if (fs.existsSync(oggFile)) fs.unlinkSync(oggFile);
                await conn.sendMessage(from, { react: { text: '✔️', key: mek.key } }).catch(() => {});
            })
            .on('error', async () => {
                if (fs.existsSync(mp3File)) fs.unlinkSync(mp3File);
                if (fs.existsSync(oggFile)) fs.unlinkSync(oggFile);
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
                reply('❌ *Voice Conversion Failed!*');
            })
            .save(oggFile);

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        reply('❌ *Voice Conversion Failed!*');
    }
});
