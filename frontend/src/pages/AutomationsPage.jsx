import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import './AdminPage.css';

function AutomationModal({ item, onClose, onSave }) {
  const toast = useToast();
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    name: item?.name || '',
    trigger_keyword: item?.trigger_keyword || '',
    match_type: item?.match_type || 'contains',
    response_message: item?.response_message || '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      trigger_keyword: form.trigger_keyword.trim(),
      response_message: form.response_message.trim(),
    };
    try {
      if (isEdit) await api.put(`/automations/${item.id}`, payload);
      else await api.post('/automations', payload);
      toast.success(isEdit ? 'Automatización actualizada' : 'Automatización creada');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
    setLoading(false);
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Editar automatización' : 'Nueva automatización'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="input-label">Nombre</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ej: Saludo inicial" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="input-label">Palabra clave / trigger</label>
                <input className="input" value={form.trigger_keyword}
                  onChange={e => set('trigger_keyword', e.target.value)} required placeholder="hola" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="input-label">Tipo de coincidencia</label>
                <select className="input" value={form.match_type} onChange={e => set('match_type', e.target.value)}>
                  <option value="contains">Contiene</option>
                  <option value="exact">Exacto</option>
                  <option value="starts_with">Inicia con</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="input-label">Respuesta automática</label>
              <textarea className="input" rows={4} value={form.response_message}
                onChange={e => set('response_message', e.target.value)} required
                placeholder="¡Hola! Gracias por contactarnos..." style={{ resize: 'vertical' }} />
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

export default function AutomationsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/automations');
      setItems(data.automations || []);
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudieron cargar las automatizaciones';
      setError(message);
      toast.error(message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(item) {
    try {
      await api.put(`/automations/${item.id}`, { is_active: !item.is_active });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar automatización?')) return;
    try {
      await api.delete(`/automations/${id}`);
      toast.success('Eliminada');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    }
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Automatizaciones</h2>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nueva regla
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Keyword</th>
                <th>Tipo</th>
                <th>Respuesta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                  {error || 'No hay automatizaciones'}
                </td></tr>
              )}
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td><code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{item.trigger_keyword}</code></td>
                  <td><span className="badge badge-grey">{item.match_type}</span></td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {item.response_message}
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ padding: 2, color: item.is_active ? 'var(--accent)' : 'var(--text-muted)' }}
                      onClick={() => handleToggle(item)} title={item.is_active ? 'Desactivar' : 'Activar'}>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <AutomationModal
          item={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
