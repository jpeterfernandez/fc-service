const db = require('../database/db');

async function processAutomation(sessionId, sock, msg) {
  try {
    if (msg.key.fromMe) return;

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    if (!body) return;

    const [rules] = await db.execute(
      `SELECT * FROM automations WHERE session_id=? AND is_active=1`,
      [sessionId]
    );

    for (const rule of rules) {
      let matched = false;
      const keyword = rule.trigger_keyword.toLowerCase();
      const text = body.toLowerCase();

      switch (rule.match_type) {
        case 'exact':
          matched = text === keyword;
          break;
        case 'starts_with':
          matched = text.startsWith(keyword);
          break;
        case 'contains':
        default:
          matched = text.includes(keyword);
          break;
      }

      if (matched) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: rule.response_message,
        });
        console.log(`🤖 Automation triggered: "${rule.name}" for ${msg.key.remoteJid}`);
        break; // First match wins
      }
    }
  } catch (err) {
    console.error('processAutomation error:', err.message);
  }
}

module.exports = { processAutomation };
