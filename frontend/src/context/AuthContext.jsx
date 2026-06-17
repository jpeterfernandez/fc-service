import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/profile');
        if (cancelled) return;
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      } catch {
        if (cancelled) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function handleGlobalLogout() {
      setUser(null);
      setLoading(false);
    }

    window.addEventListener('auth:logout', handleGlobalLogout);
    initSession();

    return () => {
      cancelled = true;
      window.removeEventListener('auth:logout', handleGlobalLogout);
    };
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password }, { skipAuthRedirect: true });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  async function refreshProfile() {
    try {
      const { data } = await api.get('/auth/profile');
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
