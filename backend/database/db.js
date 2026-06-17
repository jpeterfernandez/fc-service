'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`📦 Base de datos JSON iniciada correctamente en: ${DATA_DIR}`);

function getFilePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function readTable(table) {
  const filePath = getFilePath(table);
  if (!fs.existsSync(filePath)) {
    // Seed default rows
    if (table === 'users') {
      const defaultUsers = [
        {
          id: 1,
          name: 'Administrador',
          email: 'admin@admin.com',
          password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
          role: 'admin',
          status: 'active',
          api_token: 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8',
          signature_enabled: 0,
          signature_text: '',
          max_messages_per_day: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      writeTable('users', defaultUsers);
      return defaultUsers;
    }
    if (table === 'sessions') {
      const defaultSessions = [
        {
          session_id: 'default',
          status: 'disconnected',
          phone_number: null,
          account_name: null,
          qr_code: null,
          connected_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      writeTable('sessions', defaultSessions);
      return defaultSessions;
    }
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading table ${table}:`, err.message);
    return [];
  }
}

function writeTable(table, data) {
  const filePath = getFilePath(table);
  const tempPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing table ${table}:`, err.message);
  }
}

const db = {
  execute: async (sql, params = []) => {
    const cleanSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    // ─── SELECT Statements ───
    if (cleanSql.startsWith('select')) {
      // 1. Session status checks
      if (cleanSql.includes('select status from sessions') && cleanSql.includes("session_id='default'")) {
        const sessions = readTable('sessions');
        const session = sessions.find(s => s.session_id === 'default') || { status: 'disconnected' };
        return [[ { status: session.status } ], []];
      }
      if (cleanSql.includes('from sessions where session_id=')) {
        const sessions = readTable('sessions');
        const session = sessions.find(s => s.session_id === 'default');
        return [session ? [session] : [], []];
      }

      // 2. Users checks
      if (cleanSql.includes('from users where email=? and status=\'active\'')) {
        const users = readTable('users');
        const email = params[0].toLowerCase().trim();
        const user = users.find(u => u.email === email && u.status === 'active');
        return [user ? [user] : [], []];
      }
      if (cleanSql.includes('from users where id=? and status=\'active\'')) {
        const users = readTable('users');
        const id = parseInt(params[0]);
        const user = users.find(u => u.id === id && u.status === 'active');
        return [user ? [user] : [], []];
      }
      if (cleanSql.includes('from users u where u.api_token=? and u.status=\'active\'')) {
        const users = readTable('users');
        const token = params[0];
        const user = users.find(u => u.api_token === token && u.status === 'active');
        return [user ? [user] : [], []];
      }
      if (cleanSql.includes('from users where email=?')) {
        const users = readTable('users');
        const email = params[0].toLowerCase().trim();
        const user = users.find(u => u.email === email);
        return [user ? [{ id: user.id }] : [], []];
      }
      if (cleanSql.includes('from users where id=?')) {
        const users = readTable('users');
        const id = parseInt(params[0]);
        const user = users.find(u => u.id === id);
        return [user ? [user] : [], []];
      }
      if (cleanSql.includes('from users order by created_at desc') || cleanSql.startsWith('select id, name, email, role, status, api_token, signature_enabled, signature_text, created_at, updated_at from users')) {
        const users = readTable('users');
        const sorted = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [sorted, []];
      }

      // 3. Automations
      if (cleanSql.includes('from automations where session_id=\'default\' order by created_at desc')) {
        const automations = readTable('automations');
        const sorted = [...automations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [sorted, []];
      }
      if (cleanSql.includes('from automations where session_id=? and is_active=1')) {
        const automations = readTable('automations');
        const sessionId = params[0];
        const active = automations.filter(a => a.session_id === sessionId && a.is_active === 1);
        return [active, []];
      }

      // 4. Webhooks
      if (cleanSql.includes('from webhooks where session_id=\'default\' order by created_at desc')) {
        const webhooks = readTable('webhooks');
        const sorted = [...webhooks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [sorted, []];
      }
      if (cleanSql.includes('from webhooks where session_id=? and is_active=1')) {
        const webhooks = readTable('webhooks');
        const sessionId = params[0];
        const active = webhooks.filter(w => w.session_id === sessionId && w.is_active === 1);
        return [active, []];
      }

      // 5. Queue Messages
      if (cleanSql.includes('from queue_messages q')) {
        const queue = readTable('queue_messages');
        const users = readTable('users');
        let filtered = queue.map(q => {
          const u = users.find(user => user.id === q.user_id);
          return { ...q, user_name: u ? u.name : 'Unknown' };
        });

        if (cleanSql.includes('and q.status=?')) {
          const status = params[0];
          filtered = filtered.filter(q => q.status === status);
          const limit = params[1];
          const offset = params[2] || 0;
          const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return [sorted.slice(offset, offset + limit), []];
        } else {
          const limit = params[0];
          const offset = params[1] || 0;
          const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return [sorted.slice(offset, offset + limit), []];
        }
      }
      if (cleanSql.includes('from queue_messages where id=? and status=\'pending\'')) {
        const queue = readTable('queue_messages');
        const id = parseInt(params[0]);
        const msg = queue.find(q => q.id === id && q.status === 'pending');
        return [msg ? [msg] : [], []];
      }
      if (cleanSql.includes('select status, count(*) as count from queue_messages group by status')) {
        const queue = readTable('queue_messages');
        const counts = { pending: 0, processing: 0, sent: 0, error: 0, cancelled: 0 };
        queue.forEach(q => {
          if (counts[q.status] !== undefined) counts[q.status]++;
        });
        const rows = Object.entries(counts).map(([status, count]) => ({ status, count }));
        return [rows, []];
      }
      if (cleanSql.includes('from queue_messages where status=\'pending\' and attempts < ?')) {
        const queue = readTable('queue_messages');
        const maxAttempts = params[0];
        const limit = params[1];
        const now = new Date();
        const filtered = queue.filter(q => 
          q.status === 'pending' && 
          q.attempts < maxAttempts && 
          (!q.scheduled_at || new Date(q.scheduled_at) <= now)
        );
        const sorted = filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return [sorted.slice(0, limit), []];
      }

      // 6. Chats Left Join Contacts
      if (cleanSql.includes('from chats ch left join contacts c')) {
        const chats = readTable('chats');
        const contacts = readTable('contacts');
        let list = chats.filter(ch => ch.session_id === 'default').map(ch => {
          const contact = contacts.find(c => c.jid === ch.jid && c.session_id === ch.session_id);
          return {
            ...ch,
            avatar_url: contact ? contact.avatar_url : null,
            push_name: contact ? contact.push_name : null
          };
        });

        let searchVal = null;
        let limit = 50;
        let offset = 0;

        if (cleanSql.includes('name like ?')) {
          searchVal = params[0].replace(/%/g, '').toLowerCase();
          list = list.filter(ch => 
            (ch.name && ch.name.toLowerCase().includes(searchVal)) || 
            ch.jid.toLowerCase().includes(searchVal)
          );
          limit = params[2];
          offset = params[3] || 0;
        } else {
          limit = params[0];
          offset = params[1] || 0;
        }

        const sorted = list.sort((a, b) => {
          if (!a.last_message_time) return 1;
          if (!b.last_message_time) return -1;
          return new Date(b.last_message_time) - new Date(a.last_message_time);
        });
        return [sorted.slice(offset, offset + limit), []];
      }
      if (cleanSql.includes('count(*) as total from chats ch where ch.session_id=\'default\'')) {
        const chats = readTable('chats');
        let list = chats.filter(ch => ch.session_id === 'default');
        if (cleanSql.includes('name like ?')) {
          const searchVal = params[0].replace(/%/g, '').toLowerCase();
          list = list.filter(ch => 
            (ch.name && ch.name.toLowerCase().includes(searchVal)) || 
            ch.jid.toLowerCase().includes(searchVal)
          );
        }
        return [[ { total: list.length } ], []];
      }

      // 7. Messages
      if (cleanSql.includes('from messages where session_id=\'default\' and jid=? order by timestamp desc')) {
        const messages = readTable('messages');
        const jid = params[0];
        const limit = params[1];
        const offset = params[2] || 0;
        const filtered = messages.filter(m => m.session_id === 'default' && m.jid === jid);
        const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);
        return [sorted.slice(offset, offset + limit), []];
      }
      if (cleanSql.includes('select count(*) as total from messages where session_id=\'default\' and jid=?')) {
        const messages = readTable('messages');
        const jid = params[0];
        const filtered = messages.filter(m => m.session_id === 'default' && m.jid === jid);
        return [[ { total: filtered.length } ], []];
      }
      if (cleanSql.includes('select message_id, jid, from_me, type, body, status, timestamp, created_at from messages')) {
        const messages = readTable('messages');
        const jid = params[0];
        const limit = params[1];
        const filtered = messages.filter(m => m.session_id === 'default' && m.jid === jid);
        const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);
        return [sorted.slice(0, limit), []];
      }

      // 8. API Chats List
      if (cleanSql.includes('select jid, name, is_group, unread_count, last_message, last_message_time from chats')) {
        const chats = readTable('chats');
        let list = chats.filter(ch => ch.session_id === 'default');
        if (cleanSql.includes('name like ?')) {
          const searchVal = params[0].replace(/%/g, '').toLowerCase();
          list = list.filter(ch => 
            (ch.name && ch.name.toLowerCase().includes(searchVal)) || 
            ch.jid.toLowerCase().includes(searchVal)
          );
          const limit = params[2];
          const sorted = list.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
          return [sorted.slice(0, limit), []];
        } else {
          const limit = params[0];
          const sorted = list.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
          return [sorted.slice(0, limit), []];
        }
      }

      // 9. Logs
      if (cleanSql.includes('from logs where user_id=? order by created_at desc limit 100')) {
        const logs = readTable('logs');
        const userId = parseInt(params[0]);
        const filtered = logs.filter(l => l.user_id === userId);
        const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [sorted.slice(0, 100), []];
      }
      if (cleanSql.includes('from logs l left join users u on l.user_id=u.id order by l.created_at desc limit 20')) {
        const logs = readTable('logs');
        const users = readTable('users');
        const list = logs.map(l => {
          const u = users.find(user => user.id === l.user_id);
          return { ...l, user_name: u ? u.name : 'System/Unknown' };
        });
        const sorted = list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [sorted.slice(0, 20), []];
      }

      // 10. Stats
      if (cleanSql.includes('count(*) as count from messages where from_me=1 and session_id=\'default\'')) {
        const messages = readTable('messages');
        const count = messages.filter(m => m.from_me === 1 && m.session_id === 'default').length;
        return [[{ count }], []];
      }
      if (cleanSql.includes('count(*) as count from messages where from_me=0 and session_id=\'default\'')) {
        const messages = readTable('messages');
        const count = messages.filter(m => m.from_me === 0 && m.session_id === 'default').length;
        return [[{ count }], []];
      }
      if (cleanSql.includes('count(*) as count from queue_messages where status=\'pending\'')) {
        const queue = readTable('queue_messages');
        const count = queue.filter(q => q.status === 'pending').length;
        return [[{ count }], []];
      }
      if (cleanSql.includes('count(*) as count from queue_messages where status=\'error\'')) {
        const queue = readTable('queue_messages');
        const count = queue.filter(q => q.status === 'error').length;
        return [[{ count }], []];
      }
      if (cleanSql.includes('count(*) as count from users where status=\'active\'')) {
        const users = readTable('users');
        const count = users.filter(u => u.status === 'active').length;
        return [[{ count }], []];
      }
      if (cleanSql.includes('count(*) as count from chats where session_id=\'default\'')) {
        const chats = readTable('chats');
        const count = chats.filter(ch => ch.session_id === 'default').length;
        return [[{ count }], []];
      }
    }

    // ─── INSERT Statements ───
    if (cleanSql.startsWith('insert into')) {
      const match = sql.match(/insert\s+into\s+(\w+)\s*\(([^)]+)\)/i);
      if (!match) throw new Error("Could not parse INSERT statement: " + sql);
      const table = match[1].toLowerCase();
      const cols = match[2].split(',').map(c => c.trim().toLowerCase());
      
      const data = readTable(table);
      const newRow = {};
      
      newRow.created_at = new Date().toISOString();
      newRow.updated_at = new Date().toISOString();
      
      if (table === 'users') {
        newRow.signature_enabled = 0;
        newRow.signature_text = '';
        newRow.max_messages_per_day = 0;
      }
      
      if (table !== 'sessions') {
        const maxId = data.reduce((max, r) => r.id > max ? r.id : max, 0);
        newRow.id = maxId + 1;
      }

      cols.forEach((col, idx) => {
        let val = params[idx];
        if (col === 'events' && typeof val === 'string') {
          try { val = JSON.parse(val); } catch {}
        }
        newRow[col] = val;
      });

      if (sql.toUpperCase().includes('ON DUPLICATE KEY UPDATE')) {
        let existingIndex = -1;
        if (table === 'sessions') {
          existingIndex = data.findIndex(r => r.session_id === newRow.session_id);
        } else if (table === 'chats' || table === 'contacts') {
          existingIndex = data.findIndex(r => r.session_id === newRow.session_id && r.jid === newRow.jid);
        } else if (table === 'messages') {
          existingIndex = data.findIndex(r => r.session_id === newRow.session_id && r.message_id === newRow.message_id);
        }

        if (existingIndex !== -1) {
          const existing = data[existingIndex];
          if (table === 'sessions') {
            if (newRow.status !== undefined) existing.status = newRow.status;
            if (newRow.phone_number !== undefined) existing.phone_number = newRow.phone_number;
            if (newRow.account_name !== undefined) existing.account_name = newRow.account_name;
            if (newRow.qr_code !== undefined) existing.qr_code = newRow.qr_code;
            if (newRow.status === 'connected') existing.connected_at = new Date().toISOString();
            existing.updated_at = new Date().toISOString();
          } else if (table === 'messages') {
            if (newRow.body !== undefined) existing.body = newRow.body;
            if (newRow.media_url !== undefined) existing.media_url = newRow.media_url;
            if (newRow.status !== undefined) existing.status = newRow.status;
            existing.updated_at = new Date().toISOString();
          } else if (table === 'chats') {
            if (newRow.name !== undefined) existing.name = newRow.name;
            if (newRow.last_message !== undefined) existing.last_message = newRow.last_message;
            if (newRow.last_message_time !== undefined) {
              let t = newRow.last_message_time;
              if (typeof t === 'number') t = new Date(t * 1000).toISOString();
              existing.last_message_time = t;
            }
            if (newRow.from_me === 0 || newRow.unread_count !== undefined) {
              existing.unread_count = (existing.unread_count || 0) + (newRow.unread_count || 0);
            }
            if (newRow.pinned !== undefined) existing.pinned = newRow.pinned;
            if (newRow.archived !== undefined) existing.archived = newRow.archived;
            existing.updated_at = new Date().toISOString();
          } else if (table === 'contacts') {
            if (newRow.name !== undefined) existing.name = newRow.name;
            if (newRow.push_name !== undefined) existing.push_name = newRow.push_name;
            if (newRow.avatar_url !== undefined) existing.avatar_url = newRow.avatar_url;
            existing.updated_at = new Date().toISOString();
          }
          
          writeTable(table, data);
          return [{ insertId: existing.id || 0, affectedRows: 1 }, []];
        }
      }

      data.push(newRow);
      writeTable(table, data);
      return [{ insertId: newRow.id || 0, affectedRows: 1 }, []];
    }

    // ─── UPDATE Statements ───
    if (cleanSql.startsWith('update')) {
      const match = sql.match(/update\s+(\w+)/i);
      if (!match) throw new Error("Could not parse UPDATE statement: " + sql);
      const table = match[1].toLowerCase();
      
      const data = readTable(table);
      let affectedRows = 0;
      
      if (table === 'users') {
        const id = parseInt(params[params.length - 1]);
        const user = data.find(u => u.id === id);
        if (user) {
          if (cleanSql.includes('api_token=?')) {
            user.api_token = params[0];
          } else if (cleanSql.includes('updated_at=now()') && !cleanSql.includes('name=?')) {
            user.updated_at = new Date().toISOString();
          } else {
            const setPart = sql.substring(sql.toLowerCase().indexOf('set') + 3, sql.toLowerCase().indexOf('where')).trim();
            const fields = setPart.split(',').map(f => f.trim().split('=')[0].trim().toLowerCase());
            fields.forEach((field, idx) => {
              user[field] = params[idx];
            });
          }
          user.updated_at = new Date().toISOString();
          affectedRows = 1;
        }
      }
      else if (table === 'sessions') {
        const isConnecting = cleanSql.includes("status='connecting'");
        const isDisconnected = cleanSql.includes("status='disconnected'");
        
        const sessId = isConnecting ? 'default' : params[0];
        const session = data.find(s => s.session_id === sessId);
        if (session) {
          if (isConnecting) {
            session.status = 'connecting';
            session.qr_code = null;
          } else if (isDisconnected) {
            session.status = 'disconnected';
            session.phone_number = null;
            session.account_name = null;
            session.qr_code = null;
          }
          session.updated_at = new Date().toISOString();
          affectedRows = 1;
        }
      }
      else if (table === 'chats') {
        if (cleanSql.includes('unread_count=0')) {
          const jid = params[0];
          const chat = data.find(c => c.session_id === 'default' && c.jid === jid);
          if (chat) {
            chat.unread_count = 0;
            chat.updated_at = new Date().toISOString();
            affectedRows = 1;
          }
        }
      }
      else if (table === 'queue_messages') {
        const id = parseInt(params[params.length - 1]);
        const msg = data.find(q => q.id === id);
        if (msg) {
          if (cleanSql.includes("status='cancelled'")) {
            msg.status = 'cancelled';
          } else if (cleanSql.includes("status='processing'")) {
            msg.status = 'processing';
            msg.attempts = (msg.attempts || 0) + 1;
          } else if (cleanSql.includes("status='sent'")) {
            msg.status = 'sent';
            msg.processed_at = new Date().toISOString();
          } else if (cleanSql.includes('status=?') && cleanSql.includes('error_message=?')) {
            msg.status = params[0];
            msg.error_message = params[1];
          }
          msg.updated_at = new Date().toISOString();
          affectedRows = 1;
        }
      }
      else if (table === 'automations') {
        const id = parseInt(params[params.length - 1]);
        const rule = data.find(a => a.id === id);
        if (rule) {
          const setPart = sql.substring(sql.toLowerCase().indexOf('set') + 3, sql.toLowerCase().indexOf('where')).trim();
          const fields = setPart.split(',').map(f => f.trim().split('=')[0].trim().toLowerCase());
          fields.forEach((field, idx) => {
            rule[field] = params[idx];
          });
          rule.updated_at = new Date().toISOString();
          affectedRows = 1;
        }
      }
      else if (table === 'webhooks') {
        const id = parseInt(params[params.length - 1]);
        const webhook = data.find(w => w.id === id);
        if (webhook) {
          if (cleanSql.includes('last_triggered_at=now()')) {
            webhook.last_triggered_at = new Date().toISOString();
          } else {
            const setPart = sql.substring(sql.toLowerCase().indexOf('set') + 3, sql.toLowerCase().indexOf('where')).trim();
            const fields = setPart.split(',').map(f => f.trim().split('=')[0].trim().toLowerCase());
            fields.forEach((field, idx) => {
              let val = params[idx];
              if (field === 'events' && typeof val === 'string') {
                try { val = JSON.parse(val); } catch {}
              }
              webhook[field] = val;
            });
          }
          webhook.updated_at = new Date().toISOString();
          affectedRows = 1;
        }
      }
      else if (table === 'messages') {
        const status = params[0];
        const sessId = params[1];
        const msgId = params[2];
        const msg = data.find(m => m.session_id === sessId && m.message_id === msgId);
        if (msg) {
          msg.status = status;
          msg.updated_at = new Date().toISOString();
          affectedRows = 1;
        }
      }

      writeTable(table, data);
      return [{ affectedRows }, []];
    }

    // ─── DELETE Statements ───
    if (cleanSql.startsWith('delete')) {
      const match = sql.match(/delete\s+from\s+(\w+)/i);
      if (!match) throw new Error("Could not parse DELETE statement: " + sql);
      const table = match[1].toLowerCase();
      
      let data = readTable(table);
      const initialLength = data.length;

      if (table === 'users') {
        const id = parseInt(params[0]);
        data = data.filter(u => u.id !== id);
      }
      else if (table === 'queue_messages') {
        if (cleanSql.includes("status in ('sent','cancelled')")) {
          data = data.filter(q => q.status !== 'sent' && q.status !== 'cancelled');
        }
      }
      else if (table === 'automations') {
        const id = parseInt(params[0]);
        data = data.filter(a => a.id !== id);
      }
      else if (table === 'webhooks') {
        const id = parseInt(params[0]);
        data = data.filter(w => w.id !== id);
      }

      writeTable(table, data);
      const affectedRows = initialLength - data.length;
      return [{ affectedRows }, []];
    }

    throw new Error(`Unsupported SQL query structure: ${sql}`);
  },
  query: async (sql, params = []) => {
    return db.execute(sql, params);
  },
  getConnection: async () => {
    return {
      execute: async (sql, params) => { return db.execute(sql, params); },
      query: async (sql, params) => { return db.query(sql, params); },
      release: () => {}
    };
  },
  getSentCountInLast24Hours: (userId) => {
    const logs = readTable('logs');
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return logs.filter(l => 
      l.user_id === userId && 
      (l.action === 'send_message' || l.action === 'queue_sent' || l.action === 'enqueue_message') && 
      new Date(l.created_at).getTime() >= oneDayAgo
    ).length;
  }
};

module.exports = db;
