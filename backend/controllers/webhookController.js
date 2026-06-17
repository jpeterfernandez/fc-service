const db = require('../database/db');

async function listWebhooks(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT id, session_id, url, events, is_active, last_triggered_at, created_at
       FROM webhooks WHERE session_id='default' ORDER BY created_at DESC`
    );
    res.json({ success: true, webhooks: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createWebhook(req, res) {
  try {
    const { url, events = [], secret } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'URL required' });

    const [result] = await db.execute(
      `INSERT INTO webhooks (session_id, url, events, secret) VALUES ('default',?,?,?)`,
      [url, JSON.stringify(events), secret || null]
    );

    res.status(201).json({ success: true, message: 'Webhook created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateWebhook(req, res) {
  try {
    const { id } = req.params;
    const { url, events, secret, is_active } = req.body;

    const fields = [];
    const values = [];

    if (url !== undefined) { fields.push('url=?'); values.push(url); }
    if (events !== undefined) { fields.push('events=?'); values.push(JSON.stringify(events)); }
    if (secret !== undefined) { fields.push('secret=?'); values.push(secret); }
    if (is_active !== undefined) { fields.push('is_active=?'); values.push(is_active ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    values.push(id);
    await db.execute(`UPDATE webhooks SET ${fields.join(',')} WHERE id=?`, values);

    res.json({ success: true, message: 'Webhook updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteWebhook(req, res) {
  try {
    const { id } = req.params;
    await db.execute(`DELETE FROM webhooks WHERE id=?`, [id]);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listWebhooks, createWebhook, updateWebhook, deleteWebhook };
