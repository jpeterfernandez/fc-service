const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const [rows] = await db.execute(
      `SELECT * FROM users WHERE email=? AND status='active'`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Log activity
    await db.execute(
      `INSERT INTO logs (user_id, type, action, description, ip_address)
       VALUES (?, 'auth', 'login', 'User logged in', ?)`,
      [user.id, req.ip]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        apiToken: user.api_token,
        maxMessagesPerDay: user.max_messages_per_day,
      },
    });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function getProfile(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, email, role, status, api_token, max_messages_per_day, created_at FROM users WHERE id=?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { login, getProfile };
