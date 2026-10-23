import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt } from '../api';
import type { UserRow } from '../types';
import { userStatus } from '../types';

export default function Users() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    setBusy(true);
    setError(null);
    try {
      setRows(await api(`/admin/users?q=${encodeURIComponent(query)}&limit=50`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    search('');
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    search(q);
  };

  return (
    <>
      <h1>Users</h1>
      <form className="toolbar" onSubmit={submit}>
        <input type="search" placeholder="Username, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" disabled={busy}>Search</button>
      </form>
      {error && <div className="error">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Age tier</th><th>Reports</th><th>Posts</th><th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="clickable" onClick={() => navigate(`/users/${u.id}`)}>
              <td><b>@{u.username}</b><br /><span className="muted">{u.display_name}</span></td>
              <td className="muted">{u.email}</td>
              <td><span className={`pill ${u.role}`}>{u.role}</span>{u.verified_at && <span className="pill verified">verified</span>}</td>
              <td><span className={`pill ${userStatus(u)}`}>{userStatus(u)}</span></td>
              <td className="muted">{u.age_tier}</td>
              <td>{u.reports_received}</td>
              <td>{u.posts}</td>
              <td className="dim">{fmt.when(u.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!busy && rows.length === 0 && <p className="muted">No users match.</p>}
    </>
  );
}
