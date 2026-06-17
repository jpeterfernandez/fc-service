const db = require('../database/db');
// Bug Fix #7: require at module level, not inside the function
const { sendMessage: waSend, saveOutgoingMessage, normalizeJid } = require('../whatsapp/sender');

async function getChats(req, res) {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `SELECT ch.*, c.avatar_url, c.push_name 
                 FROM chats ch
                 LEFT JOIN contacts c ON ch.jid = c.jid AND ch.session_id = c.session_id
                 WHERE ch.session_id='default'`;
    const params = [];

    if (search) {
      query += ` AND (ch.name LIKE ? OR ch.jid LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY last_message_time DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.execute(query, params);

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM chats ch WHERE ch.session_id='default'${
        search ? ' AND (ch.name LIKE ? OR ch.jid LIKE ?)' : ''
      }`,
      search ? [`%${search}%`, `%${search}%`] : []
    );

    res.json({ success: true, chats: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getMessages(req, res) {
  try {
    const { jid } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.execute(
      `SELECT * FROM messages WHERE session_id='default' AND jid=?
       ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [jid, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM messages WHERE session_id='default' AND jid=?`,
      [jid]
    );

    await db.execute(
      `UPDATE chats SET unread_count=0 WHERE session_id='default' AND jid=?`,
      [jid]
    );

    res.json({ success: true, messages: rows.reverse(), total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function sendMessage(req, res) {
  try {
    const { jid } = req.params;
    const { type = 'text', text, fileUrl, fileB64, caption, fileName, quotedMessageId, ptt } = req.body;

    // ── Verificar límite diario ───────────────────────────────
    const sentCount = db.getSentCountInLast24Hours(req.user.id);
    if (req.user.max_messages_per_day > 0 && sentCount >= req.user.max_messages_per_day) {
      return res.status(429).json({
        success: false,
        error: 'limit_exceeded',
        message: `Has superado tu límite diario de mensajes (${req.user.max_messages_per_day} mensajes/día).`
      });
    }

    const sentMsg = await waSend('default', jid, type, {
      text,
      fileUrl,
      fileB64,
      caption,
      fileName,
      quotedMessageId,
      ptt
    });

    const bodyText = text || caption || fileName || '';
    const cleanJid = normalizeJid(jid);
    await saveOutgoingMessage('default', cleanJid, type, bodyText, sentMsg, { quotedMessageId });

    await db.execute(
      `INSERT INTO logs (user_id, session_id, type, action, description, meta) VALUES (?,?,?,?,?,?)`,
      [req.user.id, 'default', 'chat', 'send_message', `Sent chat message to ${jid}`, JSON.stringify({ jid, type })]
    );

    // Emit to socket so other browser tabs update instantly
    res.json({ success: true, message: 'Message sent', messageId: sentMsg?.key?.id });
  } catch (err) {
    console.error('sendMessage controller error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function sendPresence(req, res) {
  try {
    const { jid } = req.params;
    const { state } = req.body; // 'composing' or 'paused'
    
    // We can just use the getClient from client.js
    const { getClient } = require('../whatsapp/client');
    const sock = getClient('default');
    
    if (sock) {
      await sock.sendPresenceUpdate(state, jid);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('sendPresence error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getChats, getMessages, sendMessage, sendPresence };
