const { cmd, commands } = require('../command');
const config = require('../config');
const os = require('os');
const moment = require('moment-timezone');
const axios = require('axios');
const { proto, prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const logoTypes = ["neon","neon2","fire2","glitch","hacker","futuristic","thunder","devil","fire","ice","snow","lava","metal","gold","silver","glossy","blackpink","transformer","horror","blood","joker","galaxy","space","cloud","sand","stone","magma","gradient","light","paper","watercolor","candy","christmas","luxury","leaf","summer","circuit","block3d","cartoon","chrome","frozen"];

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

// සියලුම Category සැකසුම් සහ ගැළපෙන Aliases
const CATEGORY_CONFIG = [
    {
        key: 'main',
        subCmd: 'mainmenu',
        icon: '⚡',
        label: '𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨',
        listTitle: '⚡ MAIN MENU',
        desc: 'System status & main commands',
        headerTitle: '𝗠𝗔𝗜𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦',
        matches: ['main', 'general', 'core', 'info']
    },
    {
        key: 'owner',
        subCmd: 'ownermenu',
        icon: '👑',
        label: '𝗢𝗪𝗡𝗘𝗥 𝗠𝗘𝗡𝗨',
        listTitle: '👑 OWNER MENU',
        desc: 'Bot owner & admin controls',
        headerTitle: '𝗢𝗪𝗡𝗘𝗥 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦',
        matches: ['owner', 'admin', 'sudo', 'developer']
    },
    {
        key: 'group',
        subCmd: 'groupmenu',
        icon: '👥',
        label: '𝗚𝗥𝗢𝗨𝗣 𝗠𝗘𝗡𝗨',
        listTitle: '👥 GROUP MENU',
        desc: 'WhatsApp group management tools',
        headerTitle: '𝗚𝗥𝗢𝗨𝗣 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦',
        matches: ['group', 'groups', 'moderation']
    },
    {
        key: 'logo',
        subCmd: 'logomenu',
        icon: '🎨',
        label: '𝗟𝗢𝗚𝗢 𝗠𝗘𝗡𝗨',
        listTitle: '🎨 LOGO MENU',
        desc: 'Create 40+ stylish text & graphic logos',
        headerTitle: '𝗟𝗢𝗚𝗢 𝗠𝗔𝗞𝗘𝗥 𝗠𝗘𝗡𝗨',
        matches: ['logo', 'ephoto', 'textpro', 'maker']
    },
    {
        key: 'download',
        subCmd: 'downloadmenu',
        icon: '📥',
        label: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗦',
        listTitle: '📥 DOWNLOADS MENU',
        desc: 'Download songs, videos, TikTok & FB',
        headerTitle: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥𝗦',
        matches: ['download', 'downloader', 'downloads', 'media']
    },
    {
        key: 'search',
        subCmd: 'searchmenu',
        icon: '🔍',
        label: '𝗦𝗘𝗔𝗥𝗖𝗛 𝗠𝗘𝗡𝗨',
        listTitle: '🔍 SEARCH MENU',
        desc: 'Search web, Free Fire & player info',
        headerTitle: '𝗦𝗘𝗔𝗥𝗖𝗛 𝗧𝗢𝗢𝗟𝗦',
        matches: ['search', 'stalk', 'find', 'lookup']
    },
    {
        key: 'ai',
        subCmd: 'aimenu',
        icon: '🤖',
        label: '𝗔𝗜 𝗙𝗘𝗔𝗧𝗨𝗥𝗘𝗦',
        listTitle: '🤖 AI FEATURES',
        desc: 'Chat with AI & smart assistants',
        headerTitle: '𝗔𝗜 𝗙𝗘𝗔𝗧𝗨𝗥𝗘𝗦',
        matches: ['ai', 'gpt', 'gemini', 'bot']
    },
    {
        key: 'other',
        subCmd: 'othermenu',
        icon: '🛠️',
        label: '𝗢𝗧𝗛𝗘𝗥 𝗧𝗢𝗢𝗟𝗦',
        listTitle: '🛠️ OTHER TOOLS',
        desc: 'Screenshots, stickers & utilities',
        headerTitle: '𝗢𝗧𝗛𝗘𝗥 𝗨𝗧𝗜𝗟𝗜𝗧𝗜𝗘𝗦',
        matches: ['other', 'tools', 'tool', 'convert', 'converter', 'misc', 'utility', 'fun']
    }
];

// දැනට ස්ථාපනය කර ඇති කමාන්ඩ් වලට අදාළ Category වලට පමණක් වෙන් කිරීම (Duplicate ඉවත් කර)
function getCategorizedCommands() {
    const grouped = {};
    for (const cat of CATEGORY_CONFIG) {
        grouped[cat.key] = [];
    }

    const seenPatterns = new Set();

    for (const c of commands) {
        if (!c || !c.pattern || c.dontAddCommandList) continue;
        const pat = c.pattern.toLowerCase().trim();
        if (seenPatterns.has(pat)) continue;
        seenPatterns.add(pat);

        const rawCat = (c.category || 'other').toLowerCase().trim();
        let matchedCat = CATEGORY_CONFIG.find(cat => cat.matches.includes(rawCat));

        // නොගැළපෙන වෙනත් category නමක් තිබුණොත් එය 'other' යටතට දැමීම
        if (!matchedCat) {
            matchedCat = CATEGORY_CONFIG.find(cat => cat.key === 'other');
        }

        grouped[matchedCat.key].push(c);
    }

    return grouped;
}

cmd({
    pattern: "menu",
    alias: ["panel", "list", "commands"],
    desc: "Show main menu.",
    category: "main",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, pushname, prefix, reply }) => {
    try {
        await conn.sendMessage(from, { react: { text: "⚡", key: mek.key } }).catch(() => {});

        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ';
        const cmdPrefix = prefix || config.PREFIX || '.';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        let hostname = os.hostname();
        if (hostname.length === 12) hostname = 'Replit';
        else if (hostname.length === 36) hostname = 'Heroku';
        else if (hostname.length === 8) hostname = 'Koyeb';
        else hostname = 'Railway / VPS';

        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ramTotal = Math.round(os.totalmem() / 1024 / 1024);
        const ramUsage = `${ramUsed}MB / ${ramTotal}MB`;

        const uptimeSeconds = process.uptime();
        const uptimeHours = Math.floor(uptimeSeconds / 3600);
        const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
        const rtime = `${uptimeHours}h ${uptimeMinutes}m`;

        const time = parseInt(moment.tz('Asia/Colombo').format('HH'));
        let greeting = "Good Night 🌙";
        if (time >= 4 && time < 12) greeting = "Good Morning ☀️";
        else if (time >= 12 && time < 17) greeting = "Good Afternoon 🌤️";
        else if (time >= 17 && time < 20) greeting = "Good Evening 🌆";

        const grouped = getCategorizedCommands();

        // කමාන්ඩ් තියෙන Category පමණක් පෙරා ගැනීම
        const activeCategories = CATEGORY_CONFIG.filter(cat => grouped[cat.key] && grouped[cat.key].length > 0);
        const totalCmdCount = activeCategories.reduce((sum, cat) => sum + grouped[cat.key].length, 0);

        let panelLines = '';
        const numberStoreMapping = {};
        const listRows = [];

        activeCategories.forEach((cat, idx) => {
            const num = idx + 1;
            const numStr = num.toString();
            const count = grouped[cat.key].length;

            panelLines += `│ [ ${numStr} ] ${cat.icon} ${cat.label} (${count})\n`;
            numberStoreMapping[numStr] = cat.subCmd;

            listRows.push({
                header: `0${num}`,
                title: `${cat.listTitle} (${count})`,
                description: cat.desc,
                id: `${cmdPrefix}${cat.subCmd}`
            });
        });

        const menuText = `╭─── « ${botName} » ───⟡
│
│ ⊳ *𝗛𝗶 ${pushname}, ${greeting}!*
│
│ ◈ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 1.0.0
│ ◈ 𝗢𝘄𝗻𝗲𝗿  : ${botFooter}
│ ◈ 𝗣𝗹𝘂𝗴𝗶𝗻𝘀 : ${totalCmdCount} Commands
│ ◈ 𝗥𝗮𝗺    : ${ramUsage}
│ ◈ 𝗨𝗽𝘁𝗶𝗺𝗲 : ${rtime}
│ ◈ 𝗛𝗼𝘀𝘁   : ${hostname}
│
╰───────────────⟡

╭─── « 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗣𝗔𝗡𝗘𝗟 » ───⟡
│
${panelLines}│
╰───────────────⟡

> _🔢 Reply with a number or select from the list button below._`;

        global.numberStore = global.numberStore || {};

        try {
            const listSections = [
                {
                    title: "📂 𝐀𝐂𝐓𝐈𝐕𝐄 𝐏𝐋𝐔𝐆𝐈𝐍 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒",
                    rows: listRows
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
                                text: menuText
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: `> ${botFooter}`
                            }),
                            header: proto.Message.InteractiveMessage.Header.create({
                                title: `${botName}`,
                                subtitle: "Command Panel",
                                hasMediaAttachment: true,
                                ...(await prepareWAMessageMedia(
                                    { image: { url: botLogo } },
                                    { upload: conn.waUploadToServer }
                                ))
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    {
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: "📜 𝐒𝐄𝐋𝐄𝐂𝐓 𝐌𝐄𝐍𝐔",
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
            global.numberStore[interactiveMsg.key.id] = numberStoreMapping;

        } catch (listErr) {
            let imgBuffer;
            try {
                const res = await axios.get(botLogo, { responseType: 'arraybuffer' });
                imgBuffer = Buffer.from(res.data);
            } catch (e) {
                imgBuffer = { url: botLogo };
            }

            const sentMsg = await conn.sendMessage(from, {
                image: imgBuffer,
                caption: menuText,
                contextInfo
            }, { quoted: fakeQuoted });

            global.numberStore[sentMsg.key.id] = numberStoreMapping;
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }).catch(() => {});

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply(`*❌ System Error!*\n\n${e}`);
    }
});

const generateSubMenu = async (conn, mek, from, catKey, reply) => {
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ';
        const prefix = config.PREFIX || '.';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        const catConfig = CATEGORY_CONFIG.find(c => c.key === catKey);
        const grouped = getCategorizedCommands();
        const catCommands = grouped[catKey] || [];

        let cmdList = '';
        if (catCommands.length === 0) {
            cmdList = `│ ⊳ No active plugins in this category.\n│\n`;
        } else {
            catCommands.forEach((c) => {
                const aliasText = (c.alias && c.alias.length > 0) ? ` _(${c.alias.join(', ')})_` : '';
                cmdList += `│ ⊳ *${prefix}${c.pattern}*${aliasText}\n│   ${c.desc || 'No description available'}\n│\n`;
            });
        }

        const menuContent = `╭─── « ${botName} » ───⟡
│
│ ⊳ *${catConfig ? catConfig.headerTitle : '𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒'}* (${catCommands.length})
│
${cmdList}╰───────────────⟡

> ${botFooter}`;

        await conn.sendMessage(from, {
            image: { url: botLogo },
            caption: menuContent,
            contextInfo
        }, { quoted: fakeQuoted });

    } catch (e) {
        reply('*❌ Submenu Error !!*');
        console.log(e);
    }
};

cmd({ pattern: "logomenu", react: "🎨", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, pushname, reply }) => {
    try {
        const botName = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
        const botLogo = config.BOT_LOGO || 'https://i.imgur.com/3Z5rA9M.jpeg';
        const botFooter = config.BOT_FOOTER || '© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ';
        const { fakeQuoted, contextInfo } = getFakeHeader(botName);

        let logoList = `╭─── « ${botName} » ───⟡
│
│ ⊳ *𝗟𝗢𝗚𝗢 𝗠𝗔𝗞𝗘𝗥 𝗠𝗘𝗡𝗨*
│
`;
        logoTypes.forEach((type, index) => {
            let num = (index + 1).toString().padStart(2, '0');
            logoList += `│ [ ${num} ] ${type.toUpperCase()}\n`;
        });

        logoList += `│
╰───────────────⟡

> _Reply with a number to generate._
> _To set custom name: .logo <name>_

> ${botFooter}`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: botLogo },
            caption: logoList,
            contextInfo
        }, { quoted: fakeQuoted });

        const msgId = sentMsg.key.id;
        global.numberStore = global.numberStore || {};
        global.numberStore[msgId] = {};

        logoTypes.forEach((type, index) => {
            const numStr = (index + 1).toString();
            const paddedStr = numStr.padStart(2, '0');
            global.numberStore[msgId][numStr] = `genlogo ${type}&${pushname}`;
            global.numberStore[msgId][paddedStr] = `genlogo ${type}&${pushname}`;
        });

    } catch (e) {
        reply('*❌ Logo Menu Error!*');
        console.log(e);
    }
});

cmd({ pattern: "mainmenu", react: "⚡", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'main', reply);
});

cmd({ pattern: "ownermenu", react: "👑", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'owner', reply);
});

cmd({ pattern: "groupmenu", react: "👥", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'group', reply);
});

cmd({ pattern: "downloadmenu", react: "📥", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'download', reply);
});

cmd({ pattern: "searchmenu", react: "🔍", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'search', reply);
});

cmd({ pattern: "aimenu", react: "🤖", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'ai', reply);
});

cmd({ pattern: "othermenu", react: "🛠️", dontAddCommandList: true, filename: __filename },
async (conn, mek, m, { from, reply }) => {
    await generateSubMenu(conn, mek, from, 'other', reply);
});
