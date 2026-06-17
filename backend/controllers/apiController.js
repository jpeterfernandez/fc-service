const db = require('../database/db');
const { sendMessage, saveOutgoingMessage, normalizeJid } = require('../whatsapp/sender');
const { getClient } = require('../whatsapp/client');
const { triggerWebhooks } = require('../whatsapp/webhooks');

const VALID_TYPES = new Set(['text', 'image', 'video', 'audio', 'pdf', 'document', 'sticker']);

/**
 * Shared session check — returns 503 if WhatsApp is not connected
 */
async function checkSession(res) {
  const [rows] = await db.execute(
    `SELECT status FROM sessions WHERE session_id='default'`
  );
  const status = rows[0]?.status;
  if (status !== 'connected') {
    res.status(503).json({
      success: false,
      error: 'session_not_connected',
      message: `La sesión de WhatsApp no está activa (estado: ${status || 'desconectado'}). Conéctala desde el panel antes de usar la API.`,
    });
    return false;
  }
  const sock = getClient('default');
  if (!sock?.user) {
    res.status(503).json({
      success: false,
      error: 'session_not_ready',
      message: 'La sesión está registrada como conectada pero el socket no está listo. Espera unos segundos o reconecta.',
    });
    return false;
  }
  return true;
}

/**
 * POST /api/send  – send immediately
 * POST /api/queue – enqueue for worker
 */
async function apiSend(req, res) {
  try {
    const { numero, tipo = 'text', mensaje, archivo_url, archivo_b64, nombre_archivo } = req.body;

    // ── Validaciones ──────────────────────────────────────────
    if (!numero) {
      return res.status(400).json({ success: false, error: 'missing_field', message: 'El campo "numero" es requerido. Ej: 51912345678' });
    }
    if (!/^\d{7,15}$/.test(String(numero))) {
      return res.status(400).json({ success: false, error: 'invalid_numero', message: 'El "numero" debe contener solo dígitos con código de país, sin +. Ej: 51912345678' });
    }
    if (!VALID_TYPES.has(tipo)) {
      return res.status(400).json({ success: false, error: 'invalid_tipo', message: `Tipo inválido: "${tipo}". Valores válidos: ${[...VALID_TYPES].join(', ')}` });
    }
    if (tipo === 'text' && !mensaje?.trim()) {
      return res.status(400).json({ success: false, error: 'missing_field', message: 'El campo "mensaje" es requerido cuando tipo=text.' });
    }
    if (tipo !== 'text' && !archivo_url && !archivo_b64) {
      return res.status(400).json({ success: false, error: 'missing_field', message: `Para tipo="${tipo}" debes enviar "archivo_url" o "archivo_b64".` });
    }
    // ── Verificar límite diario ───────────────────────────────
    const sentCount = db.getSentCountInLast24Hours(req.user.id);
    if (req.user.max_messages_per_day > 0 && sentCount >= req.user.max_messages_per_day) {
      return res.status(429).json({
        success: false,
        error: 'limit_exceeded',
        message: `Has superado tu límite diario de mensajes (${req.user.max_messages_per_day} mensajes/día).`
      });
    }

    // ── Verificar sesión activa ───────────────────────────────
    if (!(await checkSession(res))) return;

    // ── Firma ────────────────────────────────────────────────
    let finalMessage = mensaje || '';
    if (req.user.signature_enabled === 1 && req.user.signature_text) {
      finalMessage += `\n\n${req.user.signature_text}`;
    }

    // ── Enviar ───────────────────────────────────────────────
    const sentMsg = await sendMessage('default', numero, tipo, {
      text: finalMessage,
      caption: finalMessage,
      fileUrl: archivo_url,
      fileB64: archivo_b64,
      fileName: nombre_archivo,
    });

    const jid = normalizeJid(numero);
    await saveOutgoingMessage('default', jid, tipo, finalMessage || nombre_archivo || '', sentMsg);

    // Registrar en historial de cola (sin base64)
    await db.execute(
      `INSERT INTO queue_messages
       (user_id, session_id, to_number, type, message, file_url, file_name, status, attempts, scheduled_at)
       VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
      [
        req.user.id, 'default', numero, tipo,
        finalMessage || null,
        archivo_url || (archivo_b64 ? '[base64]' : null),
        nombre_archivo || null,
        'sent', 1,
      ]
    );

    await db.execute(
      `INSERT INTO logs (user_id, session_id, type, action, description, meta) VALUES (?,?,?,?,?,?)`,
      [req.user.id, 'default', 'api', 'send_message', `Sent ${tipo} to ${numero}`, JSON.stringify({ numero, tipo })]
    );

    triggerWebhooks('default', 'message.sent', { numero, tipo, messageId: sentMsg?.key?.id });

    res.json({ success: true, message: 'Mensaje enviado correctamente.', messageId: sentMsg?.key?.id });

  } catch (err) {
    console.error('apiSend error:', err.message);
    try {
      await db.execute(
        `INSERT INTO logs (user_id, session_id, type, action, description, meta) VALUES (?,?,?,?,?,?)`,
        [req.user?.id || null, 'default', 'error', 'api_send_error', err.message, JSON.stringify({ body: req.body })]
      );
    } catch {}

    // Translate common WhatsApp errors to readable messages
    const msg = err.message || '';
    if (msg.includes('not connected') || msg.includes('session')) {
      return res.status(503).json({ success: false, error: 'session_error', message: 'La sesión de WhatsApp no está disponible. ' + msg });
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return res.status(504).json({ success: false, error: 'timeout', message: 'El envío tardó demasiado. Verifica la conexión de WhatsApp.' });
    }
    res.status(500).json({ success: false, error: 'send_failed', message: 'Error al enviar: ' + msg });
  }
}

async function apiQueue(req, res) {
  try {
    const { numero, tipo = 'text', mensaje, archivo_url, archivo_b64, nombre_archivo, programado } = req.body;

    // ── Validaciones ──────────────────────────────────────────
    if (!numero) {
      return res.status(400).json({ success: false, error: 'missing_field', message: 'El campo "numero" es requerido. Ej: 51912345678' });
    }
    if (!/^\d{7,15}$/.test(String(numero))) {
      return res.status(400).json({ success: false, error: 'invalid_numero', message: 'El "numero" debe contener solo dígitos con código de país, sin +. Ej: 51912345678' });
    }
    if (!VALID_TYPES.has(tipo)) {
      return res.status(400).json({ success: false, error: 'invalid_tipo', message: `Tipo inválido: "${tipo}". Valores válidos: ${[...VALID_TYPES].join(', ')}` });
    }
    if (tipo === 'text' && !mensaje?.trim()) {
      return res.status(400).json({ success: false, error: 'missing_field', message: 'El campo "mensaje" es requerido cuando tipo=text.' });
    }
    if (tipo !== 'text' && !archivo_url && !archivo_b64) {
      return res.status(400).json({ success: false, error: 'missing_field', message: `Para tipo="${tipo}" debes enviar "archivo_url" o "archivo_b64".` });
    }
    if (programado && isNaN(Date.parse(programado))) {
      return res.status(400).json({ success: false, error: 'invalid_programado', message: '"programado" debe ser una fecha ISO 8601 válida. Ej: 2025-12-31T23:59:00Z' });
    }

    // ── Verificar límite diario ───────────────────────────────
    const sentCount = db.getSentCountInLast24Hours(req.user.id);
    if (req.user.max_messages_per_day > 0 && sentCount >= req.user.max_messages_per_day) {
      return res.status(429).json({
        success: false,
        error: 'limit_exceeded',
        message: `Has superado tu límite diario de mensajes (${req.user.max_messages_per_day} mensajes/día).`
      });
    }

    let finalMessage = mensaje || '';
    if (req.user.signature_enabled === 1 && req.user.signature_text) {
      finalMessage += `\n\n${req.user.signature_text}`;
    }

    const [result] = await db.execute(
      `INSERT INTO queue_messages
       (user_id, session_id, to_number, type, message, file_url, file_b64, file_name, status, scheduled_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, 'default', numero, tipo, finalMessage || null,
        archivo_url || null, archivo_b64 || null, nombre_archivo || null,
        'pending', programado ? new Date(programado) : null,
      ]
    );

    await db.execute(
      `INSERT INTO logs (user_id, session_id, type, action, description, meta) VALUES (?,?,?,?,?,?)`,
      [req.user.id, 'default', 'api', 'enqueue_message', `Enqueued ${tipo} to ${numero}`, JSON.stringify({ numero, tipo })]
    );

    res.status(201).json({ success: true, message: 'Mensaje encolado correctamente.', queueId: result.insertId });

  } catch (err) {
    console.error('apiQueue error:', err.message);
    try {
      await db.execute(
        `INSERT INTO logs (user_id, session_id, type, action, description, meta) VALUES (?,?,?,?,?,?)`,
        [req.user?.id || null, 'default', 'error', 'api_queue_error', err.message, JSON.stringify({ body: req.body })]
      );
    } catch {}
    res.status(500).json({ success: false, error: 'queue_failed', message: 'Error al encolar: ' + err.message });
  }
}

async function apiGetChats(req, res) {
  try {
    const { search, limit = 50 } = req.query;
    let query = `SELECT jid, name, is_group, unread_count, last_message, last_message_time
                 FROM chats WHERE session_id='default'`;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR jid LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY last_message_time DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ success: true, chats: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function apiGetMessages(req, res) {
  try {
    const { numero, limit = 50 } = req.query;
    if (!numero) return res.status(400).json({ success: false, message: 'numero required' });

    const jid = normalizeJid(numero);
    const [rows] = await db.execute(
      `SELECT message_id, jid, from_me, type, body, status, timestamp, created_at
       FROM messages WHERE session_id='default' AND jid=?
       ORDER BY timestamp DESC LIMIT ?`,
      [jid, parseInt(limit)]
    );

    res.json({ success: true, messages: rows.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function apiGetSessionStatus(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT session_id, status, phone_number, account_name, connected_at FROM sessions WHERE session_id='default'`
    );
    res.json({ success: true, session: rows[0] || { status: 'disconnected' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { apiSend, apiQueue, apiGetChats, apiGetMessages, apiGetSessionStatus };
