const { cmd } = require('../command');
const config = require('../config');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const Jimp = require('jimp');

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
    pattern: "ssweb",
    alias: ["ss", "screenshot", "webss"],
    desc: "Take a screenshot of any website with size options.",
    category: "other",
    react: "📸",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, pushname }) => {
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        if (!q) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply(`╭━━━〔 *📸 𝐖𝐄𝐁 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓* 〕━━━┈⊷
┃ ⚠️ *Please provide a valid URL!*
┃ 📌 *Example:* \`.ss google.com\`
╰━━━━━━━━━━━━━━━┈⊷

${botFooter}`);
        }

        let targetUrl = q.trim();
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = "https://" + targetUrl;
        }

        const menuTxt = `╭━━━〔 *${botName}* 〕━━━┈⊷
┃ 📸 *𝐖𝐄𝐁 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓*
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 🌐 *𝐓𝐀𝐑𝐆𝐄𝐓 𝐈𝐍𝐅𝐎* 〕──┈⊷
┃ 👤 *User:* ${pushname}
┃ 🔗 *URL:* ${targetUrl}
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 🖥️ *𝐒𝐄𝐋𝐄𝐂𝐓 𝐒𝐈𝐙𝐄* 〕──┈⊷
┃ [ 𝟭 ] 💻 𝗣𝗖 (𝗙𝘂𝗹𝗹 𝗣𝗮𝗴𝗲)
┃ [ 𝟮 ] 💻 𝗣𝗖 (𝗩𝗶𝗲𝘄𝗽𝗼𝗿𝘁)
┃ [ 𝟯 ] 📱 𝗠𝗼𝗯𝗶𝗹𝗲 (𝗙𝘂𝗹𝗹 𝗣𝗮𝗴𝗲)
┃ [ 𝟰 ] 📱 𝗠𝗼𝗯𝗶𝗹𝗲 (𝗩𝗶𝗲𝘄𝗽𝗼𝗿𝘁)
┃ [ 𝟱 ] 💊 𝗧𝗮𝗯𝗹𝗲𝘁 (𝗙𝘂𝗹𝗹 𝗣𝗮𝗴𝗲)
╰━━━━━━━━━━━━━━━┈⊷

_🔢 Reply with a number (1 - 5) to capture._

${botFooter}`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: botLogo },
            caption: menuTxt,
            contextInfo
        }, { quoted: fakeQuoted });

        const msgId = sentMsg.key.id;
        global.numberStore = global.numberStore || {};
        global.numberStore[msgId] = {
            "1": `ssdl 1920&1080&true&PC (Full Page)&${targetUrl}`,
            "2": `ssdl 1920&1080&false&PC (Viewport)&${targetUrl}`,
            "3": `ssdl 375&812&true&Mobile (Full Page)&${targetUrl}`,
            "4": `ssdl 375&812&false&Mobile (Viewport)&${targetUrl}`,
            "5": `ssdl 768&1024&true&Tablet (Full Page)&${targetUrl}`
        };

    } catch (e) {
        console.error("SSWEB_MENU_ERROR:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *Error:* Failed to generate screenshot menu.");
    }
});

cmd({
    pattern: "ssdl",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    let loadingMsg = null;
    try {
        if (!q) return;

        const [width, height, fullPage, device, ...urlParts] = q.split('&');
        const url = urlParts.join('&');

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

        loadingMsg = await conn.sendMessage(from, {
            text: `╭━━━〔 *⏳ 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐈𝐍𝐆...* 〕━━━┈⊷
┃ 🔄 *Capturing website screenshot...*
┃ 📱 *Device:* ${device}
┃ 🌐 *URL:* ${url}
╰━━━━━━━━━━━━━━━┈⊷

_Please wait a moment..._`,
            contextInfo
        }, { quoted: fakeQuoted });

        const encodedUrl = encodeURIComponent(url);
        let rawBuffer = null;

        // 1. Primary API (api-nomo.zone.id)
        try {
            const res = await axios.get(
                `https://api-nomo.zone.id/api/ssweb?url=${encodedUrl}&width=${width}&height=${height}&full_page=${fullPage}`,
                { responseType: 'arraybuffer', timeout: 35000 }
            );
            let buf = Buffer.from(res.data);

            // JSON response එකක් නම් ඇතුළේ ඇති image link එක ලබා ගැනීම
            if (buf.toString('utf8', 0, 1) === '{') {
                const json = JSON.parse(buf.toString('utf8'));
                const imgLink = json.url || json.result || json.image || json.data?.url || json.data;
                if (imgLink && typeof imgLink === 'string' && imgLink.startsWith('http')) {
                    buf = await getBuffer(imgLink);
                }
            }
            // Jimp මඟින් සැබෑ Image එකක්දැයි තහවුරු කර JPEG Buffer බවට පත් කිරීම
            const imgCheck = await Jimp.read(buf);
            rawBuffer = await imgCheck.getBufferAsync(Jimp.MIME_JPEG);
        } catch (e) {
            rawBuffer = null;
        }

        // 2. Fallback API (movanest.xyz) - පළමු API එක අසාර්ථක වුවහොත් පමණක්
        if (!rawBuffer) {
            const fallbackUrl = `https://www.movanest.xyz/v2/ssweb?url=${encodedUrl}&width=${width}&height=${height}&full_page=${fullPage}`;
            const fbBuf = await getBuffer(fallbackUrl);
            const imgCheck2 = await Jimp.read(fbBuf);
            rawBuffer = await imgCheck2.getBufferAsync(Jimp.MIME_JPEG);
        }

        const caption = `╭━━━〔 *📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓 𝐑𝐄𝐀𝐃𝐘* 〕━━━┈⊷
┃ ✅ *Captured Successfully!*
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 🖥️ *𝐂𝐀𝐏𝐓𝐔𝐑𝐄 𝐈𝐍𝐅𝐎* 〕──┈⊷
┃ 📱 *Device:* ${device}
┃ 📐 *Resolution:* ${width}x${height}
┃ 🔗 *Link:* ${url}
╰━━━━━━━━━━━━━━━┈⊷

${botFooter}`;

        await conn.sendMessage(from, {
            image: rawBuffer,
            mimetype: 'image/jpeg',
            caption: caption,
            contextInfo
        }, { quoted: fakeQuoted });

        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error("SSDL_ERROR:", e);
        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *Error:* Failed to capture screenshot. The site might be offline or blocked.");
    }
});
