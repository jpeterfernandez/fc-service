import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  MessageSquare, LayoutDashboard, Smartphone, Users,
  List, Zap, Webhook, LogOut, Menu, X, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SessionStatusBadge from './SessionStatusBadge';
import logoUrl from '../assets/logo.png';
import './Layout.css';

const navItems = [
  { to: '/chats',       icon: MessageSquare,    label: 'Chats' },
  /*
  { to: '/dashboard',   icon: LayoutDashboard,  label: 'Dashboard' },
   */
  { to: '/session',     icon: Smartphone,       label: 'Sesión WA',        adminOnly: true },
  { to: '/users',       icon: Users,            label: 'Usuarios',         adminOnly: true },
  { to: '/queue',       icon: List,             label: 'Cola de mensajes' },
  { to: '/automations', icon: Zap,              label: 'Automatizaciones' },
  { to: '/docs',        icon: LayoutDashboard,  label: 'Documentación' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // desktopOpen controls sidebar on desktop (default: open)
  const [desktopOpen, setDesktopOpen] = useState(true);
  // mobileOpen controls sidebar on mobile (default: closed)
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className={`layout ${desktopOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>

      {/* Mobile overlay — closes sidebar when clicking outside */}
      {mobileOpen && (
        <div
          className="layout-overlay"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>

        {/* Logo + toggle */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <img src={logoUrl} alt="Logo" style={{ width: 30, height: 30, marginLeft: 4 }} />
          </div>
          {desktopOpen && <span className="sidebar-title">FC Service </span>}

          {/* Desktop collapse button */}
          <button
            className="btn btn-ghost btn-icon sidebar-toggle-desktop"
            onClick={() => setDesktopOpen(o => !o)}
            title={desktopOpen ? 'Colapsar menú' : 'Expandir menú'}
          >
            {desktopOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          {/* Mobile close button */}
          <button
            className="btn btn-ghost btn-icon sidebar-close-mobile"
            onClick={closeMobile}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Session status (only when expanded) */}
        {desktopOpen && (
          <div className="sidebar-session">
            <SessionStatusBadge />
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
                title={!desktopOpen ? item.label : undefined}
              >
                <item.icon size={18} className="nav-icon" />
                {desktopOpen && <span className="nav-label">{item.label}</span>}
                {desktopOpen && <ChevronRight size={13} className="nav-chevron" />}
              </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="sidebar-avatar" title={user?.name}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {desktopOpen && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-role">{user?.role}</span>
            </div>
          )}
          <button
            className="btn btn-ghost btn-icon sidebar-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="layout-main">
        {/* Top bar — visible on mobile, hidden on desktop */}
        <header className="layout-topbar">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <span className="layout-topbar-title">WA Platform</span>
          <SessionStatusBadge compact />
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
