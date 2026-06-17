import React, { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, LogOut, Smartphone, AlertCircle, Clock } from 'lucide-react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { useToast } from '../context/ToastContext';
import './SessionPage.css';

export default function SessionPage() {
  const toast = useToast();
  const [session, setSession]   = useState({});
  const [loading, setLoading]   = useState(false);
  const [sockState, setSockState] = useState('');
  const [connectStart, setConnectStart] = useState(null);
  const pollRef = useRef(null);

  async function loadStatus() {
    try {
      const { data } = await api.get('/session/status');
      if (data?.session) setSession(data.session);
      if (data?.socketState) setSockState(data.socketState);
    } catch {}
  }

  useEffect(() => {
    loadStatus();
    pollRef.current = setInterval(loadStatus, 4000);

    const socket = getSocket();
    const handler = (data) => {
      console.log('Socket session update:', data);
      setSession(prev => ({ ...prev, ...data }));
    };
    socket.on('session:status', handler);

    return () => {
      clearInterval(pollRef.current);
      socket.off('session:status', handler);
    };
  }, []);

  useEffect(() => {
    if (session.status === 'connecting' && !connectStart) {
      setConnectStart(Date.now());
    }
  }, [session.status]);

  async function handleConnect() {
    setLoading(true);
    try {
      const { data } = await api.post('/session/connect');
      toast.success(data.message || 'Iniciando conexión...');
      // Poll faster while connecting
      setTimeout(loadStatus, 1500);
      setTimeout(loadStatus, 4000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al conectar';
      toast.error(msg);
    }
    setLoading(false);
  }

  async function handleForceReconnect() {
    setLoading(true);
    try {
      await api.post('/session/reconnect');
      toast.success('Reiniciando conexión...');
      setTimeout(loadStatus, 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al reconectar');
    }
    setLoading(false);
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await api.post('/session/disconnect');
      toast.success('Sesión desconectada');
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar sesión? Tendrás que escanear el QR nuevamente.')) return;
    setLoading(true);
    try {
      await api.delete('/session/delete');
      toast.success('Sesión eliminada');
      setSession({ status: 'disconnected' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
    setLoading(false);
  }

  const status       = session.status || 'disconnected';
  const isConnected  = status === 'connected';
  const isConnecting = status === 'connecting';

  // Show warning if DB says connected but socket is dead in memory
  const showSockWarning = status === 'connected' && sockState === 'no_socket';

  return (
    <div className="session-page">
      <div className="page-header">
        <h2>Sesión WhatsApp</h2>
        <button className="btn btn-secondary btn-sm" onClick={loadStatus} disabled={loading}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Warning banner when DB and memory are out of sync */}
      {showSockWarning && (
        <div className="session-warning">
          <AlertCircle size={16} />
          <span>
            La base de datos dice "conectado" pero el socket no está activo.
            Usa <strong>Forzar reconexión</strong>.
          </span>
        </div>
      )}

      <div className="session-layout">
        {/* ── Status card ─────────────────────────────────── */}
        <div className="card session-status-card">
          <div className="session-status-icon" data-status={status}>
            <Smartphone size={36} />
          </div>

          <div className="session-status-info">
            <div className="session-status-row">
              <span className={`status-dot ${status}`} />
              <span className="session-status-text">
                {status === 'connected'  ? 'Conectado'        :
                 status === 'connecting' ? 'Conectando...'    :
                 status === 'error'      ? 'Error de conexión' : 'Desconectado'}
              </span>
            </div>

            {isConnected && (session.account_name || session.phone_number) && (
              <div className="session-account">
                <div className="session-account-name">
                  {session.account_name || 'WhatsApp'}
                </div>
                <div className="session-account-phone">
                  +{session.phone_number}
                </div>
                {session.connected_at && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Desde {new Date(session.connected_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Debug badge (only visible when there's a mismatch) */}
            {sockState && sockState !== 'connected' && isConnected && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-error)' }}>
                Socket: {sockState}
              </div>
            )}
          </div>

          <div className="session-actions">
            {/* Desconectado: mostrar Conectar */}
            {!isConnected && !isConnecting && (
              <button className="btn btn-primary" onClick={handleConnect} disabled={loading}>
                {loading
                  ? <><span className="spinner" style={{ width:15,height:15 }} /> Iniciando...</>
                  : <><Wifi size={16} /> Conectar WhatsApp</>
                }
              </button>
            )}

            {/* Conectando: mostrar spinner + opción de reintentar */}
            {isConnecting && (
              <button className="btn btn-secondary" onClick={handleConnect} disabled={loading}>
                <span className="spinner" style={{ width:15,height:15 }} />
                {loading ? 'Reiniciando...' : 'Reiniciar conexión'}
              </button>
            )}

            {/* Siempre disponible cuando hay algo activo */}
            {(isConnecting || isConnected || showSockWarning) && (
              <button
                className="btn btn-secondary"
                onClick={handleForceReconnect}
                disabled={loading}
                title="Cierra el socket actual y reconecta desde cero"
              >
                <RefreshCw size={15} /> Forzar reconexión
              </button>
            )}

            {isConnected && (
              <button className="btn btn-secondary" onClick={handleDisconnect} disabled={loading}>
                <LogOut size={15} /> Desconectar
              </button>
            )}

            <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
              <Trash2 size={15} /> Eliminar sesión
            </button>
          </div>
        </div>

        {/* ── QR card ─────────────────────────────────────── */}
        {isConnecting && session.qr_code && (
          <div className="card qr-card">
            <h3>Escanea el código QR</h3>
            <p>WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            <div className="qr-wrapper">
              <img src={session.qr_code} alt="QR Code" className="qr-image" />
            </div>
            <p className="qr-hint">
              El código se regenera cada ~20 seg. Si expira, pulsa "Reiniciar conexión".
            </p>
          </div>
        )}

        {isConnecting && !session.qr_code && (
          <div className="card qr-card qr-placeholder">
            <span className="spinner" style={{ width: 40, height: 40 }} />
            <p style={{ marginTop: 14 }}>Generando código QR...</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Puede tardar unos segundos
            </p>
            {connectStart && (
              <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 8 }}>
                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Esperando {(Math.floor((Date.now() - connectStart) / 1000))}s
              </p>
            )}
            {connectStart && Date.now() - connectStart > 90000 && (
              <p style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 12, padding: 8, border: '1px solid var(--color-error)', borderRadius: 4 }}>
                ⚠️ WhatsApp parece estar bloqueando la conexión desde este servidor (datacenter). 
                Para producción, usa una IP dedicada o servicio compatible como Twilio.
              </p>
            )}
          </div>
        )}

        {!isConnecting && !isConnected && (
          <div className="card qr-card qr-placeholder">
            <WifiOff size={48} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
            <p>Presiona <strong>Conectar WhatsApp</strong> para generar el QR</p>
          </div>
        )}
      </div>
    </div>
  );
}
