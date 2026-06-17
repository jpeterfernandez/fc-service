const db = require('../database/db');

async function listAutomations(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM automations WHERE session_id='default' ORDER BY created_at DESC`
    );
    res.json({ success: true, automations: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createAutomation(req, res) {
  try {
    const name = req.body.name?.trim();
    const trigger_keyword = req.body.trigger_keyword?.trim();
    const match_type = req.body.match_type || 'contains';
    const response_message = req.body.response_message?.trim();
    const allowedMatchTypes = ['contains', 'exact', 'starts_with'];

    if (!name || !trigger_keyword || !response_message) {
      return res.status(400).json({ success: false, message: 'name, trigger_keyword and response_message required' });
    }
    if (!allowedMatchTypes.includes(match_type)) {
      return res.status(400).json({ success: false, message: 'Invalid match_type' });
    }

    const [result] = await db.execute(
      `INSERT INTO automations (session_id, name, trigger_keyword, match_type, response_message)
       VALUES ('default',?,?,?,?)`,
      [name, trigger_keyword, match_type, response_message]
    );

    res.status(201).json({ success: true, message: 'Automation created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateAutomation(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const name = req.body.name?.trim();
    const trigger_keyword = req.body.trigger_keyword?.trim();
    const match_type = req.body.match_type;
    const response_message = req.body.response_message?.trim();
    const allowedMatchTypes = ['contains', 'exact', 'starts_with'];

    const fields = [];
    const values = [];

    if (match_type !== undefined && !allowedMatchTypes.includes(match_type)) {
      return res.status(400).json({ success: false, message: 'Invalid match_type' });
    }
    if (req.body.name !== undefined && !name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (req.body.trigger_keyword !== undefined && !trigger_keyword) {
      return res.status(400).json({ success: false, message: 'trigger_keyword is required' });
    }
    if (req.body.response_message !== undefined && !response_message) {
      return res.status(400).json({ success: false, message: 'response_message is required' });
    }
    if (name !== undefined) { fields.push('name=?'); values.push(name); }
    if (trigger_keyword !== undefined) { fields.push('trigger_keyword=?'); values.push(trigger_keyword); }
    if (match_type !== undefined) { fields.push('match_type=?'); values.push(match_type); }
    if (response_message !== undefined) { fields.push('response_message=?'); values.push(response_message); }
    if (is_active !== undefined) { fields.push('is_active=?'); values.push(is_active ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    values.push(id);
    const [result] = await db.execute(`UPDATE automations SET ${fields.join(',')} WHERE id=?`, values);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Automation not found' });
    }

    res.json({ success: true, message: 'Automation updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteAutomation(req, res) {
  try {
    const { id } = req.params;
    const [result] = await db.execute(`DELETE FROM automations WHERE id=?`, [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Automation not found' });
    }
    res.json({ success: true, message: 'Automation deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listAutomations, createAutomation, updateAutomation, deleteAutomation };
