import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use explicit IPv4 address to avoid Windows localhost→IPv6 resolution issues
const BACKEND = 'http://127.0.0.1:3001';

// Shared proxy config with error handler to suppress "backend not running" noise
function makeProxy(opts = {}) {
  return {
    target: BACKEND,
    changeOrigin: true,
    bypass: (req, res, options) => {
      // Don't proxy browser page reloads (HTML requests) so React Router works
      if (req.headers.accept?.includes('text/html')) {
        return req.url;
      }
    },
    configure: (proxy) => {
      proxy.on('error', () => {}); // silence ECONNREFUSED when backend is off
    },
    ...opts,
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/auth':        makeProxy(),
      '/session':     makeProxy(),
      '/chats':       makeProxy(),
      '/users':       makeProxy(),
      '/queue':       makeProxy(),
      '/automations': makeProxy(),
      '/webhooks':    makeProxy(),
      '/dashboard':   makeProxy(),
      '/api':         makeProxy(),
      '/uploads':     makeProxy(),
      '/health':      makeProxy(),
      '/socket.io':   makeProxy({ ws: true }),
    },
  },
});
