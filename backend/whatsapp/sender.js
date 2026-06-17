const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { getClient } = require('./client');
const db = require('../database/db');

require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

/**
 * Normalize phone number to WhatsApp JID
 */
function normalizeJid(number) {
  // If already a full JID, return as-is
  if (typeof number === 'string' && number.includes('@')) return number;
  // Strip everything except digits
  const clean = String(number).replace(/[^\d]/g, '');
  return `${clean}@s.whatsapp.net`;
}

/**
 * Download file from URL and save to uploads
 */
async function downloadFromUrl(url, sessionId) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const contentType = response.headers['content-type'] || 'application/octet-stream';
  const ext = mime.extension(contentType) || 'bin';
  const filename = `${Date.now()}_${sessionId}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  fs.writeFileSync(filePath, Buffer.from(response.data));
  return { filePath, contentType, filename };
}

/**
 * Save base64 file to uploads
 */
function saveBase64File(b64, mimeType, sessionId) {
  const ext = mime.extension(mimeType) || 'bin';
  const filename = `${Date.now()}_${sessionId}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const buffer = Buffer.from(b64, 'base64');
  fs.writeFileSync(filePath, buffer);
  return { filePath, buffer, filename };
}

/**
 * Detect type from mime
 */
function detectTypeFromMime(mimeType) {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'document';
}

/**
 * Core message sender
 */
async function sendMessage(sessionId = 'default', to, type, options = {}) {
  const sock = getClient(sessionId);
  if (!sock) throw new Error('WhatsApp session not connected');

  const jid = normalizeJid(to);
  let sentMsg = null;
  const sendOpts = {};

  if (options.quotedMessageId) {
    sendOpts.quoted = {
      key: { id: options.quotedMessageId, remoteJid: jid }
    };
  }

  switch (type) {
    case 'text': {
      sentMsg = await sock.sendMessage(jid, { text: options.text }, sendOpts);
      break;
    }

    case 'image': {
      const content = await resolveMedia(options, sessionId);
      sentMsg = await sock.sendMessage(jid, {
        image: content.buffer,
        caption: options.caption || '',
        mimetype: content.mimeType || 'image/jpeg',
      }, sendOpts);
      if (sentMsg) sentMsg.savedFilePath = content.tempPath;
      break;
    }

    case 'audio': {
      const content = await resolveMedia(options, sessionId);
      sentMsg = await sock.sendMessage(jid, {
        audio: content.buffer,
        mimetype: content.mimeType || 'audio/mpeg',
        ptt: options.ptt === true,
      }, sendOpts);
      if (sentMsg) sentMsg.savedFilePath = content.tempPath;
      break;
    }

    case 'video': {
      const content = await resolveMedia(options, sessionId);
      sentMsg = await sock.sendMessage(jid, {
        video: content.buffer,
        caption: options.caption || '',
        mimetype: content.mimeType || 'video/mp4',
      }, sendOpts);
      if (sentMsg) sentMsg.savedFilePath = content.tempPath;
      break;
    }

    case 'document':
    case 'pdf': {
      const content = await resolveMedia(options, sessionId);
      sentMsg = await sock.sendMessage(jid, {
        document: content.buffer,
        mimetype: content.mimeType || 'application/octet-stream',
        fileName: options.fileName || content.filename || 'document',
        caption: options.caption || options.text || '',
      }, sendOpts);
      if (sentMsg) sentMsg.savedFilePath = content.tempPath;
      break;
    }

    case 'sticker': {
      const content = await resolveMedia(options, sessionId);
      sentMsg = await sock.sendMessage(jid, {
        sticker: content.buffer,
      }, sendOpts);
      if (sentMsg) sentMsg.savedFilePath = content.tempPath;
      break;
    }

    default:
      throw new Error(`Unsupported message type: ${type}`);
  }

  return sentMsg;
}

async function resolveMedia(options, sessionId) {
  let buffer, mimeType, filename, tempPath;

  if (options.fileUrl) {
    const { filePath, contentType, filename: fname } = await downloadFromUrl(options.fileUrl, sessionId);
    buffer = fs.readFileSync(filePath);
    mimeType = contentType;
    filename = fname;
    tempPath = filePath;
  } else if (options.fileB64) {
    // Try to detect mime from base64 header
    const b64str = options.fileB64;
    let detectedMime = options.mimeType || 'application/octet-stream';

    // If data URI
    if (b64str.startsWith('data:')) {
      const parts = b64str.split(',');
      detectedMime = parts[0].split(':')[1].split(';')[0];
      const raw = parts[1];
      const { filePath, buffer: buf, filename: fname } = saveBase64File(raw, detectedMime, sessionId);
      buffer = buf;
      mimeType = detectedMime;
      filename = fname;
      tempPath = filePath;
    } else {
      const { filePath, buffer: buf, filename: fname } = saveBase64File(b64str, detectedMime, sessionId);
      buffer = buf;
      mimeType = detectedMime;
      filename = fname;
      tempPath = filePath;
    }
  } else if (options.filePath) {
    buffer = fs.readFileSync(options.filePath);
    mimeType = mime.lookup(options.filePath) || 'application/octet-stream';
    filename = path.basename(options.filePath);
    tempPath = null;
  } else {
    throw new Error('No media source provided (fileUrl, fileB64, or filePath required)');
  }

  return { buffer, mimeType, filename, tempPath };
}

function cleanupTemp(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
}

/**
 * Save outgoing message to DB
 */
async function saveOutgoingMessage(sessionId, jid, type, body, sentMsg, options = {}) {
  try {
    const msgId = sentMsg?.key?.id || `local_${Date.now()}`;
    
    // Convert temp file path to relative URL
    let mediaUrl = null;
    if (sentMsg?.savedFilePath) {
      const filename = path.basename(sentMsg.savedFilePath);
      mediaUrl = `/uploads/${filename}`;
    }

    const quotedId = options.quotedMessageId || null;

    await db.execute(
      `INSERT INTO messages (session_id, message_id, jid, from_me, type, body, media_url, status, timestamp, quoted_message_id)
       VALUES (?,?,?,1,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE updated_at=NOW()`,
      [sessionId, msgId, jid, type, body, mediaUrl, 'sent', Math.floor(Date.now() / 1000), quotedId]
    );

    await db.execute(
      `INSERT INTO chats (session_id, jid, last_message, last_message_time)
       VALUES (?,?,?,NOW())
       ON DUPLICATE KEY UPDATE last_message=VALUES(last_message), last_message_time=NOW(), updated_at=NOW()`,
      [sessionId, jid, body]
    );
  } catch (err) {
    console.error('saveOutgoingMessage error:', err.message);
  }
}

module.exports = {
  sendMessage,
  saveOutgoingMessage,
  normalizeJid,
};
