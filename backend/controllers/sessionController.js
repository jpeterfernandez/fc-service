const {
  connectWhatsApp,
  disconnectSession,
  deleteSession,
  getClient,
  _clearClient,
} = require('../whatsapp/client');
const db = require('../database/db');

async function getStatus(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT session_id, phone_number, account_name, status, qr_code, connected_at, updated_at
       FROM sessions WHERE session_id='default'`
    );
    const session = rows[0] || { status: 'disconnected' };

    // socketState helps diagnose "shows connected but API says not connected"
    const sock = getClient('default');
    const socketState = sock?.user ? 'connected' : (sock ? 'connecting' : 'no_socket');

    res.json({ success: true, session, socketState });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function connect(req, res) {
  try {
    const sock = getClient('default');

    // Already fully connected
    if (sock?.user) {
      return res.json({ success: true, message: 'Already connected' });
    }

    // Socket exists but stuck connecting — kill it and start fresh
    // This avoids the infinite "connecting" state
    if (sock) {
      console.log('⚠️  Stale connecting socket detected — restarting...');
      try { sock.end(new Error('restarting')); } catch {}
      _clearClient('default');
    }

    // Reset DB status
    await db.execute(
      `INSERT INTO sessions (session_id, status, qr_code)
       VALUES ('default','connecting', NULL)
       ON DUPLICATE KEY UPDATE status='connecting', qr_code=NULL, updated_at=NOW()`
    );

    // Start Baileys
    connectWhatsApp('default').catch(err => {
      console.error('connectWhatsApp error:', err.message);
    });

    res.json({ success: true, message: 'Connecting...' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function forceReconnect(req, res) {
  try {
    console.log('🔄 Force reconnect');

    const sock = getClient('default');
    if (sock) {
      try { sock.end(new Error('force reconnect')); } catch {}
      _clearClient('default');
    }

    await db.execute(
      `UPDATE sessions SET status='connecting', qr_code=NULL, updated_at=NOW()
       WHERE session_id='default'`
    );

    connectWhatsApp('default').catch(err => {
      console.error('forceReconnect error:', err.message);
    });

    res.json({ success: true, message: 'Reconnecting...' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function disconnect(req, res) {
  try {
    await disconnectSession('default');
    res.json({ success: true, message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteSessionHandler(req, res) {
  try {
    await deleteSession('default');
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStatus,
  connect,
  forceReconnect,
  disconnect,
  deleteSession: deleteSessionHandler,
};
