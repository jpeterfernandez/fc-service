import React, { useEffect, useState } from 'react';
import {
  Plus, Edit2, Trash2, RefreshCw, Copy, Eye, EyeOff,
  ShieldOff, ShieldCheck, Activity,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import './AdminPage.css';
import './UsersPage.css';

/* ── User modal ──────────────────────────────────────────── */
function UserModal({ user, onClose, onSave }) {
  const toast = useToast();
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    name:     user?.name   || '',
    email:    user?.email  || '',
    password: '',
    role:     user?.role   || 'user',
    status:   user?.status || 'active',
    signature_enabled: user?.signature_enabled || 0,
    signature_text:    user?.signature_text || '',
    max_messages_per_day: user?.max_messages_per_day || 0,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${user.id}`, payload);
        toast.success('Usuario actualizado');
      } else {
        await api.post('/users', form);
        toast.success('Usuario creado');
      }
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
          <h3>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="input-label">Nombre</label>
              <input className="input" value={form.name}
                onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="input-label">Correo electrónico</label>
              <input className="input" type="email" value={form.email}
                onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="input-label">
                {isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
              </label>
              <input className="input" type="password" value={form.password}
                onChange={e => set('password', e.target.value)} required={!isEdit}
                placeholder={isEdit ? '••••••••' : ''} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="input-label">Rol</label>
                <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="user">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="input-label">Estado</label>
                <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
            
            <div style={{ background: 'var(--bg-active)', padding: 12, borderRadius: 8, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input 
                  type="checkbox" 
                  id="sig_enabled"
                  checked={form.signature_enabled === 1}
                  onChange={e => set('signature_enabled', e.target.checked ? 1 : 0)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="sig_enabled" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Habilitar firma automática
                </label>
              </div>
              {form.signature_enabled === 1 && (
                <div className="form-group" style={{ marginBottom: 0, marginTop: 10 }}>
                  <label className="input-label">Texto de la Firma</label>
                  <input 
                    className="input" 
                    value={form.signature_text}
                    placeholder="Ej: [Enviado por Juan:] o Atte: Soporte"
                    onChange={e => set('signature_text', e.target.value)} 
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', marginTop: 4 }}>
                    Se añadirá al final de los mensajes enviados vía API/Web.
                  </small>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="input-label">Límite diario de mensajes</label>
              <input 
                className="input" 
                type="number" 
                min="0"
                value={form.max_messages_per_day}
                onChange={e => set('max_messages_per_day', parseInt(e.target.value) || 0)} 
              />
              <small style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', marginTop: 4 }}>
                Establece el número máximo de mensajes por día (0 para ilimitado, ej: 30 o 40).
              </small>
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

/* ── Activity modal ──────────────────────────────────────── */
function ActivityModal({ user, onClose }) {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/users/${user.id}/activity`)
      .then(r => setLogs(r.data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Actividad de {user.name}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto', padding: '8px 16px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div>}
          {!loading && logs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin actividad</p>
          )}
          {logs.map(log => (
            <div key={log.id} style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-primary)' }}>{log.description}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                {log.type} · {log.action}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [activityUser, setActivityUser] = useState(null);
  const [showToken, setShowToken]       = useState({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar usuario permanentemente?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('Usuario eliminado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  }

  async function handleToggleStatus(user) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/users/${user.id}`, { status: newStatus });
      toast.success(newStatus === 'active' ? 'Usuario activado' : 'Usuario desactivado');
      load();
    } catch {
      toast.error('Error al cambiar estado');
    }
  }

  async function handleRegenToken(id) {
    if (!window.confirm('¿Regenerar token? El token anterior dejará de funcionar.')) return;
    try {
      await api.post(`/users/${id}/regenerate-token`);
      toast.success('Token regenerado — el anterior ya no funciona');
      load();
    } catch {
      toast.error('Error al regenerar token');
    }
  }

  async function handleRevokeToken(id) {
    if (!window.confirm('¿Revocar token? Todas las peticiones con ese token fallarán hasta regenerarlo.')) return;
    try {
      // Set api_token to null → middleware rejects all requests with that token
      await api.put(`/users/${id}`, { status: 'inactive' });
      toast.success('Token revocado (usuario desactivado). Reactiva para un nuevo token.');
      load();
    } catch {
      toast.error('Error al revocar token');
    }
  }

  function copyToken(token) {
    if (!token) { toast.error('Sin token'); return; }
    navigator.clipboard.writeText(token);
    toast.success('Token copiado al portapapeles');
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Usuarios</h2>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      <div className="card" style={{ overflow: 'visible' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Firma</th>
                <th>Límite Diario</th>
                <th>API Token</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 28 }}>
                    <span className="spinner" />
                  </td>
                </tr>
              )}
              {!loading && users.map(u => (
                <tr key={u.id} className={u.status === 'inactive' ? 'row-inactive' : ''}>
                  {/* Usuario */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</span>
                    </div>
                  </td>

                  {/* Rol */}
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-grey'}`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Estado */}
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                      {u.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  {/* Firma */}
                  <td>
                    {u.signature_enabled === 1 ? (
                      <span className="badge badge-blue" title={u.signature_text}>Activada</span>
                    ) : (
                      <span className="badge badge-grey">Inactiva</span>
                    )}
                  </td>

                  {/* Límite Diario */}
                  <td>
                    {u.max_messages_per_day > 0 ? (
                      <span className="badge badge-blue">{u.max_messages_per_day} msgs/día</span>
                    ) : (
                      <span className="badge badge-grey">Sin límite</span>
                    )}
                  </td>

                  {/* Token */}
                  <td>
                    <div className="token-cell">
                      <code className="token-code">
                        {u.api_token
                          ? (showToken[u.id] ? u.api_token : `${u.api_token.substring(0,8)}••••••••`)
                          : <span style={{ color: 'var(--color-error)' }}>Revocado</span>
                        }
                      </code>
                      <div className="token-actions">
                        {u.api_token && (
                          <>
                            <button title="Ver / ocultar" className="btn btn-ghost" style={{ padding: 3 }}
                              onClick={() => setShowToken(p => ({ ...p, [u.id]: !p[u.id] }))}>
                              {showToken[u.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <button title="Copiar token" className="btn btn-ghost" style={{ padding: 3 }}
                              onClick={() => copyToken(u.api_token)}>
                              <Copy size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Acciones */}
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setModal(u)}>
                        <Edit2 size={14} />
                      </button>

                      <button
                        className="btn btn-ghost btn-sm"
                        title={u.status === 'active' ? 'Desactivar usuario (revoca acceso)' : 'Activar usuario'}
                        onClick={() => handleToggleStatus(u)}
                        style={{ color: u.status === 'active' ? 'var(--color-error)' : 'var(--accent)' }}
                      >
                        {u.status === 'active' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      </button>

                      <button className="btn btn-ghost btn-sm" title="Regenerar token"
                        onClick={() => handleRegenToken(u.id)}>
                        <RefreshCw size={14} />
                      </button>

                      <button className="btn btn-ghost btn-sm" title="Ver actividad"
                        onClick={() => setActivityUser(u)}>
                        <Activity size={14} />
                      </button>

                      <button className="btn btn-ghost btn-sm" title="Eliminar usuario"
                        onClick={() => handleDelete(u.id)}>
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

      {/* Token info box */}
      <div className="token-info-box">
        <strong>¿Cómo revocar acceso sin eliminar usuario?</strong>
        <p>
          Usa el botón <ShieldOff size={12} style={{ verticalAlign:'middle' }} /> para desactivar el usuario.
          Un usuario inactivo no puede hacer peticiones API aunque tenga token.
          Para volver a habilitar, usa <ShieldCheck size={12} style={{ verticalAlign:'middle' }} />.
          Para emitir un token completamente nuevo, usa <RefreshCw size={12} style={{ verticalAlign:'middle' }} />.
        </p>
      </div>

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}

      {activityUser && (
        <ActivityModal user={activityUser} onClose={() => setActivityUser(null)} />
      )}
    </div>
  );
}
