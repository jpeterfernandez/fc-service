const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

async function listUsers(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, email, role, status, api_token, signature_enabled, signature_text, max_messages_per_day, created_at, updated_at FROM users ORDER BY created_at DESC`
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role = 'user', max_messages_per_day = 0 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const [exists] = await db.execute(`SELECT id FROM users WHERE email=?`, [email.toLowerCase()]);
    if (exists.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');

    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, role, status, api_token, max_messages_per_day) VALUES (?,?,?,?,?,?,?)`,
      [name, email.toLowerCase(), hash, role, 'active', token.substring(0, 64), max_messages_per_day]
    );

    await db.execute(
      `INSERT INTO api_tokens (user_id, token) VALUES (?,?)`,
      [result.insertId, token.substring(0, 64)]
    );

    await db.execute(
      `INSERT INTO logs (user_id, type, action, description) VALUES (?,?,?,?)`,
      [req.user.id, 'system', 'create_user', `Created user: ${email}`]
    );

    res.status(201).json({ success: true, message: 'User created', userId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, role, status, signature_enabled, signature_text, max_messages_per_day } = req.body;

    const [rows] = await db.execute(`SELECT * FROM users WHERE id=?`, [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const fields = [];
    const values = [];

    if (name) { fields.push('name=?'); values.push(name); }
    if (email) { fields.push('email=?'); values.push(email.toLowerCase()); }
    if (password) { fields.push('password=?'); values.push(await bcrypt.hash(password, 10)); }
    if (role) { fields.push('role=?'); values.push(role); }
    if (status) { fields.push('status=?'); values.push(status); }
    if (signature_enabled !== undefined) { fields.push('signature_enabled=?'); values.push(signature_enabled); }
    if (signature_text !== undefined) { fields.push('signature_text=?'); values.push(signature_text); }
    if (max_messages_per_day !== undefined) { fields.push('max_messages_per_day=?'); values.push(max_messages_per_day); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    await db.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);

    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    await db.execute(`DELETE FROM users WHERE id=?`, [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function regenerateToken(req, res) {
  try {
    const { id } = req.params;
    const newToken = (uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '')).substring(0, 64);

    await db.execute(`UPDATE users SET api_token=? WHERE id=?`, [newToken, id]);
    await db.execute(
      `INSERT INTO api_tokens (user_id, token) VALUES (?,?)`,
      [id, newToken]
    );

    res.json({ success: true, message: 'Token regenerated', token: newToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getUserActivity(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT * FROM logs WHERE user_id=? ORDER BY created_at DESC LIMIT 100`,
      [id]
    );
    res.json({ success: true, logs: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser, regenerateToken, getUserActivity };
