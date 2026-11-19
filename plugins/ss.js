const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

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
        if (!q) {
            return reply(`╭━━━〔 ${config.BOT_NAME} 〕━━━┈⊷
┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Please provide a valid URL!*
⭔ *Example:* .ss google.com

*© ${config.BOT_FOOTER}*`);
        }

        let targetUrl = q.startsWith("http") ? q : "https://" + q;

        let menuTxt = `╭━━━〔 ${config.BOT_NAME} 〕━━━┈⊷
┃ 📸 𝐖𝐄𝐁 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *User* : ${pushname}
⭔ *URL* : ${targetUrl}

[ 1 ] 💻 PC (Full Page)
[ 2 ] 💻 PC (Viewport)
[ 3 ] 📱 Mobile (Full Page)
[ 4 ] 📱 Mobile (Viewport)
[ 5 ] 💊 Tablet (Full Page)

*© ${config.BOT_FOOTER}*`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: config.BOT_LOGO },
            caption: menuTxt
        }, { quoted: mek });

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
        reply(`Error: ${e}`);
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

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const loadingText = `╭━━━〔 ${config.BOT_NAME} 〕━━━┈⊷
┃ 📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : Generating... ⏳

*© ${config.BOT_FOOTER}*`;

        const statusMsg = await conn.sendMessage(from, {
            image: { url: config.BOT_LOGO },
            caption: loadingText
        }, { quoted: mek });

        const apiUrl = `https://api-nomo.zone.id/api/ssweb?url=${encodeURIComponent(url)}&width=${width}&height=${height}&full_page=${fullPage}`;

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        const imageBuffer = Buffer.from(response.data);

        const doneText = `╭━━━〔 ${config.BOT_NAME} 〕━━━┈⊷
┃ 📸 𝐒𝐂𝐑𝐄𝐄𝐍𝐒𝐇𝐎𝐓
╰━━━━━━━━━━━━━━━┈⊷

⭔ *Device* : ${device}
⭔ *Status* : Ready ✅

*© ${config.BOT_FOOTER}*`;

        await conn.sendMessage(from, {
            text: doneText,
            edit: statusMsg.key
        });

        await conn.sendMessage(from, {
            image: imageBuffer
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`Error: ${e}`);
    }
});
