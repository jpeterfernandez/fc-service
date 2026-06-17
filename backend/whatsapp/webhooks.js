const axios = require('axios');
const crypto = require('crypto');
const db = require('../database/db');

async function triggerWebhooks(sessionId, event, payload) {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM webhooks WHERE session_id=? AND is_active=1`,
      [sessionId]
    );

    for (const webhook of rows) {
      let events = [];
      try {
        events = typeof webhook.events === 'string'
          ? JSON.parse(webhook.events)
          : webhook.events || [];
      } catch {}

      // If no events filter, send all
      if (events.length > 0 && !events.includes(event)) continue;

      const body = { event, sessionId, timestamp: new Date().toISOString(), data: payload };
      const headers = { 'Content-Type': 'application/json' };

      if (webhook.secret) {
        const sig = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(body))
          .digest('hex');
        headers['X-Webhook-Signature'] = sig;
      }

      axios
        .post(webhook.url, body, { headers, timeout: 10000 })
        .then(() => {
          db.execute(
            `UPDATE webhooks SET last_triggered_at=NOW() WHERE id=?`,
            [webhook.id]
          ).catch(() => {});
        })
        .catch((err) => {
          console.error(`Webhook [${webhook.id}] failed: ${err.message}`);
        });
    }
  } catch (err) {
    console.error('triggerWebhooks error:', err.message);
  }
}

module.exports = { triggerWebhooks };
