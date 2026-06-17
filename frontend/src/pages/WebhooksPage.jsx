import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import './AdminPage.css';

const ALL_EVENTS = [
  'message.received', 'message.sent', 'message.error',
  'session.connected', 'session.disconnected',
];

function WebhookModal({ item, onClose, onSave }) {
  const toast = useToast();
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    url: item?.url || '',
    secret: item?.secret || '',
    events: (() => {
      try { return typeof item?.events === 'string' ? JSON.parse(item.events) : (item?.events || []); }
      catch { return []; }
    })(),
  });
  const [loading, setLoading] = useState(false);

  function toggleEvent(ev) {
    setForm(p => ({
      ...p,
      events: p.events.includes(ev) ? p.events.filter(e => e !== ev) : [...p.events, ev],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await api.put(`/webhooks/${item.id}`, form);
      else await api.post('/webhooks', form);
      toast.success(isEdit ? 'Webhook actualizado' : 'Webhook creado');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Editar webhook' : 'Nuevo webhook'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="input-label">URL destino</label>
              <input className="input" type="url" value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))} required
                placeholder="https://mi-servidor.com/webhook" />
            </div>
            <div className="form-group">
              <label className="input-label">Secret (opcional, para firma HMAC)</label>
              <input className="input" value={form.secret}
                onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
                placeholder="mi_secret_key" />
            </div>
            <div className="form-group">
              <label className="input-label" style={{ marginBottom: 8 }}>
                Eventos a enviar (vacío = todos)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_EVENTS.map(ev => (
                  <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                    background: form.events.includes(ev) ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    padding: '4px 10px', borderRadius: 20, fontSize: 12,
                    color: form.events.includes(ev) ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                    <input type="checkbox" hidden checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/webhooks');
      setItems(data.webhooks || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(item) {
    try {
      await api.put(`/webhooks/${item.id}`, { is_active: !item.is_active });
      load();
    } catch {
      toast.error('Error al actualizar');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar webhook?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success('Eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Webhooks</h2>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nuevo webhook
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Eventos</th>
                <th>Último disparo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                  No hay webhooks configurados
                </td></tr>
              )}
              {items.map(item => {
                let events = [];
                try { events = typeof item.events === 'string' ? JSON.parse(item.events) : (item.events || []); } catch {}
                return (
                  <tr key={item.id}>
                    <td style={{ maxWidth: 220 }}>
                      <a href={item.url} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--text-link)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                        {item.url}
                      </a>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {events.length === 0
                          ? <span className="badge badge-grey">todos</span>
                          : events.map(e => <span key={e} className="badge badge-grey" style={{ fontSize: 10 }}>{e}</span>)
                        }
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.last_triggered_at ? new Date(item.last_triggered_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: 2, color: item.is_active ? 'var(--accent)' : 'var(--text-muted)' }}
                        onClick={() => handleToggle(item)}>
                        {item.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <WebhookModal
          item={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
