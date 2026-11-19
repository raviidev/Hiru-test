const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

// ලැබෙන Buffer එක සැබෑ PNG / JPEG / WEBP පින්තූරයක්දැයි පරීක්ෂා කිරීම
function isValidImageBuffer(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 100) return false;
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
    // JPEG
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
    // WEBP
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
    return false;
}

// API එකෙන් පින්තූරය (Direct Image හෝ JSON URL / Base64) නිවැරදිව ලබා ගැනීම
async function fetchScreenshotImage(apiUrl) {
    try {
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 45000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });

        const rawBuffer = Buffer.from(res.data);

        // කෙළින්ම පින්තූරයක් නම්
        if (isValidImageBuffer(rawBuffer)) {
            return rawBuffer;
        }

        // JSON response එකක් නම් එහි ඇති Image URL හෝ Base64 එක වෙන්කර ගැනීම
        const textData = rawBuffer.toString('utf-8').trim();
        let json;
        try {
            json = JSON.parse(textData);
        } catch (e) {
            return null;
        }

        const possibleImg =
            json?.result?.url ||
            json?.result?.image ||
            json?.data?.url ||
            json?.data?.image ||
            json?.data?.screenshot ||
            (typeof json?.result === 'string' ? json.result : null) ||
            (typeof json?.url === 'string' ? json.url : null) ||
            (typeof json?.image === 'string' ? json.image : null) ||
            (typeof json?.screenshot === 'string' ? json.screenshot : null) ||
            (typeof json?.link === 'string' ? json.link : null) ||
            (typeof json?.data === 'string' ? json.data : null);

        if (!possibleImg) return null;

        // Base64 image එකක් නම්
        if (possibleImg.startsWith('data:image')) {
            const base64Data = possibleImg.split(',')[1];
            const decoded = Buffer.from(base64Data, 'base64');
            return isValidImageBuffer(decoded) ? decoded : null;
        }

        // URL එකක් නම් එය Download කර Image Buffer එක ලබා ගැනීම
        if (possibleImg.startsWith('http')) {
            const imgRes = await axios.get(possibleImg, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            const imgBuf = Buffer.from(imgRes.data);
            return isValidImageBuffer(imgBuf) ? imgBuf : null;
        }

        return null;
    } catch (err) {
        return null;
    }
}

function getFakeQuoted(botName) {
    return {
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
}

function getFakeContextInfo(botName, botLogo, title, body) {
    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363321472746562@newsletter',
            newsletterName: `${botName} updates`,
            serverMessageId: 143
        },
        externalAdReply: {
            title: title,
            body: body,
            mediaType: 1,
            thumbnailUrl: botLogo,
            sourceUrl: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28",
            renderLargerThumbnail: false
        }
    };
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
        const botLogo = config.BOT_LOGO;
        const botFooter = config.BOT_FOOTER || 'Develop By Raviya';

        if (!q) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } });
            return reply(`╭━━━〔 ${botName} 〕━━━┈⊷
┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Please provide a valid URL!*
⭔ *Example:* .ss google.com

*© ${botFooter}*`);
        }

        let targetUrl = q.startsWith("http") ? q : "https://" + q;

        let menuTxt = `╭━━━〔 ${botName} 〕━━━┈⊷
┃ 📸 𝐖𝐄𝐁 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *User* : ${pushname}
⭔ *URL* : ${targetUrl}

[ 1 ] 💻 PC (Full Page)
[ 2 ] 💻 PC (Viewport)
[ 3 ] 📱 Mobile (Full Page)
[ 4 ] 📱 Mobile (Viewport)
[ 5 ] 💊 Tablet (Full Page)

*© ${botFooter}*`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: botLogo },
            caption: menuTxt,
            contextInfo: getFakeContextInfo(botName, botLogo, "📸 WEB SCREENSHOT MENU", botFooter)
        }, { quoted: getFakeQuoted(botName) });

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
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});

cmd({
    pattern: "ssdl",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return;

        const [width, height, fullPage, device, url] = q.split('&');
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO;
        const botFooter = config.BOT_FOOTER || 'Develop By Raviya';
        const fakeQuoted = getFakeQuoted(botName);

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Edit කළ හැකි Text Loading Message + Fake Header
        const loadingText = `╭━━━〔 ${botName} 〕━━━┈⊷
┃ 📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : Generating... ⏳

*© ${botFooter}*`;

        const statusMsg = await conn.sendMessage(from, {
            text: loadingText,
            contextInfo: getFakeContextInfo(botName, botLogo, "⏳ GENERATING SCREENSHOT...", device)
        }, { quoted: fakeQuoted });

        // 1. පළමුව size parameters සමඟ උත්සාහ කිරීම
        const apiWithParams = `https://api-nomo.zone.id/api/ssweb?url=${encodeURIComponent(url)}&width=${width}&height=${height}&full_page=${fullPage}`;
        let imageBuffer = await fetchScreenshotImage(apiWithParams);

        // 2. එය අසාර්ථක නම් සාමාන්‍ය ?url= ලින්ක් එකෙන් උත්සාහ කිරීම
        if (!imageBuffer) {
            const apiBasic = `https://api-nomo.zone.id/api/ssweb?url=${encodeURIComponent(url)}`;
            imageBuffer = await fetchScreenshotImage(apiBasic);
        }

        if (!imageBuffer) {
            const failText = `╭━━━〔 ${botName} 〕━━━┈⊷
┃ ❌ 𝐅𝐀𝐈𝐋𝐄𝐃
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : API returned invalid image ❌

*© ${botFooter}*`;

            await conn.sendMessage(from, { text: failText, edit: statusMsg.key }).catch(() => {});
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return;
        }

        const doneText = `╭━━━〔 ${botName} 〕━━━┈⊷
┃ 📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : Ready ✅

*© ${botFooter}*`;

        // Generating මැසේජ් එක Ready ✅ ලෙස Edit කිරීම
        await conn.sendMessage(from, {
            text: doneText,
            edit: statusMsg.key
        }).catch(() => {});

        // පින්තූරය Fake Header සහ Caption සමඟ යැවීම
        await conn.sendMessage(from, {
            image: imageBuffer,
            mimetype: 'image/png',
            caption: doneText,
            contextInfo: getFakeContextInfo(botName, botLogo, "📸 SCREENSHOT READY", `${device} • ${botName}`)
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("SSDL ERROR:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ *Error:* ${e.message}`);
    }
});
