const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

function isValidImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 300) return false;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true; // WEBP
    return false;
}

async function fetchScreenshotBuffer(apiUrl) {
    try {
        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,application/json,*/*;q=0.8'
            }
        });

        const buf = Buffer.from(response.data);
        if (isValidImage(buf)) return buf;

        // API එකෙන් JSON response එකක් ලැබුණහොත් එහි ඇති URL හෝ Base64 එකෙන් image එක ලබා ගැනීම
        const textData = buf.toString('utf-8').trim();
        const json = JSON.parse(textData);
        const imgSource =
            json?.result?.url ||
            json?.result?.image ||
            json?.result?.screenshot ||
            json?.data?.url ||
            json?.data?.image ||
            json?.data?.screenshot ||
            (typeof json?.result === 'string' ? json.result : null) ||
            (typeof json?.url === 'string' ? json.url : null) ||
            (typeof json?.image === 'string' ? json.image : null) ||
            (typeof json?.screenshot === 'string' ? json.screenshot : null) ||
            (typeof json?.data === 'string' ? json.data : null);

        if (!imgSource) return null;

        if (imgSource.startsWith('data:image')) {
            const decoded = Buffer.from(imgSource.split(',')[1], 'base64');
            return isValidImage(decoded) ? decoded : null;
        }

        if (imgSource.startsWith('http')) {
            const imgRes = await axios.get(imgSource, { responseType: 'arraybuffer', timeout: 30000 });
            const imgBuf = Buffer.from(imgRes.data);
            return isValidImage(imgBuf) ? imgBuf : null;
        }

        return null;
    } catch (e) {
        return null;
    }
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
        await conn.sendMessage(from, { react: { text: "📸", key: mek.key } }).catch(() => {});

        if (!q) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply("⚠️ *𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝗮 𝘃𝗮𝗹𝗶𝗱 𝗨𝗥𝗟!*\n\n*𝗘𝘅:* .ss google.com");
        }

        let targetUrl = q.trim();
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = "https://" + targetUrl;
        }

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';

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

        let menuTxt = `╭━━━〔 *📸 𝐖𝐄𝐁 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓* 〕━━━┈⊷
┃ ⊳ *Hi:* ${pushname}
┃ ⊳ *Target:* ${targetUrl}
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
            text: menuTxt,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363321472746562@newsletter',
                    newsletterName: `${botName} updates`,
                    serverMessageId: 143
                },
                externalAdReply: {
                    title: "📸 WEB SCREENSHOT GENERATOR",
                    body: `Target: ${targetUrl}`,
                    mediaType: 1,
                    thumbnailUrl: botLogo,
                    sourceUrl: targetUrl,
                    renderLargerThumbnail: false
                }
            }
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

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error("SSWEB_MENU_ERROR:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *𝗘𝗿𝗿𝗼𝗿:* Failed to generate screenshot menu.");
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
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

        // Generating Loading Message
        loadingMsg = await conn.sendMessage(from, {
            text: `╭━━━〔 *⏳ 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐈𝐍𝐆...* 〕━━━┈⊷\n┃ 🔄 *Capturing website screenshot...*\n┃ 📱 *Device:* ${device}\n┃ 🌐 *URL:* ${url}\n╰━━━━━━━━━━━━━━━┈⊷\n\n_Please wait a moment..._`
        }, { quoted: mek });

        const encodedUrl = encodeURIComponent(url);

        // 1. Parameters සමඟ api-nomo.zone.id වෙතින් උත්සාහ කිරීම
        let imageBuffer = await fetchScreenshotBuffer(
            `https://api-nomo.zone.id/api/ssweb?url=${encodedUrl}&width=${width}&height=${height}&full_page=${fullPage}`
        );

        // 2. Parameters නොමැතිව කෙළින්ම https://api-nomo.zone.id/api/ssweb?url=... මඟින් ලබා ගැනීම
        if (!imageBuffer) {
            imageBuffer = await fetchScreenshotBuffer(
                `https://api-nomo.zone.id/api/ssweb?url=${encodedUrl}`
            );
        }

        if (!imageBuffer) {
            if (loadingMsg?.key) {
                await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
            }
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
            return reply("❌ *𝗘𝗿𝗿𝗼𝗿:* Failed to capture screenshot. The site might be offline or blocked.");
        }

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

        let caption = `╭━━━〔 *📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓 𝐑𝐄𝐀𝐃𝐘* 〕━━━┈⊷
┃ ✅ *Captured Successfully!*
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 🖥️ *𝐂𝐀𝐏𝐓𝐔𝐑𝐄 𝐈𝐍𝐅𝐎* 〕──┈⊷
┃ 📱 *Device:* ${device}
┃ 📐 *Resolution:* ${width}x${height}
┃ 🔗 *Link:* ${url}
╰━━━━━━━━━━━━━━━┈⊷

${botFooter}`;

        await conn.sendMessage(from, {
            image: imageBuffer,
            mimetype: 'image/png',
            caption: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363321472746562@newsletter',
                    newsletterName: `${botName} updates`,
                    serverMessageId: 143
                },
                externalAdReply: {
                    title: "📸 WEB SCREENSHOT CAPTURED",
                    body: `${device} • ${botName}`,
                    mediaType: 1,
                    thumbnailUrl: botLogo,
                    sourceUrl: url,
                    renderLargerThumbnail: false
                }
            }
        }, { quoted: fakeQuoted });

        // Loading message එක මකා දැමීම
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
        reply("❌ *𝗘𝗿𝗿𝗼𝗿:* Failed to capture screenshot. The site might be offline or blocked.");
    }
});
