const jwt = require('jsonwebtoken');
const db = require('../database/db');
require('dotenv').config();

function isBrowserPageRequest(req) {
  const accept = req.headers.accept || '';
  return (
    req.method === 'GET' &&
    accept.includes('text/html') &&
    !req.xhr &&
    !req.headers.authorization
  );
}

/**
 * JWT auth middleware for panel routes
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      if (isBrowserPageRequest(req)) {
        return next('router');
      }
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    const [rows] = await db.execute(
      `SELECT id, name, email, role, status, signature_enabled, signature_text, max_messages_per_day FROM users WHERE id=? AND status='active'`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Admin-only middleware
 */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

/**
 * API token middleware for external API calls
 */
async function apiTokenMiddleware(req, res, next) {
  try {
    const token =
      req.body?.token ||
      req.query?.token ||
      req.headers['x-api-token'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({ success: false, message: 'API token required' });
    }
    
    if (typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid token format' });
    }

    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.signature_enabled, u.signature_text, u.max_messages_per_day
       FROM users u
       WHERE u.api_token=? AND u.status='active'`,
      [token]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive token' });
    }

    // Update token usage stats
    await db.execute(
      `UPDATE users SET updated_at=NOW() WHERE id=?`,
      [rows[0].id]
    );

    await db.execute(
      `UPDATE api_tokens SET last_used_at=NOW(), requests_count=requests_count+1
       WHERE user_id=? AND token=?`,
      [rows[0].id, token]
    );

    req.user = rows[0];
    req.apiToken = token;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Token validation error: ' + err.message });
  }
}

module.exports = { authMiddleware, adminOnly, apiTokenMiddleware };
