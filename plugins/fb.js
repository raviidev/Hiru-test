const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');
const { proto, prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

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

cmd({
    pattern: "fb",
    alias: ["facebook", "fbdl"],
    desc: "Download videos from Facebook.",
    category: "download",
    react: "🏮",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, prefix }) => {
    let loadingMsg = null;
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const cmdPrefix = prefix || config.PREFIX || '.';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        if (!q || (!q.includes('facebook.com') && !q.includes('fb.watch') && !q.includes('fb.me'))) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply(`╭─── « 🏮 *𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* » ───
│
│ 🚫 *Please provide a valid Facebook URL!*
│ 📌 *Example:* \`.fb https://www.facebook.com/...\`
│
╰───────────────⟡

> ${botFooter}`);
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

        // Fetching Loading Message
        loadingMsg = await conn.sendMessage(from, {
            text: `╭─── « ⏳ *𝗙𝗘𝗧𝗖𝗛𝗜𝗡𝗚 𝗩𝗜𝗗𝗘𝗢...* » ───
│
│ 🔄 *Getting Facebook video details...*
│ 🔗 *URL:* ${q.trim()}
│
╰───────────────⟡

_Please wait a moment..._`,
            contextInfo
        }, { quoted: fakeQuoted });

        const apiUrl = `https://www.ominisave.com/api/fb?url=${encodeURIComponent(q.trim())}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const data = response.data;

        if (!data.status || !data.result) {
            if (loadingMsg?.key) await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
            return reply("❌ *𝗖𝗼𝘂𝗹𝗱 𝗻𝗼𝘁 𝗳𝗲𝘁𝗰𝗵 𝘃𝗶𝗱𝗲𝗼. 𝗠𝗮𝗸𝗲 𝘀𝘂𝗿𝗲 𝘁𝗵𝗲 𝗹𝗶𝗻𝗸 𝗶𝘀 𝗽𝘂𝗯𝗹𝗶𝗰.*");
        }

        const res = data.result;
        const hdUrl = res.hd || res.downloadLink || res.url;
        const sdUrl = res.sd || res.downloadLink || res.url;
        const title = res.title || "Facebook Video";
        const quality = res.quality || "HD";
        const thumb = res.thumbnail || res.thumb || botLogo;

        const menuCaption = `╭─── « 🏮 *𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* » ───
│
│ 🎬 *𝗧𝗶𝘁𝗹𝗲:* ${title}
│ 🎞️ *𝗤𝘂𝗮𝗹𝗶𝘁𝘆:* ${quality}
│
╰───────────────⟡

╭─── « 🔢 *𝗦𝗘𝗟𝗘𝗖𝗧 𝗙𝗢𝗥𝗠𝗔𝗧* » ───
│
│ [ 𝟭 ] 🎬 𝗛𝗗 𝗩𝗶𝗱𝗲𝗼 (𝗠𝗣𝟰)
│ [ 𝟮 ] 📹 𝗦𝗗 𝗩𝗶𝗱𝗲𝗼 (𝗠𝗣𝟰)
│ [ 𝟯 ] 🎵 𝗔𝘂𝗱𝗶𝗼 𝗢𝗻𝗹𝘆 (𝗠𝗣𝟯)
│
╰───────────────⟡

_🔢 Reply with a number or select from the list button below._`;

        const numberMapping = {
            "1": `fbdl_exec video&HD&${title}&${hdUrl}`,
            "2": `fbdl_exec video&SD&${title}&${sdUrl}`,
            "3": `fbdl_exec audio&MP3&${title}&${sdUrl}`
        };

        global.numberStore = global.numberStore || {};

        // Interactive List Button + Number Reply Support
        try {
            const listSections = [
                {
                    title: "📥 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐎𝐏𝐓𝐈𝐎𝐍𝐒",
                    rows: [
                        {
                            header: "01",
                            title: "🎬 HD Video (MP4)",
                            description: "Download Facebook video in High Quality",
                            id: `${cmdPrefix}fbdl_exec video&HD&${title}&${hdUrl}`
                        },
                        {
                            header: "02",
                            title: "📹 SD Video (MP4)",
                            description: "Download Facebook video in Standard Quality",
                            id: `${cmdPrefix}fbdl_exec video&SD&${title}&${sdUrl}`
                        },
                        {
                            header: "03",
                            title: "🎵 Audio Only (MP3)",
                            description: "Extract and download audio from video",
                            id: `${cmdPrefix}fbdl_exec audio&MP3&${title}&${sdUrl}`
                        }
                    ]
                }
            ];

            const interactiveMsg = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2
                        },
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            body: proto.Message.InteractiveMessage.Body.create({
                                text: menuCaption
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: `> ${botFooter}`
                            }),
                            header: proto.Message.InteractiveMessage.Header.create({
                                title: botName,
                                subtitle: "Facebook Downloader",
                                hasMediaAttachment: true,
                                ...(await prepareWAMessageMedia(
                                    { image: { url: thumb } },
                                    { upload: conn.waUploadToServer }
                                ))
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    {
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: "📥 𝐒𝐄𝐋𝐄𝐂𝐓 𝐐𝐔𝐀𝐋𝐈𝐓𝐘",
                                            sections: listSections
                                        })
                                    }
                                ]
                            }),
                            contextInfo
                        })
                    }
                }
            }, { quoted: fakeQuoted });

            await conn.relayMessage(from, interactiveMsg.message, { messageId: interactiveMsg.key.id });
            global.numberStore[interactiveMsg.key.id] = numberMapping;

        } catch (listErr) {
            // Fallback: List Button අසාර්ථක වුවහොත් පින්තූරය + Number Reply මෙනුව යැවීම
            const sentMsg = await conn.sendMessage(from, {
                image: { url: thumb },
                caption: `${menuCaption}\n\n> ${botFooter}`,
                contextInfo
            }, { quoted: fakeQuoted });

            global.numberStore[sentMsg.key.id] = numberMapping;
        }

        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.log("FB_ERROR:", e);
        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *𝗘𝗿𝗿𝗼𝗿:* Failed to fetch Facebook video.");
    }
});

cmd({
    pattern: "fbdl_exec",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    let dlLoadingMsg = null;
    try {
        if (!q) return;

        const [type, quality, title, ...urlParts] = q.split('&');
        const dlUrl = urlParts.join('&');

        if (!dlUrl) {
            return reply("❌ *Download link not found!*");
        }

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } }).catch(() => {});

        // Downloading Loading Message
        dlLoadingMsg = await conn.sendMessage(from, {
            text: `╭─── « ⬇️ *𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗜𝗡𝗚...* » ───
│
│ 🎬 *𝗧𝗶𝘁𝗹𝗲:* ${title}
│ 🎞️ *𝗙𝗼𝗿𝗺𝗮𝘁:* ${quality}
│
╰───────────────⟡

_Uploading media to WhatsApp, please wait..._`,
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } }).catch(() => {});

        if (type === 'audio') {
            await conn.sendMessage(from, {
                audio: { url: dlUrl },
                mimetype: 'audio/mpeg',
                contextInfo
            }, { quoted: fakeQuoted });
        } else {
            const caption = `╭─── « 🏮 *𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* » ───
│
│ 🎬 *𝗧𝗶𝘁𝗹𝗲:* ${title}
│ 🎞️ *𝗤𝘂𝗮𝗹𝗶𝘁𝘆:* ${quality}
│
╰───────────────⟡

> ${botFooter}`;

            await conn.sendMessage(from, {
                video: { url: dlUrl },
                mimetype: 'video/mp4',
                caption: caption,
                contextInfo
            }, { quoted: fakeQuoted });
        }

        if (dlLoadingMsg?.key) {
            await conn.sendMessage(from, { delete: dlLoadingMsg.key }).catch(() => {});
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.log("FBDL_EXEC_ERROR:", e);
        if (dlLoadingMsg?.key) {
            await conn.sendMessage(from, { delete: dlLoadingMsg.key }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply("❌ *𝗘𝗿𝗿𝗼𝗿:* Failed to download the media.");
    }
});
