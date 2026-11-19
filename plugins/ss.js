const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

// ලැබෙන Buffer එක සැබෑ Image (PNG / JPEG / WEBP) එකක්දැයි පරීක්ෂා කිරීම
function isValidImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 300) return false;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true; // WEBP
    return false;
}

// api-nomo.zone.id API එකෙන් පින්තූරය නිවැරදිව Download කරගැනීම
async function getNomoScreenshot(apiUrl) {
    try {
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,application/json,*/*;q=0.8'
            }
        });

        const buf = Buffer.from(res.data);

        // 1. කෙළින්ම Image Buffer එකක් ලැබුණහොත්
        if (isValidImage(buf)) return buf;

        // 2. JSON එකක් ඇතුළේ Image URL එකක් හෝ Base64 එකක් ලැබුණහොත්
        const text = buf.toString('utf-8').trim();
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            return null;
        }

        const imgData =
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

        if (!imgData) return null;

        if (imgData.startsWith('data:image')) {
            const b64 = Buffer.from(imgData.split(',')[1], 'base64');
            return isValidImage(b64) ? b64 : null;
        }

        if (imgData.startsWith('http')) {
            const dl = await axios.get(imgData, { responseType: 'arraybuffer', timeout: 30000 });
            const dlBuf = Buffer.from(dl.data);
            return isValidImage(dlBuf) ? dlBuf : null;
        }

        return null;
    } catch (e) {
        return null;
    }
}

// Fake Header (Verified Quote + Channel Forward Header)
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
        const botFooter = config.BOT_FOOTER || 'Develop By Raviya';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        if (!q) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } });
            return reply(`╭━━━〔 ${botName} 〕━━━┈⊷
┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Please provide a valid URL!*
⭔ *Example:* .ss google.com

*© ${botFooter}*`);
        }

        let targetUrl = q.trim();
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = "https://" + targetUrl;
        }

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
            image: { url: config.BOT_LOGO },
            caption: menuTxt,
            contextInfo
        }, { quoted: fakeQuoted });

        const msgId = sentMsg.key.id;
        global.numberStore = global.numberStore || {};
        global.numberStore[msgId] = {
            "1": `ssdl 1920&1080&true&desktop&PC (Full Page)&${targetUrl}`,
            "2": `ssdl 1920&1080&false&desktop&PC (Viewport)&${targetUrl}`,
            "3": `ssdl 375&812&true&mobile&Mobile (Full Page)&${targetUrl}`,
            "4": `ssdl 375&812&false&mobile&Mobile (Viewport)&${targetUrl}`,
            "5": `ssdl 768&1024&true&tablet&Tablet (Full Page)&${targetUrl}`
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

        const [width, height, fullPage, type, device, ...urlParts] = q.split('&');
        const url = urlParts.join('&'); // URL එක තුළ '&' අකුරු තිබුණත් නොකැඩී සම්පූර්ණ URL එක ලබා ගැනීමට

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || 'Develop By Raviya';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const loadingText = `╭━━━〔 ${botName} 〕━━━┈⊷
┃ 📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : Generating... ⏳

*© ${botFooter}*`;

        const statusMsg = await conn.sendMessage(from, {
            text: loadingText,
            contextInfo
        }, { quoted: fakeQuoted });

        const encodedUrl = encodeURIComponent(url);

        // 1. api-nomo.zone.id වෙත size සහ type parameters සමඟ උත්සාහ කිරීම
        let imageBuffer = await getNomoScreenshot(
            `https://api-nomo.zone.id/api/ssweb?url=${encodedUrl}&width=${width}&height=${height}&full_page=${fullPage}&type=${type}`
        );

        // 2. Parameters නොමැතිව කෙළින්ම https://api-nomo.zone.id/api/ssweb?url=... මඟින් ලබා ගැනීම
        if (!imageBuffer) {
            imageBuffer = await getNomoScreenshot(
                `https://api-nomo.zone.id/api/ssweb?url=${encodedUrl}`
            );
        }

        if (!imageBuffer) {
            const failText = `╭━━━〔 ${botName} 〕━━━┈⊷
┃ ❌ 𝐅𝐀𝐈𝐋𝐄𝐃
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : Failed to capture ❌

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

        // api-nomo.zone.id වෙතින් ලැබුණු සැබෑ පින්තූරය Fake Header සමඟ යැවීම
        await conn.sendMessage(from, {
            image: imageBuffer,
            mimetype: 'image/png',
            caption: doneText,
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("SSDL_ERROR:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`Error: ${e.message}`);
    }
});
