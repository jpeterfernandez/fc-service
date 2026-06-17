import React, { useEffect, useState } from 'react';
import { RefreshCw, XCircle, BarChart2 } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import './AdminPage.css';

const STATUS_COLORS = {
  pending: '#f1c40f',
  processing: '#53bdeb',
  sent: 'var(--accent)',
  error: 'var(--color-error)',
  cancelled: 'var(--text-muted)',
};

export default function QueuePage() {
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [q, s] = await Promise.all([
        api.get('/queue', { params: { status: filter || undefined, limit: 100 } }),
        api.get('/queue/stats'),
      ]);
      setQueue(q.data.queue || []);
      setStats(s.data.stats || {});
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleCancel(id) {
    try {
      await api.delete(`/queue/${id}`);
      toast.success('Mensaje cancelado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Cola de mensajes</h2>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(stats).map(([status, count]) => (
          <div key={status} className="card" style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS[status] }}>{count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{status}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['', 'pending', 'processing', 'sent', 'error', 'cancelled'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s || 'Todos'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--bg-active)' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}># ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Destinatario</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Mensaje</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Creado</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <span className="spinner" />
                </td></tr>
              )}
              {!loading && queue.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <BarChart2 size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <div>No hay registros en la cola</div>
                </td></tr>
              )}
              {queue.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>#{m.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{m.to_number}</td>
                  <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="badge badge-grey" style={{ fontSize: 10 }}>{m.type}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 150 }}>
                        {m.message || m.file_name || '—'}
                      </span>
                    </div>
                    {m.error_message && (
                      <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4, lineHeight: 1.3 }}>
                        ⚠️ {m.error_message}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="badge" style={{ 
                        background: STATUS_COLORS[m.status] + '20', 
                        color: STATUS_COLORS[m.status],
                        border: `1px solid ${STATUS_COLORS[m.status]}40`,
                        width: 'fit-content'
                      }}>
                        {m.status === 'sent' ? 'Enviado' : 
                         m.status === 'error' ? 'Error' : 
                         m.status === 'pending' ? 'Pendiente' : 
                         m.status === 'processing' ? 'Procesando' : 'Cancelado'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Intento {m.attempts} / {m.max_attempts}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {m.status === 'pending' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(m.id)} title="Cancelar envío">
                        <XCircle size={16} style={{ color: 'var(--color-error)' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
