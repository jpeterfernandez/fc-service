const db = require('../database/db');

async function listQueue(req, res) {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `SELECT q.*, u.name as user_name FROM queue_messages q
                 LEFT JOIN users u ON q.user_id=u.id WHERE 1=1`;
    const params = [];

    if (status) { query += ` AND q.status=?`; params.push(status); }

    query += ` ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.execute(query, params);

    res.json({ success: true, queue: rows, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function cancelMessage(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT * FROM queue_messages WHERE id=? AND status='pending'`, [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Message not found or not cancellable' });
    }
    await db.execute(
      `UPDATE queue_messages SET status='cancelled' WHERE id=?`, [id]
    );
    res.json({ success: true, message: 'Message cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getQueueStats(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT status, COUNT(*) as count FROM queue_messages GROUP BY status`
    );
    // Solo pending, processing y error quedan en la tabla (sent se elimina al enviarse)
    const stats = { pending: 0, processing: 0, sent: 0, error: 0, cancelled: 0 };
    rows.forEach(r => { stats[r.status] = r.count; });
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function clearSentMessages(req, res) {
  try {
    await db.execute(`DELETE FROM queue_messages WHERE status IN ('sent','cancelled')`);
    res.json({ success: true, message: 'Mensajes enviados/cancelados eliminados' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listQueue, cancelMessage, getQueueStats, clearSentMessages };
