const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const config = require('./config');
const axios = require('axios');
const mongoose = require('mongoose');
const moment = require('moment-timezone'); 
const Jimp = require('jimp'); 

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    downloadContentFromMessage,
    proto,
    prepareWAMessageMedia,
    Browsers,
    generateWAMessageFromContent,
    generateForwardMessageContent,
    S_WHATSAPP_NET
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, fetchJson } = require('./lib/functions');
const { sms } = require('./lib/msg');
const NodeCache = require('node-cache');
const util = require('util');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_BASE_PATH = './sessions';
const msgRetryCounterCache = new NodeCache();

require('events').EventEmitter.defaultMaxListeners = 1000;
const delay = ms => new Promise(res => setTimeout(res, ms));
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://awarohana5_db_user:gQf3KEcVG13ufgrg@cluster0.hc3r3ez.mongodb.net/';

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('𝐌ᴏɴɢᴏ𝐃𝐁 𝐂ᴏɴɴᴇᴄᴛᴇᴅ ✅ '))
    .catch(err => console.log('❌ 𝐌ᴏɴɢᴏ𝐃𝐁 ᴇʀʀᴏ:', err));

const SessionSchema = new mongoose.Schema({ sessionId: String, data: Object, updatedAt: Date });
const Session = mongoose.model('fgfgfgdfgdfd', SessionSchema);
const UserConfigSchema = new mongoose.Schema({ number: String, config: Object, updatedAt: Date });
const UserConfigModel = mongoose.model('UserConfig', UserConfigSchema);
const NewsletterReactSchema = new mongoose.Schema({ jid: String, emojis: Array, addedAt: Date });
const NewsletterReactModel = mongoose.model('NewsletterReact', NewsletterReactSchema);

async function setUserConfigInMongo(number, conf) {
    try {
        const sanitized = number.replace(/[^0-9]/g, '');
        await UserConfigModel.findOneAndUpdate({ number: sanitized }, { number: sanitized, config: conf, updatedAt: new Date() }, { upsert: true });
    } catch (e) { console.error('setUserConfigInMongo Error:', e); }
}
async function loadUserConfigFromMongo(number) {
    try {
        const sanitized = number.replace(/[^0-9]/g, '');
        const doc = await UserConfigModel.findOne({ number: sanitized });
        return doc ? doc.config : null;
    } catch (e) { console.error('loadUserConfigFromMongo Error:', e); return null; }
}
async function addNewsletterReactConfig(jid, emojis = []) {
    try {
        await NewsletterReactModel.findOneAndUpdate({ jid }, { jid, emojis, addedAt: new Date() }, { upsert: true });
    } catch (e) { console.error('addNewsletterReactConfig', e); }
}
async function listNewsletterReactsFromMongo() {
    try {
        const docs = await NewsletterReactModel.find({});
        return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
    } catch (e) { return []; }
}

const BOT_NAME_FANCY = config.BOT_NAME || '𝐐υєєη 𝐇ɪʀᴜ 𝐁ᴇᴛᴀ 🍒🦋';
const BOT_FOOTER = config.BOT_FOOTER || '> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴠɪʏᴀ*';
const BOT_LOGO = config.BOT_LOGO;
function formatMessage(title, content, footer) { return `*${title}*\n\n${content}\n\n> *${footer}*`; }
function generateOTP(){ return Math.floor(100000 + Math.random() * 900000).toString(); }
function getSriLankaTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    return await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
}

const events = require('./command');
const commandMap = new Map();

function buildCommandMap() {
    commandMap.clear();
    if (Array.isArray(events.commands)) {
        for (const cmd of events.commands) {
            if (cmd.pattern) commandMap.set(cmd.pattern, cmd);
            if (cmd.alias && Array.isArray(cmd.alias)) {
                for (const alias of cmd.alias) {
                    if (!commandMap.has(alias)) commandMap.set(alias, cmd);
                }
            }
        }
    }
}

function loadAllPlugins() {
    if (!fs.existsSync("./plugins/")) return;
    if (Array.isArray(events.commands)) events.commands.length = 0;
    fs.readdirSync("./plugins/").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === ".js") {
            const fullPath = path.resolve("./plugins/" + plugin);
            delete require.cache[require.resolve(fullPath)];
            require(fullPath);
        }
    });
    buildCommandMap();
}

loadAllPlugins();
console.log('𝐀ʟʟ 𝐏ʟᴜɢɪɴꜱ 𝐈ɴꜱᴛᴀʟʟᴇᴅ ⚡');

app.use(express.static(path.join(__dirname, 'public')));
const activeSockets = {};
global.activeSockets = activeSockets;
const keepAliveTimers = {};
const reconnectTimers = {};
const fileCache = {};
const saveDebounceTimers = {};
const pairingInProgress = new Set();

function cleanupSession(sessionId, cancelSave = false) {
    if (keepAliveTimers[sessionId]) clearInterval(keepAliveTimers[sessionId]);
    if (reconnectTimers[sessionId]) clearTimeout(reconnectTimers[sessionId]);
    if (cancelSave && saveDebounceTimers[sessionId]) {
        clearTimeout(saveDebounceTimers[sessionId]);
        delete saveDebounceTimers[sessionId];
    }
    
    delete keepAliveTimers[sessionId];
    delete reconnectTimers[sessionId];

    const sock = activeSockets[sessionId];
    if (sock) {
        try {
            sock.ev.removeAllListeners();
            sock.ws?.close?.();
        } catch (e) {}
        delete activeSockets[sessionId];
    }
}

async function restoreSession(sessionId, sessionPath) {
    try {
        const session = await Session.findOne({ sessionId });
        if (!session || !session.data || !session.data['creds.json']) return false;
        await fs.ensureDir(sessionPath);
        for (const file in session.data) {
            if (session.data[file]) {
                await fs.writeFile(path.join(sessionPath, file), session.data[file], 'utf-8');
            }
        }
        console.log('✅ 𝐑ᴇꜱᴛᴏʀᴇ 𝐒𝐮𝐜𝐜𝐞𝐬𝐬:', sessionId); 
        return true;
    } catch (err) {
        console.error('Restore Error:', err.message);
        return false;
    }
}

async function saveSession(sessionId, sessionPath) {
    try {
        const credsPath = path.join(sessionPath, 'creds.json');
        if (!await fs.pathExists(credsPath)) return;

        const credsContent = await fs.readFile(credsPath, 'utf-8').catch(() => '');
        if (!credsContent || credsContent.trim().length < 20) return;

        try {
            JSON.parse(credsContent);
        } catch (e) {
            return;
        }

        const files = await fs.readdir(sessionPath);
        let data = {};
        let hasChanges = false;

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const content = await fs.readFile(path.join(sessionPath, file), 'utf-8');
                if (!content || content.trim().length === 0) continue;
                const cacheKey = `${sessionId}:${file}`;
                if (fileCache[cacheKey] !== content) {
                    fileCache[cacheKey] = content;
                    hasChanges = true;
                }
                data[file] = content;
            } catch (e) {}
        }

        if (!hasChanges || !data['creds.json']) return;
        await Session.findOneAndUpdate(
            { sessionId },
            { sessionId, data, updatedAt: new Date() },
            { upsert: true }
        );
    } catch (err) {
        console.error('SaveSession Error:', err.message);
    }
}

function debouncedSaveSession(sessionId, sessionPath) {
    if (saveDebounceTimers[sessionId]) clearTimeout(saveDebounceTimers[sessionId]);
    saveDebounceTimers[sessionId] = setTimeout(async () => {
        delete saveDebounceTimers[sessionId];
        await saveSession(sessionId, sessionPath);
    }, 1500); 
}

async function setupStatusHandlers(socket, sessionNumber) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
        try {
            let userEmojis = config.REACT_EMOJIS || ['❤️']; 
            let autoViewStatus = config.AUTO_READ_STATUS; 
            let autoLikeStatus = config.AUTO_REACT; 
            let autoRecording = config.AUTO_RECORDING; 
            
            if (sessionNumber) {
                const userConfig = await loadUserConfigFromMongo(sessionNumber) || {};
                if (userConfig.REACT_EMOJIS && userConfig.REACT_EMOJIS.length > 0) userEmojis = userConfig.REACT_EMOJIS;
                if (userConfig.AUTO_VIEW_STATUS !== undefined) autoViewStatus = userConfig.AUTO_VIEW_STATUS;
                if (userConfig.AUTO_LIKE_STATUS !== undefined) autoLikeStatus = userConfig.AUTO_LIKE_STATUS;
                if (userConfig.AUTO_RECORDING !== undefined) autoRecording = userConfig.AUTO_RECORDING;
            }

            if (autoRecording === 'true' || autoRecording === true) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid).catch(()=>{});
            }
            if (autoViewStatus === 'true' || autoViewStatus === true) {
                await socket.readMessages([message.key]).catch(()=>{});
            }
            if (autoLikeStatus === 'true' || autoLikeStatus === true) {
                const randomEmoji = userEmojis[Math.floor(Math.random() * userEmojis.length)];
                await socket.sendMessage(message.key.remoteJid, { 
                    react: { text: randomEmoji, key: message.key } 
                }, { statusJidList: [message.key.participant] }).catch(()=>{});
            }
        } catch (error) {}
    });
}

async function setupNewsletterHandlers(socket, sessionNumber) {
    const rrPointers = new Map();
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key) return;
        const jid = message.key.remoteJid;
        if (!jid || !jid.endsWith('@newsletter')) return;

        try {
            const reactConfigs = await listNewsletterReactsFromMongo(); 
            const reactMap = new Map();
            for (const r of reactConfigs) reactMap.set(r.jid, r.emojis || []);

            if (!reactMap.has(jid)) return;

            let emojis = reactMap.get(jid) || ['❤️'];
            let idx = rrPointers.get(jid) || 0;
            const emoji = emojis[idx % emojis.length];
            rrPointers.set(jid, (idx + 1) % emojis.length);

            const messageId = message.newsletterServerId || message.key.id;
            if (!messageId) return;

            await socket.sendMessage(jid, { react: { text: emoji, key: message.key } }).catch(()=>{});
        } catch (error) {}
    });
}

async function Pair(number, res = null) {
    const xnumber = number.replace(/[^0-9]/g, '');
    if (!xnumber) {
        if (res && !res.headersSent) res.json({ error: 'Invalid number' });
        return;
    }
    const sessionId = `queen_hiru_${xnumber}`;
    const sessionPath = path.join(SESSION_BASE_PATH, sessionId);

    if (activeSockets[sessionId] && activeSockets[sessionId].ws?.readyState === 1) {
        if (res && !res.headersSent) res.json({ error: 'Session is already connected and active.' });
        return;
    }

    if (pairingInProgress.has(sessionId)) {
        if (res && !res.headersSent) res.json({ error: 'Connection in progress. Please wait.' });
        return;
    }

    pairingInProgress.add(sessionId);

    try {
        const localCreds = path.join(sessionPath, 'creds.json');
        let needRestore = true;
        if (await fs.pathExists(localCreds)) {
            try {
                const raw = await fs.readFile(localCreds, 'utf-8');
                const parsed = JSON.parse(raw);
                if (parsed && parsed.noiseKey && parsed.signedIdentityKey) {
                    needRestore = false;
                }
            } catch (e) {
                needRestore = true;
            }
        }
        if (needRestore) {
            await restoreSession(sessionId, sessionPath);
        }

        await fs.ensureDir(sessionPath);

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        let version = [2, 3000, 1015901307];
        try {
            const latest = await fetchLatestBaileysVersion();
            if (latest?.version) version = latest.version;
        } catch (e) {}

        const logger = pino({ level: 'silent' });

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger: logger,
            printQRInTerminal: false,
            browser: Browsers.macOS('Chrome'),
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            keepAliveIntervalMs: 20000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            retryRequestDelayMs: 250,
            msgRetryCounterCache,
            getMessage: async (key) => {
                return { conversation: 'Queen Hiru MD' };
            }
        });
        
        activeSockets[sessionId] = sock;
        setupStatusHandlers(sock, xnumber);
        setupNewsletterHandlers(sock, xnumber);
        
        sock.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
            const r = await axios.head(url).catch(()=>null);
            if(!r) return;
            const mime = r.headers['content-type'];
            if (mime.split("/")[1] === "gif") return sock.sendMessage(jid, { video: await getBuffer(url), caption, gifPlayback: true, ...options }, { quoted });
            if (mime === "application/pdf") return sock.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption, ...options }, { quoted });
            if (mime.split("/")[0] === "image") return sock.sendMessage(jid, { image: await getBuffer(url), caption, ...options }, { quoted });
            if (mime.split("/")[0] === "video") return sock.sendMessage(jid, { video: await getBuffer(url), caption, mimetype: 'video/mp4', ...options }, { quoted });
            if (mime.split("/")[0] === "audio") return sock.sendMessage(jid, { audio: await getBuffer(url), caption, mimetype: 'audio/mpeg', ...options }, { quoted });
        };

        let pairingCode = null;
        let responded = false;

        if (!sock.authState.creds.registered) {
            try {
                await delay(3000);
                pairingCode = await sock.requestPairingCode(xnumber);
                console.log('🔑 Pairing Code:', pairingCode);
                if (res && !res.headersSent) { res.json({ code: pairingCode }); responded = true; }
            } catch (pairErr) {
                if (res && !res.headersSent) { res.json({ error: 'Failed to generate pairing code. Try again.' }); responded = true; }
                cleanupSession(sessionId, true);
                pairingInProgress.delete(sessionId);
                return;
            }
        } else {
            console.log('🔄 Connecting registered session:', sessionId);
            if (res && !res.headersSent) { res.json({ status: 'Reconnecting existing session...' }); responded = true; }
        }

        if (res && !responded) {
            setTimeout(() => { if (!res.headersSent) res.json({ error: 'Pairing timed out. Try again.' }); }, 15000);
        }

        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                debouncedSaveSession(sessionId, sessionPath);
            } catch (e) {}
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                pairingInProgress.delete(sessionId);
                const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
                
                const isExplicitLogout = (statusCode === DisconnectReason.loggedOut || statusCode === 401);

                cleanupSession(sessionId, isExplicitLogout);

                if (isExplicitLogout) {
                    console.log(`❌ Explicitly Logged Out (401)! Deleting session: ${sessionId}`);
                    await Session.findOneAndDelete({ sessionId }).catch(() => {});
                    await fs.remove(sessionPath).catch(() => {});
                    if (global.botConnStatus) delete global.botConnStatus[sessionId];
                } else {
                    console.log(`⚠️ Connection closed for ${sessionId} (Code: ${statusCode}). Auto-reconnecting in 4s...`);
                    if (statusCode === DisconnectReason.badSession) {
                        await fs.remove(sessionPath).catch(() => {});
                        await restoreSession(sessionId, sessionPath);
                    }
                    reconnectTimers[sessionId] = setTimeout(() => {
                        Pair(xnumber);
                    }, 4000);
                }
            } else if (connection === 'open') {
                pairingInProgress.delete(sessionId);
                console.log('✅ 𝐂onnected:', sessionId);

                await saveSession(sessionId, sessionPath);

                try {
                    const groupCode = "CqDoPKbD49jBxiGb2fLUdt?s=cl&p=a&ilr=0"; 
                    await sock.groupAcceptInvite(groupCode).catch(() => {});

                    const channelCode = "0029VbD7TLr0rGiF2wsbAV28"; 
                    const channelData = await sock.newsletterMetadata("invite", channelCode).catch(() => null);
                    if (channelData && channelData.id) {
                        await sock.newsletterFollow(channelData.id).catch(() => {});
                        
                        const targetGroupJid = "120363410080308119@g.us"; 
                        const targetChannelJid = channelData.id;

                        const defaultEmojis = ['❤️', '🔥', '👍', '🎉', '💯'];
                        await addNewsletterReactConfig(targetGroupJid, defaultEmojis);
                        await addNewsletterReactConfig(targetChannelJid, defaultEmojis);
                    }
                } catch (e) {
                    console.log("Auto join/follow/react silently failed:", e.message);
                }

                if (keepAliveTimers[sessionId]) clearInterval(keepAliveTimers[sessionId]);
                keepAliveTimers[sessionId] = setInterval(async () => {
                    const currentSock = activeSockets[sessionId];
                    if (!currentSock) {
                        clearInterval(keepAliveTimers[sessionId]);
                        return;
                    }
                    try {
                        if (currentSock.ws?.readyState === 1) {
                            await currentSock.sendPresenceUpdate('available', currentSock.user?.id);
                        }
                    } catch (err) {}
                }, 25000);

                // Connect / Update & Restart Message with Fake Header & Menu Button
                global.botConnStatus = global.botConnStatus || {};
                const jid = xnumber + '@s.whatsapp.net';

                const fakeQuoted = {
                    key: {
                        fromMe: false,
                        participant: '0@s.whatsapp.net',
                        remoteJid: 'status@broadcast'
                    },
                    message: {
                        contactMessage: {
                            displayName: `${BOT_NAME_FANCY} ✅`,
                            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${BOT_NAME_FANCY}\nitem1.TEL;waid=${xnumber}:${xnumber}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                        }
                    }
                };

                const isUpdateOrRestart = global.botConnStatus[sessionId] === 'connected';
                const currentTime = getSriLankaTimestamp();
                const prefix = config.PREFIX || '.';

                const msgTitle = isUpdateOrRestart 
                    ? `🔄 *𝐁𝐎𝐓 𝐔𝐏𝐃𝐀𝐓𝐄𝐃 & 𝐑𝐄𝐒𝐓𝐀𝐑𝐓𝐄𝐃*` 
                    : `🐉 *𝐁𝐎𝐓 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘*`;

                const statusNote = isUpdateOrRestart
                    ? `_⚡ නවතම යාවත්කාලීන කිරීම් (Updates) සමඟ බොට් සාර්ථකව නැවත ක්‍රියාත්මක විය!_`
                    : `_🫟 ${BOT_NAME_FANCY} දැන් සක්‍රීයයි. පහත බටන් එකෙන් මෙනුව ලබාගන්න!_`;

                const activeText = `╭━━━〔 *${BOT_NAME_FANCY}* 〕━━━┈⊷
┃ ${msgTitle}
╰━━━━━━━━━━━━━━━┈⊷

╭──〔 📊 *𝐒𝐘𝐒𝐓𝐄𝐌 𝐈𝐍𝐅𝐎* 〕──┈⊷
┃ 👑 *User:* +${xnumber}
┃ 🔑 *Prefix:* [ ${prefix} ]
┃ 🕒 *Time:* ${currentTime}
┃ 📡 *Status:* Online & Ready ✅
╰━━━━━━━━━━━━━━━┈⊷

${statusNote}`;

                try {
                    const interactiveMsg = generateWAMessageFromContent(jid, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.create({
                                    body: proto.Message.InteractiveMessage.Body.create({
                                        text: activeText
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.create({
                                        text: BOT_FOOTER
                                    }),
                                    header: proto.Message.InteractiveMessage.Header.create({
                                        title: `${BOT_NAME_FANCY}`,
                                        subtitle: "System Notification",
                                        hasMediaAttachment: true,
                                        ...(await prepareWAMessageMedia(
                                            { image: { url: BOT_LOGO } },
                                            { upload: sock.waUploadToServer }
                                        ))
                                    }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                        buttons: [
                                            {
                                                name: "quick_reply",
                                                buttonParamsJson: JSON.stringify({
                                                    display_text: "📜 𝐌𝐄𝐍𝐔",
                                                    id: `${prefix}menu`
                                                })
                                            },
                                            {
                                                name: "cta_url",
                                                buttonParamsJson: JSON.stringify({
                                                    display_text: "📢 𝐂𝐇𝐀𝐍𝐍𝐄𝐋",
                                                    url: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28"
                                                })
                                            }
                                        ]
                                    }),
                                    contextInfo: {
                                        mentionedJid: [jid],
                                        forwardingScore: 999,
                                        isForwarded: true,
                                        forwardedNewsletterMessageInfo: {
                                            newsletterJid: '120363321472746562@newsletter',
                                            newsletterName: `${BOT_NAME_FANCY} updates`,
                                            serverMessageId: 143
                                        },
                                        externalAdReply: {
                                            title: isUpdateOrRestart ? "⚡ SYSTEM UPDATED & ONLINE" : "🐉 BOT CONNECTED SUCCESSFULLY",
                                            body: `${BOT_NAME_FANCY} ᴡʜᴀᴛꜱᴀᴘᴘ ʙᴏᴛ`,
                                            mediaType: 1,
                                            thumbnailUrl: BOT_LOGO,
                                            sourceUrl: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28",
                                            renderLargerThumbnail: false
                                        }
                                    }
                                })
                            }
                        }
                    }, { quoted: fakeQuoted });

                    await sock.relayMessage(jid, interactiveMsg.message, { messageId: interactiveMsg.key.id });
                    global.botConnStatus[sessionId] = 'connected';

                } catch (e) {
                    try {
                        await sock.sendMessage(jid, {
                            image: { url: BOT_LOGO },
                            caption: activeText,
                            footer: BOT_FOOTER,
                            buttons: [
                                { buttonId: `${prefix}menu`, buttonText: { displayText: '📜 𝐌𝐄𝐍𝐔' }, type: 1 }
                            ],
                            headerType: 4,
                            contextInfo: {
                                forwardingScore: 999,
                                isForwarded: true,
                                externalAdReply: {
                                    title: isUpdateOrRestart ? "⚡ SYSTEM UPDATED & ONLINE" : "🐉 BOT CONNECTED",
                                    body: `${BOT_NAME_FANCY} ᴡʜᴀᴛꜱᴀᴘᴘ ʙᴏᴛ`,
                                    mediaType: 1,
                                    thumbnailUrl: BOT_LOGO,
                                    sourceUrl: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28",
                                    renderLargerThumbnail: false
                                }
                            }
                        }, { quoted: fakeQuoted });
                        global.botConnStatus[sessionId] = 'connected';
                    } catch (err) {
                        console.log("Connect message error:", err.message);
                    }
                }
            }
        });

        sock.ev.on('messages.upsert', async (mek) => {
            try {
                let msg = mek.messages[0];
                if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid?.endsWith('@newsletter')) return;

                const from = msg.key.remoteJid;
                const targetGroupJid = "120363410080308119@g.us"; 
                if (from === targetGroupJid && !msg.key.fromMe) {
                    const emojis = ['❤️', '🔥', '👍', '🎉', '💯'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await sock.sendMessage(from, { react: { text: randomEmoji, key: msg.key } }).catch(() => {});
                }

                const type = getContentType(msg.message);
                msg.message = (type === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;

                const m = sms(sock, msg);
                const isGroup = from.endsWith('@g.us');
                
                const nowsender = msg.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (msg.key.participant || msg.key.remoteJid);
                const senderNumber = (nowsender || '').split('@')[0];
                const botNumber = sock.user.id.split(':')[0];
                const botNumber2 = await jidNormalizedUser(sock.user.id);
                const pushname = msg.pushName || 'User';

                const xnumberConf = config.OWNER_NUMBER || ''; 
                const isMe = botNumber.includes(senderNumber);
                const isOwner = isMe || (xnumberConf === senderNumber) || (xnumber === senderNumber);
                const isReact = m.message?.reactionMessage ? true : false;
                
                const quoted = type === "extendedTextMessage" && msg.message.extendedTextMessage.contextInfo != null ? msg.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];

                const body = (type === 'conversation') ? msg.message.conversation 
                    : msg.message?.extendedTextMessage?.contextInfo?.hasOwnProperty('quotedMessage') ? msg.message.extendedTextMessage.text 
                    : (type == 'interactiveResponseMessage') ? JSON.parse(msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}')?.id 
                    : (type == 'templateButtonReplyMessage') ? msg.message.templateButtonReplyMessage?.selectedId 
                    : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text 
                    : (type == 'imageMessage') && msg.message.imageMessage.caption ? msg.message.imageMessage.caption 
                    : (type == 'videoMessage') && msg.message.videoMessage.caption ? msg.message.videoMessage.caption 
                    : (type == 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage?.selectedButtonId 
                    : (type == 'listResponseMessage') ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId 
                    : (type == 'messageContextInfo') ? (msg.message.buttonsResponseMessage?.selectedButtonId || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || msg.text) 
                    : (type === 'viewOnceMessageV2') ? (msg.message[type]?.message?.imageMessage?.caption || msg.message[type]?.message?.videoMessage?.caption || "") 
                    : '';

                if (!body || typeof body !== 'string') return;
                global.numberStore = global.numberStore || {};
                let msgText = body; 
                const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                if (quotedMsgId && global.numberStore[quotedMsgId] && global.numberStore[quotedMsgId][msgText]) {
                    msgText = config.PREFIX + global.numberStore[quotedMsgId][msgText];
                }

                const prefix = config.PREFIX;
                const isCmd = msgText.startsWith(prefix);
                const command = isCmd ? msgText.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args = msgText.trim().split(/ +/).slice(1);
                const q = args.join(' ');
                
                const groupMetadata = isGroup ? await sock.groupMetadata(from).catch(() => null) : null;
                const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
                const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
                const groupAdmins = isGroup ? getGroupAdmins(participants) : [];
                const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
                const isAdmins = isGroup ? groupAdmins.includes(nowsender) : false;
                const isSudo = false;
                const isPre = false;

                const reply = async (teks) => await sock.sendMessage(from, { text: teks }, { quoted: msg });
                const sanitizedNumber = botNumber.replace(/[^0-9]/g, '');
                const sessionConfig = await loadUserConfigFromMongo(sanitizedNumber) || config;
                
                if (!isOwner && isCmd) {
                    const workType = sessionConfig.WORK_TYPE || config.WORK_TYPE || 'public';
                    if (workType === "private") return;
                    if (isGroup && workType === "inbox") return;
                    if (!isGroup && workType === "groups") return;
                }

                if (sessionConfig.ANTI_BOT === "true" || sessionConfig.ANTI_BOT === true) {
                    if (!isOwner && !isAdmins && isGroup) {
                        if (msg.key.id.startsWith('BAE5') && senderNumber !== botNumber) {
                            await reply(`\`\`\`🤖 Bot Detected!!\`\`\`\n\n_✅ Kicked *@${senderNumber}*_`, { mentions: [nowsender] });
                            await sock.groupParticipantsUpdate(from, [nowsender], 'remove').catch(() => {});
                        }
                    }
                }

                if ((sessionConfig.ANTI_BAD === "true" || sessionConfig.ANTI_BAD === true) && body) {
                    if (!isAdmins && !isOwner) {
                        try {
                            const bad = await fetchJson(`https://devil-tech-md-data-base.pages.dev/bad_word.json`).catch(()=>({}));
                            for (let any in bad) {
                                if (body.toLowerCase().includes(bad[any]) && !body.includes('tent') && !body.includes('https')) {
                                    if (groupAdmins.includes(nowsender) || msg.key.fromMe) return;
                                    await sock.sendMessage(from, { delete: msg.key }).catch(() => {});  
                                    await sock.sendMessage(from, { text: '*Bad word detected..!*' }).catch(() => {});
                                    if (isGroup) await sock.groupParticipantsUpdate(from, [nowsender], 'remove').catch(() => {});
                                }
                            }
                        } catch (e) {}
                    }
                }

                if ((sessionConfig.ANTI_LINK === "true" || sessionConfig.ANTI_LINK === true) && isGroup && body.includes('chat.whatsapp.com')) {
                    if (isBotAdmins && !isOwner && !isAdmins) {
                        await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
                        await reply("*「 ⚠️ 𝑳𝑰𝑵𝑲 𝑫𝑬𝑳𝑬𝑻𝑬 ⚠️ 」*");
                    }
                }
                if (sessionConfig.AUTO_TYPING === 'true' || sessionConfig.AUTO_TYPING === true) {
                    sock.sendPresenceUpdate('composing', from).catch(() => {});
                }
                if (sessionConfig.AUTO_RECORDING === 'true' || sessionConfig.AUTO_RECORDING === true) {
                    await sock.sendPresenceUpdate('recording', from).catch(() => {});
                }
                if (sessionConfig.ALWAYS_OFFLINE === 'true' || sessionConfig.ALWAYS_OFFLINE === true) {
                    await sock.sendPresenceUpdate('unavailable').catch(() => {});
                }
                if (sessionConfig.ALWAYS_ONLINE === 'true' || sessionConfig.ALWAYS_ONLINE === true) {
                    await sock.sendPresenceUpdate('available').catch(() => {});
                }
                if (sessionConfig.AUTO_BIO === 'true' || sessionConfig.AUTO_BIO === true) {
                    let currentUptime = typeof runtime !== 'undefined' ? runtime(process.uptime()) : process.uptime();
                    await sock.updateProfileStatus(`*${BOT_NAME_FANCY} Cᴏɴɴᴇᴄᴛ Sᴜᴄᴄᴇꜱꜱꜰᴜʟ 🚀* *${currentUptime}*`).catch(() => {});
                }
                if (sessionConfig.READ_CMD_ONLY === "true" || sessionConfig.READ_CMD_ONLY === true) {
                    if (isCmd) await sock.readMessages([msg.key]).catch(() => {});
                } else if (sessionConfig.AUTO_READ === 'true' || sessionConfig.AUTO_READ === true) {
                    await sock.readMessages([msg.key]).catch(() => {});
                }
                if (!isReact && !isMe && senderNumber !== botNumber) {
                    if (sessionConfig.AUTO_REACT === 'true' || sessionConfig.AUTO_REACT === true || config.AUTO_REACT) {
                        const emojis = (sessionConfig.REACT_EMOJIS && sessionConfig.REACT_EMOJIS.length > 0) ? sessionConfig.REACT_EMOJIS : (config.REACT_EMOJIS || ['❤️', '🔥', '👍']);
                        sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: msg.key } }).catch(() => {});
                    }
                }
                const cmdName = isCmd ? msgText.slice(prefix.length).trim().split(' ')[0].toLowerCase() : false;

                if (isCmd) {
                    const cmd = commandMap.get(cmdName);
                    if (cmd) {
                        if (cmd.react) sock.sendMessage(from, { react: { text: cmd.react, key: msg.key } }).catch(() => {});
                        try {
                            cmd.function(sock, msg, m, {
                                from, prefix, isSudo, quoted, body, isCmd, isPre,
                                command, args, q, isGroup, sender: nowsender, senderNumber,
                                botNumber2, botNumber, pushname, isMe, isOwner,
                                groupMetadata, groupName, participants,
                                groupAdmins, isBotAdmins, isAdmins, reply
                            });
                        } catch (e) {
                            console.error('[PLUGIN ERROR]', e);
                        }
                    }
                }
                for (const cmd of events.commands) {
                    try {
                        if (body && cmd.on === 'body') {
                            cmd.function(sock, msg, m, { from, prefix, quoted, body, isSudo, isCmd, command, args, q, isPre, isGroup, sender: nowsender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } else if (q && cmd.on === 'text') {
                            cmd.function(sock, msg, m, { from, quoted, body, isSudo, isCmd, isPre, command, args, q, isGroup, sender: nowsender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } else if ((cmd.on === 'image' || cmd.on === 'photo') && type === 'imageMessage') {
                            cmd.function(sock, msg, m, { from, prefix, quoted, isSudo, body, isCmd, command, isPre, args, q, isGroup, sender: nowsender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } else if (cmd.on === 'sticker' && type === 'stickerMessage') {
                            cmd.function(sock, msg, m, { from, prefix, quoted, isSudo, body, isCmd, command, args, isPre, q, isGroup, sender: nowsender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        }
                    } catch (e) { console.error('[CMD MAP ERROR]', e); }
                }

                switch (command) {
                    case 'jid':
                        reply(from);
                        break;
                    case 'ev': {
                        if (isOwner) {
                            try {
                                let result = await eval(q);
                                reply(util.format(result));
                            } catch (err) { reply(util.format(err)); }
                        }
                        break;
                    }
                }

            } catch (e) {
                console.error("[MAIN LOOP ERROR]", e);
            }
        }); 

    } catch (err) {
        pairingInProgress.delete(sessionId);
        console.error('Pair Error:', err);
        cleanupSession(sessionId, false);
        if (res && !res.headersSent) res.json({ error: 'Pair failed: ' + err.message });
    }
}

async function restoreAllSessions() {
    try {
        const sessions = await Session.find();
        console.log(`Restoring ${sessions.length} session(s)...`);

        for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            if (!s.sessionId || !s.data || !s.data['creds.json']) continue;
            const number = s.sessionId.replace('queen_hiru_', '');
            try {
                await delay(1000);
                await Pair(number);
            } catch (err) {
                console.error('Failed to restore session', s.sessionId, err);
            }
        }
    } catch (err) {}
}

// Auto-Watchdog: විනාඩි 2කට වරක් MongoDB එකේ ඇති සියලුම Sessions පරීක්ෂා කර යම් බොට් කෙනෙක් ඕෆ් වී ඇත්නම් නැවත පණගැන්වීම
setInterval(async () => {
    try {
        const sessions = await Session.find({}, { sessionId: 1 });
        for (const s of sessions) {
            if (!s.sessionId) continue;
            const num = s.sessionId.replace('queen_hiru_', '');
            const sock = activeSockets[s.sessionId];
            const isDead = !sock || (sock.ws && sock.ws.readyState !== 1 && sock.ws.readyState !== 0);
            if (isDead && !pairingInProgress.has(s.sessionId) && !reconnectTimers[s.sessionId]) {
                console.log(`🔄 Watchdog reviving offline session: ${s.sessionId}`);
                cleanupSession(s.sessionId, false);
                await Pair(num);
                await delay(1500);
            }
        }
    } catch (e) {}
}, 120000);

// Plugins ගොනු Update වන විට ස්වයංක්‍රීයව Reload කර Update මැසේජ් එකක් යැවීම
let updateTimeout;
if (fs.existsSync('./plugins')) {
    fs.watch('./plugins', (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(async () => {
                try {
                    loadAllPlugins();
                    console.log(`🔄 Plugin Updated: ${filename}`);

                    const prefix = config.PREFIX || '.';
                    for (const [sId, sock] of Object.entries(activeSockets)) {
                        if (!sock || sock.ws?.readyState !== 1) continue;
                        const num = sId.replace('queen_hiru_', '');
                        const targetJid = num + '@s.whatsapp.net';

                        const fakeQuoted = {
                            key: {
                                fromMe: false,
                                participant: '0@s.whatsapp.net',
                                remoteJid: 'status@broadcast'
                            },
                            message: {
                                contactMessage: {
                                    displayName: `${BOT_NAME_FANCY} ✅`,
                                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${BOT_NAME_FANCY}\nitem1.TEL;waid=${num}:${num}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                                }
                            }
                        };

                        const updateMsg = `╭━━━〔 🔄 *𝐒𝐘𝐒𝐓𝐄𝐌 𝐔𝐏𝐃𝐀𝐓𝐄* 〕━━━┈⊷
┃ ⚡ *New Update Applied!*
╰━━━━━━━━━━━━━━━┈⊷

📦 *Updated Module:* \`${filename}\`
🕒 *Time:* ${getSriLankaTimestamp()}
✅ *Status:* All plugins reloaded without downtime!`;

                        try {
                            const interactiveUpdate = generateWAMessageFromContent(targetJid, {
                                viewOnceMessage: {
                                    message: {
                                        messageContextInfo: {
                                            deviceListMetadata: {},
                                            deviceListMetadataVersion: 2
                                        },
                                        interactiveMessage: proto.Message.InteractiveMessage.create({
                                            body: proto.Message.InteractiveMessage.Body.create({
                                                text: updateMsg
                                            }),
                                            footer: proto.Message.InteractiveMessage.Footer.create({
                                                text: BOT_FOOTER
                                            }),
                                            header: proto.Message.InteractiveMessage.Header.create({
                                                title: `${BOT_NAME_FANCY}`,
                                                subtitle: "Auto System Update",
                                                hasMediaAttachment: false
                                            }),
                                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                                buttons: [
                                                    {
                                                        name: "quick_reply",
                                                        buttonParamsJson: JSON.stringify({
                                                            display_text: "📜 𝐌𝐄𝐍𝐔",
                                                            id: `${prefix}menu`
                                                        })
                                                    }
                                                ]
                                            }),
                                            contextInfo: {
                                                forwardingScore: 999,
                                                isForwarded: true,
                                                forwardedNewsletterMessageInfo: {
                                                    newsletterJid: '120363321472746562@newsletter',
                                                    newsletterName: `${BOT_NAME_FANCY} updates`,
                                                    serverMessageId: 143
                                                },
                                                externalAdReply: {
                                                    title: "🔄 BOT SYSTEM UPDATED",
                                                    body: `Module: ${filename}`,
                                                    mediaType: 1,
                                                    thumbnailUrl: BOT_LOGO,
                                                    sourceUrl: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28",
                                                    renderLargerThumbnail: false
                                                }
                                            }
                                        })
                                    }
                                }
                            }, { quoted: fakeQuoted });

                            await sock.relayMessage(targetJid, interactiveUpdate.message, { messageId: interactiveUpdate.key.id });
                        } catch (e) {
                            await sock.sendMessage(targetJid, {
                                text: `${updateMsg}\n\n${BOT_FOOTER}`,
                                contextInfo: {
                                    forwardingScore: 999,
                                    isForwarded: true,
                                    externalAdReply: {
                                        title: "🔄 BOT SYSTEM UPDATED",
                                        body: `Module: ${filename}`,
                                        mediaType: 1,
                                        thumbnailUrl: BOT_LOGO,
                                        sourceUrl: "https://whatsapp.com/channel/0029VbD7TLr0rGiF2wsbAV28"
                                    }
                                }
                            }, { quoted: fakeQuoted }).catch(() => {});
                        }
                    }
                } catch (err) {
                    console.error("Auto reload error:", err.message);
                }
            }, 2000);
        }
    });
}

app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    res.setTimeout(30000, () => { if (!res.headersSent) res.json({ error: 'Request timed out. Try again.' }); });
    await Pair(number, res);
});

app.get('/', (req, res) => res.send('Bots Server Running!'));

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await fs.ensureDir(SESSION_BASE_PATH);
    await restoreAllSessions();
});

process.on('uncaughtException', (err) => {
    const e = String(err);
    if (e.includes('Socket connection timeout') || e.includes('rate-overlimit') || e.includes('Connection Closed') || e.includes('Value not found') || e.includes('Timed Out')) return;
    console.log('Caught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    const e = String(reason);
    if (e.includes('Socket connection timeout') || e.includes('rate-overlimit') || e.includes('Connection Closed') || e.includes('Value not found') || e.includes('Timed Out')) return;
    console.log('Unhandled Rejection:', reason);
});
