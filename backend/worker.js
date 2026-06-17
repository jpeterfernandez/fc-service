/**
 * Queue Worker
 * Processes pending messages from queue_messages table.
 * Run independently: node worker.js
 */
require('dotenv').config();

// Polyfill robusto para Node 18 para la dependencia de baileys (crypto + 0-length HKDF fix)
if (!globalThis.crypto) {
  const nodeCrypto = require('crypto');
  const webcrypto = nodeCrypto.webcrypto;
  if (webcrypto && webcrypto.subtle) {
    const originalImportKey = webcrypto.subtle.importKey.bind(webcrypto.subtle);
    const originalDeriveBits = webcrypto.subtle.deriveBits.bind(webcrypto.subtle);

    webcrypto.subtle.importKey = async function(format, keyData, algo, extractable, usages) {
      if ((algo === 'HKDF' || algo.name === 'HKDF') && keyData.byteLength === 0) {
        return { _isZeroLengthHKDF: true, algo };
      }
      return originalImportKey(format, keyData, algo, extractable, usages);
    };

    webcrypto.subtle.deriveBits = async function(algo, baseKey, length) {
      if (baseKey && baseKey._isZeroLengthHKDF) {
        const hashStr = (algo.hash.name || algo.hash || 'SHA-256').replace('-', '').toLowerCase();
        const salt = algo.salt || new Uint8Array(0);
        const info = algo.info || new Uint8Array(0);
        
        // Custom HKDF implementation (RFC 5869) to support 0-length IKM in Node 18
        const prk = nodeCrypto.createHmac(hashStr, salt).update(new Uint8Array(0)).digest();
        let t = Buffer.alloc(0);
        let okm = Buffer.alloc(0);
        let i = 1;
        const lenBytes = length / 8;
        while (okm.length < lenBytes) {
          t = nodeCrypto.createHmac(hashStr, prk).update(Buffer.concat([t, info, Buffer.from([i])])).digest();
          okm = Buffer.concat([okm, t]);
          i++;
        }
        return okm.slice(0, lenBytes);
      }
      return originalDeriveBits(algo, baseKey, length);
    };
  }
  globalThis.crypto = webcrypto;
}

const db = require('./database/db');
const { connectWhatsApp, getClient } = require('./whatsapp/client');
const { sendMessage, saveOutgoingMessage, normalizeJid } = require('./whatsapp/sender');
const { triggerWebhooks } = require('./whatsapp/webhooks');

const INTERVAL = parseInt(process.env.WORKER_INTERVAL) || 5000;
const MAX_ATTEMPTS = parseInt(process.env.QUEUE_MAX_ATTEMPTS) || 3;
const BATCH_SIZE = 5;

let isRunning = false;
let workerReady = false;

console.log('🔧 Worker starting...');

// Ensure WhatsApp session is available
async function initSession() {
  try {
    const [rows] = await db.execute(
      `SELECT status FROM sessions WHERE session_id='default'`
    );
    const status = rows[0]?.status;

    if (status === 'connected') {
      console.log('✅ Session already connected');
      workerReady = true;
      return;
    }

    console.log('🔄 Starting WhatsApp session for worker...');
    await connectWhatsApp('default');

    // Wait for connection
    let attempts = 0;
    const checkInterval = setInterval(async () => {
      attempts++;
      const sock = getClient('default');
      if (sock?.user) {
        clearInterval(checkInterval);
        workerReady = true;
        console.log('✅ Worker WhatsApp session ready');
      }
      if (attempts > 60) {
        clearInterval(checkInterval);
        console.error('❌ Session did not connect in time. Worker will retry on next cycle.');
        workerReady = true; // Let it run anyway, will fail per message
      }
    }, 2000);
  } catch (err) {
    console.error('initSession error:', err.message);
    workerReady = true;
  }
}

async function processBatch() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Pick pending messages (avoid duplicates with FOR UPDATE SKIP LOCKED equivalent)
    const [messages] = await db.execute(
      `SELECT * FROM queue_messages
       WHERE status='pending'
         AND attempts < ?
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY created_at ASC
       LIMIT ?`,
      [MAX_ATTEMPTS, BATCH_SIZE]
    );

    if (!messages.length) {
      isRunning = false;
      return;
    }

    console.log(`📨 Processing ${messages.length} message(s)...`);

    for (const msg of messages) {
      await processMessage(msg);
    }
  } catch (err) {
    console.error('processBatch error:', err.message);
  } finally {
    isRunning = false;
  }
}

async function processMessage(msg) {
  // Mark as processing
  await db.execute(
    `UPDATE queue_messages SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE id=?`,
    [msg.id]
  );

  try {
    const sock = getClient(msg.session_id || 'default');
    if (!sock?.user) {
      throw new Error('WhatsApp session not connected');
    }

    await sendMessage(msg.session_id || 'default', msg.to_number, msg.type, {
      text: msg.message,
      fileUrl: msg.file_url,
      fileB64: msg.file_b64,
      fileName: msg.file_name,
    });

    const jid = normalizeJid(msg.to_number);
    await saveOutgoingMessage(
      msg.session_id || 'default',
      jid,
      msg.type,
      msg.message || msg.file_name || '',
      null
    );

    // Mark as sent to keep a history log
    await db.execute(
      `UPDATE queue_messages SET status='sent', processed_at=NOW(), updated_at=NOW() WHERE id=?`,
      [msg.id]
    );

    // Log
    await db.execute(
      `INSERT INTO logs (user_id, session_id, type, action, description)
       VALUES (?,?,'system','queue_sent',?)`,
      [msg.user_id, msg.session_id || 'default', `Sent ${msg.type} to ${msg.to_number}`]
    );

    triggerWebhooks(msg.session_id || 'default', 'message.sent', {
      queueId: msg.id,
      to: msg.to_number,
      type: msg.type,
    });

    console.log(`✅ [${msg.id}] Sent ${msg.type} to ${msg.to_number}`);
  } catch (err) {
    console.error(`❌ [${msg.id}] Failed: ${err.message}`);

    const newAttempts = (msg.attempts || 0) + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? 'error' : 'pending';

    await db.execute(
      `UPDATE queue_messages
       SET status=?, error_message=?, updated_at=NOW()
       WHERE id=?`,
      [newStatus, err.message.substring(0, 500), msg.id]
    );

    if (newStatus === 'error') {
      await db.execute(
        `INSERT INTO logs (user_id, session_id, type, action, description)
         VALUES (?,?,'error','queue_failed',?)`,
        [msg.user_id, msg.session_id || 'default', `Failed ${msg.type} to ${msg.to_number}: ${err.message}`]
      );

      triggerWebhooks(msg.session_id || 'default', 'message.error', {
        queueId: msg.id,
        to: msg.to_number,
        error: err.message,
      });
      
      // Do NOT delete, keep it for the UI history log
      // await db.execute(`DELETE FROM queue_messages WHERE id=?`, [msg.id]);
    }
  }
}

// ── Start ────────────────────────────────────────────────────
function startWorker() {
  console.log(`⏱️  Worker running every ${INTERVAL}ms`);
  setInterval(processBatch, INTERVAL);

  // Run once immediately
  setTimeout(processBatch, 2000);
}

// Export the function instead of running it automatically
module.exports = { startWorker, processBatch };
