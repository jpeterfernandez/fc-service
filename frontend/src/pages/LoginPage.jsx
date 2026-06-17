import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return toast.error('Completa todos los campos');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/chats');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <img src="/logo.png" alt="Logo" style={{ width: 84, height: 84 }} />
          </div>
          <h1>FC Service Web</h1>
          <p>Inicia sesión en tu panel</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="input-label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              placeholder="admin@admin.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="input-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 4 }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ marginTop: 8, justifyContent: 'center', padding: '10px 16px' }}
          >
            {loading ? <span className="spinner" /> : 'Iniciar sesión'}
          </button>
        </form>

        
      </div>
    </div>
  );
}
