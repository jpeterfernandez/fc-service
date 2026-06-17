const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const db = require('../database/db');
const { triggerWebhooks } = require('./webhooks');
const { processAutomation } = require('./automations');

require('dotenv').config();

const SESSIONS_DIR = process.env.SESSIONS_DIR || (
  process.env.APPDATA 
    ? path.join(process.env.APPDATA, 'WhatsAppPlatform', 'sessions')
    : './whatsapp/sessions'
);

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Global socket store
const clients = {};
const reconnectAttempts = {}; // track QR timeout retries per session
const MAX_QR_RECONNECTS = 3;  // max times to regenerate QR before stopping
let ioRef = null;

function setIO(io) {
  ioRef = io;
}

function emitToAll(event, data) {
  if (ioRef) ioRef.emit(event, data);
}

// ── Bug Fix #1: Use INSERT ... ON DUPLICATE KEY UPDATE so the row
//   always exists, and handle NULL qr_code correctly with explicit
//   column assignments instead of COALESCE-on-null tricks.
async function updateSessionStatus(sessionId, status, extra = {}) {
  try {
    // Build the update carefully so nulls actually overwrite values
    const phone = 'phone' in extra ? extra.phone : undefined;
    const name  = 'name'  in extra ? extra.name  : undefined;
    const qr    = 'qr'    in extra ? extra.qr    : undefined;

    // Always ensure the row exists
    await db.execute(
      `INSERT INTO sessions (session_id, status) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         phone_number  = CASE WHEN ? THEN ?    ELSE phone_number  END,
         account_name  = CASE WHEN ? THEN ?    ELSE account_name  END,
         qr_code       = CASE WHEN ? THEN ?    ELSE qr_code       END,
         connected_at  = CASE WHEN ?='connected' THEN NOW() ELSE connected_at END,
         updated_at    = NOW()`,
      [
        sessionId, status,
        phone  !== undefined ? 1 : 0,  phone  ?? null,
        name   !== undefined ? 1 : 0,  name   ?? null,
        qr     !== undefined ? 1 : 0,  qr     ?? null,
        status,
      ]
    );

    // Emit full session data to frontend
    const [rows] = await db.execute(
      `SELECT session_id, status, phone_number, account_name, qr_code, connected_at
       FROM sessions WHERE session_id=?`,
      [sessionId]
    );
    const sessionData = rows[0] || { session_id: sessionId, status };
    emitToAll('session:status', sessionData);
  } catch (err) {
    console.error('updateSessionStatus error:', err.message);
  }
}

async function connectWhatsApp(sessionId = 'default') {
  // Prevent duplicate connections — check both connected AND connecting states
  if (clients[sessionId]) {
    const existing = clients[sessionId];
    // If already fully connected, skip
    if (existing.user) {
      console.log(`⚠️  [${sessionId}] Already connected, skipping duplicate connect`);
      return existing;
    }
    // If socket exists but not connected yet (connecting), also skip
    // to avoid duplicate sockets competing
    console.log(`⚠️  [${sessionId}] Socket already initializing, skipping duplicate`);
    return existing;
  }

  const authPath = path.join(SESSIONS_DIR, sessionId);
  if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const version = [2, 3000, 1115400];

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    browser: ['WhatsApp Platform', 'Chrome', '120.0.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  clients[sessionId] = sock;

  // ── Credentials update ──────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Connection updates ───────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    console.log(`[connection.update] ${sessionId}: connection=${connection}, qr=${qr ? 'yes' : 'no'}, disconnect=${lastDisconnect?.error?.output?.statusCode}`);

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
        await updateSessionStatus(sessionId, 'connecting', { qr: qrDataUrl });
        console.log(`📱 [${sessionId}] QR Code generated – scan it now`);
      } catch (e) {
        console.error('QR generation error:', e.message);
      }
    }

    if (connection === 'open') {
      const user = sock.user;
      const phone = user?.id?.split(':')[0] || user?.id?.split('@')[0] || '';
      const name  = user?.name || user?.verifiedName || phone;

      reconnectAttempts[sessionId] = 0; // reset on successful connect
      await updateSessionStatus(sessionId, 'connected', { phone, name, qr: null });
      console.log(`✅ [${sessionId}] Connected as ${name} (${phone})`);

      triggerWebhooks(sessionId, 'session.connected', { sessionId, phone, name });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`⚠️  [${sessionId}] Closed. Code=${statusCode} Reconnect=${!isLoggedOut}`);

      delete clients[sessionId];

      if (isLoggedOut) {
        // Explicitly logged out — stop and mark disconnected
        reconnectAttempts[sessionId] = 0;
        await updateSessionStatus(sessionId, 'disconnected', { phone: null, name: null, qr: null });
        triggerWebhooks(sessionId, 'session.disconnected', { sessionId });
        return;
      }

      // Code 408 = QR scan timeout. Count retries to avoid infinite QR loop.
      if (statusCode === 408) {
        reconnectAttempts[sessionId] = (reconnectAttempts[sessionId] || 0) + 1;
        if (reconnectAttempts[sessionId] > MAX_QR_RECONNECTS) {
          console.log(`🛑 [${sessionId}] Too many QR timeouts (${reconnectAttempts[sessionId]}). Stopping auto-reconnect. Use the UI to reconnect manually.`);
          reconnectAttempts[sessionId] = 0;
          await updateSessionStatus(sessionId, 'disconnected', { phone: null, name: null, qr: null });
          return;
        }
        console.log(`🔄 [${sessionId}] QR timeout (attempt ${reconnectAttempts[sessionId]}/${MAX_QR_RECONNECTS}), retrying...`);
      } else {
        // Other error (network drop, etc.) — reset QR counter and reconnect normally
        reconnectAttempts[sessionId] = 0;
      }

      await updateSessionStatus(sessionId, 'connecting', { qr: null });
      setTimeout(() => connectWhatsApp(sessionId), 5000);
    }
  });

  // ── Presence updates ─────────────────────────────────────────
  sock.ev.on('presence.update', (data) => {
    emitToAll('presence:update', { sessionId, data });
  });

  // ── Incoming messages ────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (!msg.key?.remoteJid) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;

      await saveIncomingMessage(sessionId, msg);
      await processAutomation(sessionId, sock, msg);
      // triggerWebhooks is called inside saveIncomingMessage with media_url included
    }
  });

  // ── Message status (read receipts) ───────────────────────────
  sock.ev.on('messages.update', async (updates) => {
    for (const { key, update: upd } of updates) {
      if (upd?.status !== undefined) {
        const status = mapAckStatus(upd.status);
        try {
          await db.execute(
            `UPDATE messages SET status=?, updated_at=NOW()
             WHERE session_id=? AND message_id=?`,
            [status, sessionId, key.id]
          );
          emitToAll('message:status', { sessionId, messageId: key.id, status });
        } catch (e) {
          console.error('message status update error:', e.message);
        }
      }
    }
  });

  // ── Chats ─────────────────────────────────────────────────────
  sock.ev.on('chats.upsert', async (chats) => {
    for (const chat of chats) await upsertChat(sessionId, chat);
  });

  sock.ev.on('chats.update', async (updates) => {
    for (const update of updates) await upsertChat(sessionId, update);
  });

  // ── Contacts ─────────────────────────────────────────────────
  sock.ev.on('contacts.upsert', async (contacts) => {
    for (const contact of contacts) await upsertContact(sessionId, contact);
  });

  return sock;
}

// ── Helpers ──────────────────────────────────────────────────

function mapAckStatus(ack) {
  const map = { 0: 'pending', 1: 'sent', 2: 'delivered', 3: 'read', 4: 'read', '-1': 'error' };
  return map[String(ack)] || 'sent';
}

function getMessageType(msg) {
  const c = msg.message;
  if (!c) return 'unknown';
  if (c.conversation || c.extendedTextMessage) return 'text';
  if (c.imageMessage)    return 'image';
  if (c.audioMessage)    return 'audio';
  if (c.videoMessage)    return 'video';
  if (c.documentMessage) {
    const mime = c.documentMessage.mimetype || '';
    return mime.includes('pdf') ? 'pdf' : 'document';
  }
  if (c.stickerMessage)  return 'sticker';
  if (c.locationMessage) return 'location';
  if (c.contactMessage)  return 'contact';
  return 'unknown';
}

function getMessageBody(msg) {
  const c = msg.message;
  if (!c) return null;
  return (
    c.conversation ||
    c.extendedTextMessage?.text ||
    c.imageMessage?.caption ||
    c.videoMessage?.caption ||
    c.documentMessage?.caption ||
    c.documentMessage?.fileName ||
    null
  );
}

function buildMessagePayload(msg, mediaUrl = null) {
  return {
    id:        msg.key.id,
    from:      msg.key.remoteJid,
    fromMe:    msg.key.fromMe,
    type:      getMessageType(msg),
    body:      getMessageBody(msg),
    timestamp: msg.messageTimestamp,
    media_url: mediaUrl,
  };
}

// ── Download incoming media and save to uploads ───────────────
const MEDIA_TYPES = new Set(['image', 'audio', 'video', 'sticker', 'document', 'pdf']);
const MIME_EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4' };

async function downloadIncomingMedia(msg, type) {
  if (!MEDIA_TYPES.has(type)) return null;
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    if (!buffer || buffer.length === 0) return null;

    const c = msg.message;
    const mimeType =
      c?.imageMessage?.mimetype ||
      c?.audioMessage?.mimetype ||
      c?.videoMessage?.mimetype ||
      c?.stickerMessage?.mimetype ||
      c?.documentMessage?.mimetype ||
      'application/octet-stream';

    const ext = MIME_EXT[mimeType] || mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const filename = `${Date.now()}_${msg.key.id.slice(-6)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (e) {
    console.error('downloadIncomingMedia error:', e.message);
    return null;
  }
}

async function saveIncomingMessage(sessionId, msg) {
  try {
    const jid       = msg.key.remoteJid;
    const fromMe    = msg.key.fromMe ? 1 : 0;
    const type      = getMessageType(msg);
    const body      = getMessageBody(msg);
    const timestamp = msg.messageTimestamp;

    // Download media (stickers, images, audio, video) so the frontend can display them
    let mediaUrl = null;
    if (!fromMe && MEDIA_TYPES.has(type)) {
      mediaUrl = await downloadIncomingMedia(msg, type);
    }

    await db.execute(
      `INSERT INTO messages
        (session_id, message_id, jid, from_me, sender_jid, type, body, media_url, status, timestamp)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         body=COALESCE(VALUES(body), body),
         media_url=COALESCE(VALUES(media_url), media_url),
         updated_at=NOW()`,
      [
        sessionId, msg.key.id, jid, fromMe,
        msg.key.participant || jid,
        type, body, mediaUrl,
        fromMe ? 'sent' : 'received',
        timestamp,
      ]
    );

    // Bug Fix #2: Use proper CASE for conditional unread increment
    await db.execute(
      `INSERT INTO chats (session_id, jid, name, is_group, last_message, last_message_time, unread_count)
       VALUES (?,?,?,?,?,FROM_UNIXTIME(?), ?)
       ON DUPLICATE KEY UPDATE
         name            = COALESCE(VALUES(name), name),
         last_message    = VALUES(last_message),
         last_message_time = VALUES(last_message_time),
         unread_count    = CASE WHEN ? = 0 THEN unread_count + 1 ELSE unread_count END,
         updated_at      = NOW()`,
      [
        sessionId, jid,
        msg.pushName || jid.split('@')[0],
        isJidGroup(jid) ? 1 : 0,
        body || '', timestamp,
        fromMe ? 0 : 1,
        fromMe,
      ]
    );

    emitToAll('message:new', { sessionId, message: buildMessagePayload(msg, mediaUrl) });

    triggerWebhooks(sessionId, 'message.received', buildMessagePayload(msg, mediaUrl));

    // Background avatar fetch
    setTimeout(async () => {
      try {
        const sock = getClient(sessionId);
        if (sock) {
          const avatarUrl = await sock.profilePictureUrl(jid, 'image');
          if (avatarUrl) {
            await db.execute(
              `INSERT INTO contacts (session_id, jid, push_name, is_group, avatar_url)
               VALUES (?,?,?,?,?)
               ON DUPLICATE KEY UPDATE avatar_url=VALUES(avatar_url), push_name=COALESCE(VALUES(push_name), push_name)`,
              [sessionId, jid, msg.pushName || null, isJidGroup(jid) ? 1 : 0, avatarUrl]
            );
          }
        }
      } catch (e) {
        // Ignoring 401/404 errors for users without profile pictures
      }
    }, 100);

  } catch (err) {
    console.error('saveIncomingMessage error:', err.message);
  }
}

async function upsertChat(sessionId, chat) {
  try {
    const jid = chat.id;
    if (!jid) return;
    await db.execute(
      `INSERT INTO chats (session_id, jid, name, is_group, unread_count, last_message_time, pinned, archived)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name         = COALESCE(VALUES(name), name),
         unread_count = COALESCE(VALUES(unread_count), unread_count),
         pinned       = COALESCE(VALUES(pinned), pinned),
         archived     = COALESCE(VALUES(archived), archived),
         updated_at   = NOW()`,
      [
        sessionId, jid,
        chat.name || chat.subject || jid.split('@')[0],
        isJidGroup(jid) ? 1 : 0,
        chat.unreadCount || 0,
        chat.conversationTimestamp ? new Date(chat.conversationTimestamp * 1000) : null,
        chat.pinned ? 1 : 0,
        chat.archived ? 1 : 0,
      ]
    );
  } catch (err) {
    console.error('upsertChat error:', err.message);
  }
}

async function upsertContact(sessionId, contact) {
  try {
    const jid = contact.id;
    if (!jid) return;
    await db.execute(
      `INSERT INTO contacts (session_id, jid, phone, name, push_name, is_group)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name      = COALESCE(VALUES(name), name),
         push_name = COALESCE(VALUES(push_name), push_name),
         updated_at = NOW()`,
      [
        sessionId, jid,
        jid.split('@')[0],
        contact.name || contact.verifiedName || null,
        contact.notify || null,
        isJidGroup(jid) ? 1 : 0,
      ]
    );
  } catch (err) {
    console.error('upsertContact error:', err.message);
  }
}

// ── Public API ───────────────────────────────────────────────

function getClient(sessionId = 'default') {
  return clients[sessionId] || null;
}

async function disconnectSession(sessionId = 'default') {
  const sock = clients[sessionId];
  if (sock) {
    try { await sock.logout(); } catch {}
    delete clients[sessionId];
  }
  await updateSessionStatus(sessionId, 'disconnected', { phone: null, name: null, qr: null });
}

async function deleteSession(sessionId = 'default') {
  const sock = clients[sessionId];
  if (sock) {
    try { await sock.logout(); } catch {}
    delete clients[sessionId];
  }
  const authPath = path.join(SESSIONS_DIR, sessionId);
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
  }
  await db.execute(
    `UPDATE sessions SET status='disconnected', phone_number=NULL, account_name=NULL, qr_code=NULL, updated_at=NOW()
     WHERE session_id=?`,
    [sessionId]
  );
  emitToAll('session:status', { session_id: sessionId, status: 'disconnected', phone_number: null, account_name: null, qr_code: null });
}

module.exports = {
  connectWhatsApp,
  getClient,
  disconnectSession,
  deleteSession,
  setIO,
  updateSessionStatus,
  // Internal helper for force-reconnect
  _clearClient: (sessionId) => { delete clients[sessionId]; },
};
