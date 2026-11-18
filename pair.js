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

const BOT_NAME_FANCY = config.BOT_NAME;
const BOT_FOOTER = config.BOT_FOOTER;
const BOT_LOGO = config.BOT_LOGO;
function formatMessage(title, content, footer) { return `*${title}*\n\n${content}\n\n> *${footer}*`; }
function generateOTP(){ return Math.floor(100000 + Math.random() * 900000).toString(); }
function getSriLankaTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    return await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
}
fs.readdirSync("./plugins/").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") require("./plugins/" + plugin);
});
console.log('𝐀ʟʟ 𝐏ʟᴜɢɪɴꜱ 𝐈ɴꜱᴛᴀʟʟᴇᴅ ⚡');

const events = require('./command');
const commandMap = new Map();
function buildCommandMap() {
    commandMap.clear();
    for (const cmd of events.commands) {
        if (cmd.pattern) commandMap.set(cmd.pattern, cmd);
        if (cmd.alias) {
            for (const alias of cmd.alias) {
                if (!commandMap.has(alias)) commandMap.set(alias, cmd);
            }
        }
    }
}
buildCommandMap();

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

        // creds.json එක Valid JSON එකක්දැයි පරීක්ෂා කිරීම (Corrupt වීම වැළැක්වීමට)
        try {
            JSON.parse(credsContent);
        } catch (e) {
            return;
        }

        const files = await fs.readdir(sessionPath);
        let data = {};
        let hasChanges = false;

        for (const file of files) {
            // අත්‍යවශ්‍ය auth ගොනු පමණක් ආරක්ෂිතව සේව් කිරීම
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
        const jid = mess
