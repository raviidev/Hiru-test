const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

// ලැබෙන Buffer එක සැබෑ Image (PNG / JPEG / WEBP) එකක්දැයි පරීක්ෂා කිරීම
function isValidImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 500) return false;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true; // WEBP
    return false;
}

// API එකකින් පින්තූරය නිවැරදිව Download කරගැනීම (Direct Buffer හෝ JSON URL/Base64)
async function getImageFromApi(apiUrl) {
    try {
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        const buf = Buffer.from(res.data);
        if (isValidImage(buf)) return buf;

        // JSON response එකක් ලැබුණහොත් එහි ඇති image link හෝ base64 ලබා ගැනීම
        const text = buf.toString('utf-8').trim();
        const json = JSON.parse(text);
        const imgData =
            json?.result?.url ||
            json?.result?.image ||
            json?.data?.url ||
            json?.data?.image ||
            json?.data?.screenshot ||
            (typeof json?.result === 'string' ? json.result : null) ||
            (typeof json?.url === 'string' ? json.url : null) ||
            (typeof json?.image === 'string' ? json.image : null) ||
            (typeof json?.screenshot === 'string' ? json.screenshot : null);

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
            image: { url: config.BOT_LOGO },
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

        // 1. පළමුව api-nomo.zone.id API එකෙන් උත්සාහ කිරීම
        let imageBuffer = await getImageFromApi(`https://api-nomo.zone.id/api/ssweb?url=${encodeURIComponent(url)}`);

        // 2. එය අසාර්ථක නම් movanest API එකෙන් නිවැරදි size සමඟ ලබා ගැනීම (100% Backup)
        if (!imageBuffer) {
            imageBuffer = await getImageFromApi(`https://www.movanest.xyz/v2/ssweb?url=${encodeURIComponent(url)}&width=${width}&height=${height}&full_page=${fullPage}`);
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

        // පින්තූරය Fake Header සමඟ පමණක් යැවීම
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
