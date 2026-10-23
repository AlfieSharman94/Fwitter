import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, ApiError } from './api';
import { authConfigured, hasSession, logout } from './auth';
import type { Me } from './types';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import BannedWords from './pages/BannedWords';
import Audit from './pages/Audit';

type Gate = { state: 'loading' } | { state: 'signed-out' } | { state: 'forbidden' } | { state: 'ok'; me: Me };

export default function App() {
  const [gate, setGate] = useState<Gate>({ state: 'loading' });
  const navigate = useNavigate();

  const check = async () => {
    if (!(await hasSession())) {
      setGate({ state: 'signed-out' });
      return;
    }
    try {
      const me = await api<Me>('/admin/me');
      setGate({ state: 'ok', me });
    } catch (e) {
      setGate(e instanceof ApiError && e.status === 403 ? { state: 'forbidden' } : { state: 'signed-out' });
    }
  };

  useEffect(() => {
    check();
  }, []);

  const signOut = async () => {
    await logout();
    setGate({ state: 'signed-out' });
    navigate('/');
  };

  if (!authConfigured) {
    return (
      <div className="login">
        <h1>Not configured</h1>
        <p className="muted">Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_USER_POOL_CLIENT_ID and rebuild.</p>
      </div>
    );
  }
  if (gate.state === 'loading') return <div className="login muted">Loading…</div>;
  if (gate.state === 'signed-out') return <Login onSignedIn={check} />;
  if (gate.state === 'forbidden') {
    return (
      <div className="login">
        <h1>No access</h1>
        <p className="muted">This account isn't a moderator or admin. Ask an admin to change your role.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  }

  const { me } = gate;
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Fwitter mod</div>
        <NavLink to="/reports">Reports</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/banned-words">Banned words</NavLink>
        <NavLink to="/audit">Audit log</NavLink>
        <div className="me">
          <b>{me.role === 'ADMIN' ? 'Admin' : 'Moderator'}</b>
          <button className="small" onClick={signOut} style={{ marginTop: 8 }}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/reports" replace />} />
          <Route path="/reports" element={<Reports me={me} />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail me={me} />} />
          <Route path="/banned-words" element={<BannedWords />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/reports" replace />} />
        </Routes>
      </main>
    </div>
  );
}
