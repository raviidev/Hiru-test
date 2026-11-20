const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');
const FormData = require('form-data');

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

// Buffer එක සැබෑ Image එකක්දැයි පරීක්ෂා කිරීම
function isValidImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 200) return false;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true; // WEBP
    return false;
}

// DTZ RemoveBG API එකෙන් Image Buffer එක ලබා ගැනීම (Direct Buffer හෝ JSON URL/Base64)
async function fetchDtzRemoveBg(imageUrl) {
    const encoded = encodeURIComponent(imageUrl);
    const endpoints = [
        `https://dtz-api-hub-v-01.vercel.app/api/tools/removebg?url=${encoded}`,
        `https://dtz-api-hub-v-01.vercel.app/api/tools/removebg?image=${encoded}`,
        `https://dtz-api-hub-v-01.vercel.app/api/tools/removebg?image_url=${encoded}`
    ];

    for (const apiUrl of endpoints) {
        try {
            const res = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 40000
            });
            const buf = Buffer.from(res.data);

            // 1. කෙළින්ම PNG/Image Buffer එකක් ලැබුණහොත්
            if (isValidImage(buf)) return buf;

            // 2. JSON response එකක් ලැබුණහොත් ඇතුළේ ඇති image URL හෝ Base64 ලබා ගැනීම
            const text = buf.toString('utf-8').trim();
            const json = JSON.parse(text);
            const imgData =
                json?.result?.url ||
                json?.result?.image ||
                json?.data?.url ||
                json?.data?.image ||
                (typeof json?.result === 'string' ? json.result : null) ||
                (typeof json?.url === 'string' ? json.url : null) ||
                (typeof json?.image === 'string' ? json.image : null) ||
                (typeof json?.data === 'string' ? json.data : null);

            if (imgData) {
                if (imgData.startsWith('data:image')) {
                    const b64 = Buffer.from(imgData.split(',')[1], 'base64');
                    if (isValidImage(b64)) return b64;
                }
                if (imgData.startsWith('http')) {
                    const dl = await axios.get(imgData, { responseType: 'arraybuffer', timeout: 30000 });
                    const dlBuf = Buffer.from(dl.data);
                    if (isValidImage(dlBuf)) return dlBuf;
                }
            }
        } catch (e) {}
    }

    // Fallback: movanest API
    try {
        const fbRes = await axios.get(`https://www.movanest.xyz/v2/removebg?image_url=${encoded}`, {
            responseType: 'arraybuffer',
            timeout: 35000
        });
        const fbBuf = Buffer.from(fbRes.data);
        if (isValidImage(fbBuf)) return fbBuf;
    } catch (e) {}

    return null;
}

cmd({
    pattern: "removebg",
    alias: ["rbg", "bgremove"],
    desc: "Remove the background of an image.",
    category: "other",
    react: "✂️",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    let statusKey = null;
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        let q = m.quoted ? m.quoted : m;
        let mime = (q.msg || q).mimetype || '';

        if (!mime.startsWith('image/')) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply(`╭─── « ✂️ *𝗥𝗘𝗠𝗢𝗩𝗘 𝗕𝗔𝗖𝗞𝗚𝗥𝗢𝗨𝗡𝗗* » ───
│
│ 🚫 *Please reply to an image!*
│ 📌 *Example:* Reply to a photo with \`.rbg\`
│
╰───────────────⟡

> ${botFooter}`);
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

        const sentStatus = await conn.sendMessage(from, {
            text: `╭─── « ✂️ *𝗥𝗘𝗠𝗢𝗩𝗘 𝗕𝗔𝗖𝗞𝗚𝗥𝗢𝗨𝗡𝗗* » ───
│
│ 🖌️ *Status:* Analyzing Image...
│
╰───────────────⟡`,
            contextInfo
        }, { quoted: fakeQuoted });
        statusKey = sentStatus.key;

        let media = await q.download();

        await conn.sendMessage(from, {
            text: `╭─── « ✂️ *𝗥𝗘𝗠𝗢𝗩𝗘 𝗕𝗔𝗖𝗞𝗚𝗥𝗢𝗨𝗡𝗗* » ───
│
│ ⬆️ *Status:* Uploading to Cloud...
│
╰───────────────⟡`,
            edit: statusKey
        }).catch(() => {});

        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", media, "image.jpg");

        const uploadRes = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        const imageUrl = uploadRes.data.trim();

        await conn.sendMessage(from, {
            text: `╭─── « ✂️ *𝗥𝗘𝗠𝗢𝗩𝗘 𝗕𝗔𝗖𝗞𝗚𝗥𝗢𝗨𝗡𝗗* » ───
│
│ ✂️ *Status:* Removing Background...
│
╰───────────────⟡`,
            edit: statusKey
        }).catch(() => {});

        const resultBuffer = await fetchDtzRemoveBg(imageUrl);

        if (!resultBuffer) {
            await conn.sendMessage(from, {
                text: `╭─── « ❌ *𝗙𝗔𝗜𝗟𝗘𝗗* » ───
│
│ ⚠️ *Could not remove background!*
│
╰───────────────⟡`,
                edit: statusKey
            }).catch(() => {});
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
            return;
        }

        const caption = `╭─── « ✂️ *𝗕𝗔𝗖𝗞𝗚𝗥𝗢𝗨𝗡𝗗 𝗥𝗘𝗠𝗢𝗩𝗘𝗗* » ───
│
│ ✅ *Status:* Completed Successfully!
│ 🖼️ *Format:* Transparent PNG
│
╰───────────────⟡

> ${botFooter}`;

        // Transparent PNG ලෙස Image සහ Document යන දෙකම හෝ Image එක Fake Header සමඟ යැවීම
        await conn.sendMessage(from, {
            image: resultBuffer,
            mimetype: 'image/png',
            caption: caption,
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, {
            text: `╭─── « ✨ *𝗣𝗥𝗢𝗖𝗘𝗦𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘𝗗* » ───
│
│ ✅ *Background removed successfully!*
│
╰───────────────⟡`,
            edit: statusKey
        }).catch(() => {});

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.log("RBG_ERROR:", e);
        if (statusKey) {
            await conn.sendMessage(from, {
                text: `❌ *Error:* ${e.message}`,
                edit: statusKey
            }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *𝗘𝗿𝗿𝗼𝗿:* " + e.message);
    }
});
