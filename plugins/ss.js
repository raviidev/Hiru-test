const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');
const Jimp = require('jimp');

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

        let targetUrl = q.startsWith("http") ? q : "https://" + q;
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
            image: { url: botLogo },
            caption: menuTxt,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363321472746562@newsletter',
                    newsletterName: `${botName} updates`,
                    serverMessageId: 143
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

        const [width, height, fullPage, device, url] = q.split('&');
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

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

        // Generating Loading Message
        loadingMsg = await conn.sendMessage(from, {
            text: `╭━━━〔 *⏳ 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐈𝐍𝐆...* 〕━━━┈⊷\n┃ 🔄 *Capturing website screenshot...*\n┃ 📱 *Device:* ${device}\n┃ 🌐 *URL:* ${url}\n╰━━━━━━━━━━━━━━━┈⊷\n\n_Please wait a moment..._`,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363321472746562@newsletter',
                    newsletterName: `${botName} updates`,
                    serverMessageId: 143
                }
            }
        }, { quoted: fakeQuoted });

        const apiUrl = `https://api-nomo.zone.id/api/ssweb?url=${encodeURIComponent(url)}&width=${width}&height=${height}&full_page=${fullPage}`;

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 45000
        });

        let rawBuffer = Buffer.from(response.data);

        // JSON response එකක් නම් ඇතුළේ ඇති image link එක ගැනීම
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('application/json') || rawBuffer.toString('utf8', 0, 1) === '{') {
            const json = JSON.parse(rawBuffer.toString('utf8'));
            const imgUrl = json.url || json.result || json.image || json.data?.url || json.data;
            if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
                rawBuffer = Buffer.from(imgRes.data);
            }
        }

        // Jimp මඟින් සැබෑ JPEG/PNG Buffer එකක් බවට පත් කිරීම (WhatsApp හිස් කොටුවක් වීම වැළැක්වීමට)
        const jimpImg = await Jimp.read(rawBuffer);
        const finalImageBuffer = await jimpImg.getBufferAsync(Jimp.MIME_JPEG);

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
            image: finalImageBuffer,
            mimetype: 'image/jpeg',
            caption: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363321472746562@newsletter',
                    newsletterName: `${botName} updates`,
                    serverMessageId: 143
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
