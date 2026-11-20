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

// DTZ TikTok API + Backup Fallback
async function fetchTikTokData(ttUrl) {
    const encoded = encodeURIComponent(ttUrl);

    // 1. Primary API: https://dtz-api-hub-v-01.vercel.app/api/download/tiktok
    try {
        const res = await axios.get(`https://dtz-api-hub-v-01.vercel.app/api/download/tiktok?url=${encoded}`, { timeout: 25000 });
        const d = res.data?.result || res.data?.data || res.data;

        if (d) {
            const noWm = d.no_watermark || d.nowm || d.hd || d.play || d.video_no_watermark || (typeof d.video === 'string' ? d.video : d.video?.noWatermark) || d.url;
            const wm = d.watermark || d.wm || d.wmplay || (typeof d.video === 'object' ? d.video?.watermark : null) || noWm;
            const music = d.music || d.audio || (typeof d.music_info === 'object' ? d.music_info?.play : null) || noWm;

            if (noWm) {
                return {
                    title: d.title || d.desc || d.caption || 'TikTok Video',
                    author: d.author?.nickname || d.author?.unique_id || d.author || 'TikTok User',
                    region: d.region || d.regions || 'Unknown',
                    duration: d.duration || d.runtime || 'Unknown',
                    thumbnail: d.thumbnail || d.cover || d.origin_cover || null,
                    no_watermark: noWm,
                    watermark: wm,
                    music: music
                };
            }
        }
    } catch (e) {}

    // 2. Fallback API (TikWM)
    try {
        const resBackup = await axios.get(`https://www.tikwm.com/api/?url=${encoded}`, { timeout: 25000 });
        const b = resBackup.data?.data;
        if (b && b.play) {
            return {
                title: b.title || 'TikTok Video',
                author: b.author?.nickname || 'TikTok User',
                region: b.region || 'Unknown',
                duration: b.duration ? `${b.duration}s` : 'Unknown',
                thumbnail: b.cover || null,
                no_watermark: b.hdplay || b.play,
                watermark: b.wmplay || b.play,
                music: b.music || b.play
            };
        }
    } catch (e) {}

    return null;
}

cmd({
    pattern: "tiktok",
    alias: ["tt", "ttdl", "tiktokdl"],
    react: '🎩',
    desc: "Download TikTok videos without watermark or audio.",
    category: "download",
    use: '.tiktok <tiktok url>',
    filename: __filename
},
async (conn, mek, m, { from, prefix, q, reply }) => {
    let loadingMsg = null;
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const cmdPrefix = prefix || config.PREFIX || '.';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        if (!q || !q.includes('tiktok')) {
            await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } }).catch(() => {});
            return reply(`╭─── « 🎩 *𝗧𝗜𝗞𝗧𝗢𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* » ───
│
│ 🔎 *Please provide a valid TikTok URL!*
│ 📌 *Example:* \`.tt https://vt.tiktok.com/...\`
│
╰───────────────⟡

> ${botFooter}`);
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }).catch(() => {});

        // Fetching Loading Message
        loadingMsg = await conn.sendMessage(from, {
            text: `╭─── « ⏳ *𝗙𝗘𝗧𝗖𝗛𝗜𝗡𝗚 𝗧𝗜𝗞𝗧𝗢𝗞...* » ───
│
│ 🔄 *Getting TikTok video details...*
│ 🔗 *URL:* ${q.trim()}
│
╰───────────────⟡

_Please wait a moment..._`,
            contextInfo
        }, { quoted: fakeQuoted });

        const mov = await fetchTikTokData(q.trim());

        if (!mov || !mov.no_watermark) {
            if (loadingMsg?.key) await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
            return reply("❌ *𝗖𝗼𝘂𝗹𝗱 𝗻𝗼𝘁 𝗳𝗲𝘁𝗰𝗵 𝗧𝗶𝗸𝗧𝗼𝗸 𝘃𝗶𝗱𝗲𝗼. 𝗣𝗹𝗲𝗮𝘀𝗲 𝗰𝗵𝗲𝗰𝗸 𝘁𝗵𝗲 𝗹𝗶𝗻𝗸.*");
        }

        const thumb = mov.thumbnail || botLogo;
        const cleanTitle = mov.title.replace(/&/g, 'and').slice(0, 60);

        const menuCaption = `╭─── « 🎩 *𝗧𝗜𝗞𝗧𝗢𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* » ───
│
│ 🎬 *𝗧𝗶𝘁𝗹𝗲:* ${mov.title}
│ 👤 *𝗔𝘂𝘁𝗵𝗼𝗿:* ${mov.author}
│ 🌍 *𝗥𝗲𝗴𝗶𝗼𝗻:* ${mov.region}
│ ⏰ *𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻:* ${mov.duration}
│
╰───────────────⟡

╭─── « 🔢 *𝗦𝗘𝗟𝗘𝗖𝗧 𝗙𝗢𝗥𝗠𝗔𝗧* » ───
│
│ [ 𝟭 ] 📼 𝗩𝗶𝗱𝗲𝗼 (𝗡𝗼 𝗪𝗮𝘁𝗲𝗿𝗺𝗮𝗿𝗸)
│ [ 𝟮 ] 🎥 𝗩𝗶𝗱𝗲𝗼 (𝗪𝗶𝘁𝗵 𝗪𝗮𝘁𝗲𝗿𝗺𝗮𝗿𝗸)
│ [ 𝟯 ] 🎶 𝗔𝘂𝗱𝗶𝗼 𝗢𝗻𝗹𝘆 (𝗠𝗣𝟯)
│
╰───────────────⟡

_🔢 Reply with a number or select from the list button below._`;

        const numberMapping = {
            "1": `ttdl_exec video&No Watermark&${cleanTitle}&${mov.no_watermark}`,
            "2": `ttdl_exec video&With Watermark&${cleanTitle}&${mov.watermark}`,
            "3": `ttdl_exec audio&Audio MP3&${cleanTitle}&${mov.music}`
        };

        global.numberStore = global.numberStore || {};

        // Interactive List Button + Number Reply Support
        try {
            const listSections = [
                {
                    title: "📥 𝐓𝐈𝐊𝐓𝐎𝐊 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐎𝐏𝐓𝐈𝐎𝐍𝐒",
                    rows: [
                        {
                            header: "01",
                            title: "📼 Video (No Watermark)",
                            description: "Download HD TikTok video without watermark",
                            id: `${cmdPrefix}ttdl_exec video&No Watermark&${cleanTitle}&${mov.no_watermark}`
                        },
                        {
                            header: "02",
                            title: "🎥 Video (With Watermark)",
                            description: "Download original TikTok video with watermark",
                            id: `${cmdPrefix}ttdl_exec video&With Watermark&${cleanTitle}&${mov.watermark}`
                        },
                        {
                            header: "03",
                            title: "🎶 Audio Only (MP3)",
                            description: "Download TikTok background music / audio",
                            id: `${cmdPrefix}ttdl_exec audio&Audio MP3&${cleanTitle}&${mov.music}`
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
                                subtitle: "TikTok Downloader",
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
                                            title: "📥 𝐒𝐄𝐋𝐄𝐂𝐓 𝐅𝐎𝐑𝐌𝐀𝐓",
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
        console.log("TIKTOK_ERROR:", e);
        if (loadingMsg?.key) {
            await conn.sendMessage(from, { delete: loadingMsg.key }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply(`*❌ Error downloading TikTok video!*\n\n${e.message || e}`);
    }
});

cmd({
    pattern: "ttdl_exec",
    dontAddCommandList: true,
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    let dlLoadingMsg = null;
    try {
        if (!q) return;

        const [type, formatName, title, ...urlParts] = q.split('&');
        const dlUrl = urlParts.join('&');

        if (!dlUrl) {
            return reply("❌ *Download link not found!*");
        }

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botFooter = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        await conn.sendMessage(from, { react: { text: '⬇️', key: mek.key } }).catch(() => {});

        // Downloading Loading Message
        dlLoadingMsg = await conn.sendMessage(from, {
            text: `╭─── « ⬇️ *𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗜𝗡𝗚...* » ───
│
│ 🎬 *𝗧𝗶𝘁𝗹𝗲:* ${title}
│ 🎞️ *𝗙𝗼𝗿𝗺𝗮𝘁:* ${formatName}
│
╰───────────────⟡

_Uploading media to WhatsApp, please wait..._`,
            contextInfo
        }, { quoted: fakeQuoted });

        await conn.sendMessage(from, { react: { text: '⬆️', key: mek.key } }).catch(() => {});

        if (type === 'audio') {
            await conn.sendMessage(from, {
                audio: { url: dlUrl },
                mimetype: "audio/mpeg",
                contextInfo
            }, { quoted: fakeQuoted });
        } else {
            const caption = `╭─── « 🎩 *𝗧𝗜𝗞𝗧𝗢𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* » ───
│
│ 🎬 *𝗧𝗶𝘁𝗹𝗲:* ${title}
│ 🎞️ *𝗙𝗼𝗿𝗺𝗮𝘁:* ${formatName}
│
╰───────────────⟡

> ${botFooter}`;

            await conn.sendMessage(from, {
                video: { url: dlUrl },
                mimetype: "video/mp4",
                caption: caption,
                contextInfo
            }, { quoted: fakeQuoted });
        }

        if (dlLoadingMsg?.key) {
            await conn.sendMessage(from, { delete: dlLoadingMsg.key }).catch(() => {});
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.log("TTDL_EXEC_ERROR:", e);
        if (dlLoadingMsg?.key) {
            await conn.sendMessage(from, { delete: dlLoadingMsg.key }).catch(() => {});
        }
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        reply(`*❌ Error !!*\n\n${e.message || e}`);
    }
});
