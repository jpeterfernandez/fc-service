import React, { useEffect, useState, useRef } from 'react';
import { getSocket } from '../lib/socket';
import api from '../lib/api';

export default function SessionStatusBadge({ compact = false }) {
  const [session, setSession] = useState({ status: 'disconnected' });
  const pollRef = useRef(null);

  async function fetchStatus() {
    try {
      const r = await api.get('/session/status');
      if (r.data?.session) setSession(r.data.session);
    } catch {}
  }

  useEffect(() => {
    fetchStatus();

    // Poll every 8s as a fallback in case socket misses an event
    pollRef.current = setInterval(fetchStatus, 8000);

    const socket = getSocket();
    // Bug Fix #3: the socket emits the full DB row, so use phone_number not phone
    const handler = (data) => {
      setSession(prev => ({ ...prev, ...data }));
    };
    socket.on('session:status', handler);

    return () => {
      clearInterval(pollRef.current);
      socket.off('session:status', handler);
    };
  }, []);

  const labels = {
    connected:    'Conectado',
    connecting:   'Conectando...',
    disconnected: 'Desconectado',
    error:        'Error',
  };

  if (compact) {
    return (
      <span
        className={`status-dot ${session.status || 'disconnected'}`}
        style={{ width: 10, height: 10, display: 'inline-block' }}
        title={labels[session.status] || session.status}
      />
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span className={`status-dot ${session.status || 'disconnected'}`} />
      <span style={{ color: 'var(--text-secondary)' }}>
        {labels[session.status] || session.status}
        {session.status === 'connected' && session.phone_number && (
          <span style={{ marginLeft: 4, color: 'var(--text-muted)' }}>
            {session.phone_number}
          </span>
        )}
      </span>
    </div>
  );
}
