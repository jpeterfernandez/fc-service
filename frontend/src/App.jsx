import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import ChatsPage from './pages/ChatsPage';
import DashboardPage from './pages/DashboardPage';
import SessionPage from './pages/SessionPage';
import UsersPage from './pages/UsersPage';
import QueuePage from './pages/QueuePage';
import AutomationsPage from './pages/AutomationsPage';
import WebhooksPage from './pages/WebhooksPage';
import DocsPage from './pages/DocsPage';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/chats" replace />} />
              <Route path="chats" element={<ChatsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="session" element={<PrivateRoute adminOnly><SessionPage /></PrivateRoute>} />
              <Route path="users" element={<PrivateRoute adminOnly><UsersPage /></PrivateRoute>} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="automations" element={<AutomationsPage />} />
              <Route path="docs" element={<DocsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
