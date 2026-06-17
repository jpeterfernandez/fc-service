const db = require('../database/db');

async function getStats(req, res) {
  try {
    const [[msgSent]] = await db.execute(
      `SELECT COUNT(*) as count FROM messages WHERE from_me=1 AND session_id='default'`
    );
    const [[msgReceived]] = await db.execute(
      `SELECT COUNT(*) as count FROM messages WHERE from_me=0 AND session_id='default'`
    );
    const [[queuePending]] = await db.execute(
      `SELECT COUNT(*) as count FROM queue_messages WHERE status='pending'`
    );
    const [[queueError]] = await db.execute(
      `SELECT COUNT(*) as count FROM queue_messages WHERE status='error'`
    );
    const [[usersCount]] = await db.execute(
      `SELECT COUNT(*) as count FROM users WHERE status='active'`
    );
    const [[totalChats]] = await db.execute(
      `SELECT COUNT(*) as count FROM chats WHERE session_id='default'`
    );
    const [session] = await db.execute(
      `SELECT status, phone_number, account_name, connected_at FROM sessions WHERE session_id='default'`
    );
    const [recentActivity] = await db.execute(
      `SELECT l.*, u.name as user_name FROM logs l
       LEFT JOIN users u ON l.user_id=u.id
       ORDER BY l.created_at DESC LIMIT 20`
    );
    const [queueStats] = await db.execute(
      `SELECT status, COUNT(*) as count FROM queue_messages GROUP BY status`
    );

    const queueByStatus = { pending: 0, processing: 0, sent: 0, error: 0, cancelled: 0 };
    queueStats.forEach(r => { queueByStatus[r.status] = parseInt(r.count); });

    res.json({
      success: true,
      stats: {
        messages: {
          sent: parseInt(msgSent.count),
          received: parseInt(msgReceived.count),
        },
        queue: {
          pending: parseInt(queuePending.count),
          error: parseInt(queueError.count),
          byStatus: queueByStatus,
        },
        users: parseInt(usersCount.count),
        chats: parseInt(totalChats.count),
        session: session[0] || { status: 'disconnected' },
      },
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getStats };
