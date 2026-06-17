require('dotenv').config();

// Polyfill para Node 18 para la dependencia de baileys (crypto)
// Polyfill robusto para Node 18 para la dependencia de baileys (crypto + 0-length HKDF fix)
if (!globalThis.crypto) {
  const nodeCrypto = require('crypto');
  const webcrypto = nodeCrypto.webcrypto;
  if (webcrypto && webcrypto.subtle) {
    const originalImportKey = webcrypto.subtle.importKey.bind(webcrypto.subtle);
    const originalDeriveBits = webcrypto.subtle.deriveBits.bind(webcrypto.subtle);

    webcrypto.subtle.importKey = async function(format, keyData, algo, extractable, usages) {
      if ((algo === 'HKDF' || algo.name === 'HKDF') && keyData.byteLength === 0) {
        return { _isZeroLengthHKDF: true, algo };
      }
      return originalImportKey(format, keyData, algo, extractable, usages);
    };

    webcrypto.subtle.deriveBits = async function(algo, baseKey, length) {
      if (baseKey && baseKey._isZeroLengthHKDF) {
        const hashStr = (algo.hash.name || algo.hash || 'SHA-256').replace('-', '').toLowerCase();
        const salt = algo.salt || new Uint8Array(0);
        const info = algo.info || new Uint8Array(0);
        
        // Custom HKDF implementation (RFC 5869) to support 0-length IKM in Node 18
        const prk = nodeCrypto.createHmac(hashStr, salt).update(new Uint8Array(0)).digest();
        let t = Buffer.alloc(0);
        let okm = Buffer.alloc(0);
        let i = 1;
        const lenBytes = length / 8;
        while (okm.length < lenBytes) {
          t = nodeCrypto.createHmac(hashStr, prk).update(Buffer.concat([t, info, Buffer.from([i])])).digest();
          okm = Buffer.concat([okm, t]);
          i++;
        }
        return okm.slice(0, lenBytes);
      }
      return originalDeriveBits(algo, baseKey, length);
    };
  }
  globalThis.crypto = webcrypto;
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const { connectWhatsApp, setIO } = require('./whatsapp/client');
const db = require('./database/db');

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Al devolver `origin || true`, acepta dinámicamente cualquier dominio
    // desde el que se esté accediendo sin necesidad de configurarlo en el .env
    return cb(null, origin || true);
  },
  credentials: true,
};

// ── Socket.IO ────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, origin || true),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setIO(io);

// Bug Fix #5: when a client connects, immediately send the current session state
io.on('connection', async (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  try {
    const [rows] = await db.execute(
      `SELECT session_id, status, phone_number, account_name, qr_code, connected_at
       FROM sessions WHERE session_id='default'`
    );
    if (rows[0]) {
      socket.emit('session:status', rows[0]);
    }
  } catch {}

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ── Servir assets estáticos del frontend ANTES de las rutas API ──
// Los assets con hash (JS, CSS) se sirven directamente sin pasar por rutas API.
const FRONTEND_DIST_PATHS = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'frontend', 'dist'),
  path.join(__dirname, '..', '..', 'frontend', 'dist'),
  path.join(__dirname, '..', 'frontend', 'dist'),
  path.join(__dirname, 'frontend', 'dist'),
  path.join(path.dirname(process.execPath || ''), 'frontend', 'dist'),
];
const FRONTEND_DIST = FRONTEND_DIST_PATHS.find(p => {
  try { return fs.existsSync(path.join(p, 'index.html')); } catch { return false; }
});
if (FRONTEND_DIST) {
  console.log('📁 Sirviendo frontend desde:', FRONTEND_DIST);
  // Serve static assets (JS, CSS, images) — must be before API routes
  app.use(express.static(FRONTEND_DIST, { index: false }));
}

// ── Middleware ───────────────────────────────────────────────
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests' },
});

// ── Routes ───────────────────────────────────────────────────
app.use('/auth',        require('./routes/auth'));
app.use('/session',     require('./routes/session'));
app.use('/chats',       require('./routes/chats'));
app.use('/users',       require('./routes/users'));
app.use('/queue',       require('./routes/queue'));
app.use('/automations', require('./routes/automations'));
app.use('/webhooks',    require('./routes/webhooks'));
app.use('/dashboard',   require('./routes/dashboard'));
app.use('/api',         apiLimiter, require('./routes/api'));

// Health check
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── SPA fallback: rutas no-API devuelven index.html ─────────
// Solo responde con index.html si el cliente acepta HTML
// (navegador haciendo reload), no si es una llamada de API (Accept: application/json).
if (FRONTEND_DIST) {
  app.use((req, res, next) => {
    // Skip API-style requests (JSON clients, non-GET methods, socket.io)
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/socket.io')) return next();
    const accept = req.headers['accept'] || '';
    if (!accept.includes('text/html')) return next();

    const indexPath = path.join(FRONTEND_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
} else {
  console.warn('⚠️  Frontend dist no encontrado, solo API disponible');
}

// 404 solo para rutas que no matchearon nada
app.use((req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📡 Socket.IO ready`);

  // Bug Fix #6: auto-reconnect only when session was previously connected
  // (not just non-disconnected — avoids reconnecting a 'connecting' stale state)
  try {
    const [rows] = await db.execute(
      `SELECT status FROM sessions WHERE session_id='default'`
    );
    const status = rows[0]?.status;

    if (status === 'connected') {
      console.log('🔄 Auto-reconnecting WhatsApp session...');
      // Reset to 'connecting' first so frontend shows the right state
      await db.execute(
        `UPDATE sessions SET status='connecting', qr_code=NULL, updated_at=NOW()
         WHERE session_id='default'`
      );
      connectWhatsApp('default').catch(err =>
        console.error('Auto-connect error:', err.message)
      );
    } else if (status === 'connecting') {
      // Was left in 'connecting' state (e.g. QR never scanned before shutdown).
      // Reset to disconnected so the user can manually reconnect from the UI.
      console.log('ℹ️  Previous session was in connecting state — resetting to disconnected.');
      await db.execute(
        `UPDATE sessions SET status='disconnected', qr_code=NULL, updated_at=NOW()
         WHERE session_id='default'`
      );
    }
  } catch (e) {
    console.error('Session check error:', e.message);
  }

  // Bug Fix: Start the queue worker directly inside the server process
  // This prevents SQLite/JSON session lock conflicts with a separate worker process
  const { startWorker } = require('./worker');
  startWorker();
});

module.exports = { app, io };
