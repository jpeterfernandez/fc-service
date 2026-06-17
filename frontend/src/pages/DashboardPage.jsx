import React, { useEffect, useState } from 'react';
import {
  MessageSquare, Send, Clock, Users, Wifi, Activity,
  AlertCircle, CheckCircle, RefreshCw,
} from 'lucide-react';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import './DashboardPage.css';

function StatCard({ icon: Icon, label, value, color = 'var(--accent)' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + '20', color }}>
        <Icon size={22} />
      </div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/dashboard');
      setStats(data.stats);
      setActivity(data.recentActivity || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="page-loading">
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const s = stats || {};
  const session = s.session || {};

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard icon={Send} label="Mensajes enviados" value={s.messages?.sent} color="var(--accent)" />
        <StatCard icon={MessageSquare} label="Mensajes recibidos" value={s.messages?.received} color="#53bdeb" />
        <StatCard icon={Clock} label="En cola (pendiente)" value={s.queue?.pending} color="#f1c40f" />
        <StatCard icon={AlertCircle} label="Errores en cola" value={s.queue?.error} color="var(--color-error)" />
        <StatCard icon={Users} label="Usuarios activos" value={s.users} color="#a78bfa" />
        <StatCard icon={MessageSquare} label="Chats totales" value={s.chats} color="#34d399" />
      </div>

      {/* Session & Queue status */}
      <div className="dashboard-row">
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">
            <Wifi size={16} /> Estado de WhatsApp
          </div>
          <div className="session-info">
            <span className={`status-dot ${session.status}`} />
            <div>
              <div style={{ fontWeight: 600 }}>
                {session.status === 'connected' ? 'Conectado' :
                 session.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </div>
              {session.phone_number && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {session.account_name} · {session.phone_number}
                </div>
              )}
              {session.connected_at && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Conectado {formatDistanceToNow(new Date(session.connected_at), { addSuffix: true, locale: es })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">
            <Activity size={16} /> Cola de mensajes
          </div>
          <div className="queue-bars">
            {Object.entries(s.queue?.byStatus || {}).map(([status, count]) => (
              <div key={status} className="queue-bar-row">
                <span className="queue-bar-label">{status}</span>
                <div className="queue-bar-track">
                  <div
                    className="queue-bar-fill"
                    style={{
                      width: `${Math.min(100, count * 4)}%`,
                      background: status === 'sent' ? 'var(--accent)' :
                                  status === 'error' ? 'var(--color-error)' :
                                  status === 'pending' ? '#f1c40f' : 'var(--text-muted)',
                    }}
                  />
                </div>
                <span className="queue-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>
          <Activity size={16} /> Actividad reciente
        </div>
        <div className="activity-list">
          {activity.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              Sin actividad reciente
            </div>
          )}
          {activity.map(log => (
            <div key={log.id} className="activity-item">
              <div className={`activity-icon ${log.type}`}>
                {log.type === 'error' ? <AlertCircle size={13} /> : <CheckCircle size={13} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>{log.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {log.user_name && `${log.user_name} · `}
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: es })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
