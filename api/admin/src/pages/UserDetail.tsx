import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, askNote, fmt } from '../api';
import type { Me, Role, UserDetail as Detail } from '../types';
import { userStatus } from '../types';

type Target = { id: string; username: string; role: Role; suspended_until: string | null; banned_at: string | null };

// Warn / suspend / unsuspend / ban / unban / role, shared by the queue and the detail page.
export function UserActions({
  me, user, onDone, onError,
}: { me: Me; user: Target; onDone: () => void; onError: (m: string) => void }) {
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onDone();
    } catch (e: any) {
      onError(e.message);
    }
  };
  const status = userStatus(user);
  const canAct = me.id !== user.id && (me.role === 'ADMIN' || user.role === 'USER');
  if (!canAct) return <span className="dim">No actions available for this account.</span>;

  return (
    <>
      <button className="warn" onClick={() => { const n = window.prompt('Warning text the member will see'); if (n && n.trim()) run(() => api(`/admin/users/${user.id}/warn`, { method: 'POST', body: JSON.stringify({ note: n.trim() }) })); }}>Warn</button>
      {status === 'suspended' ? (
        <button onClick={() => run(() => api(`/admin/users/${user.id}/unsuspend`, { method: 'POST', body: '{}' }))}>Unsuspend</button>
      ) : status === 'active' ? (
        <button className="warn" onClick={() => { const d = Number(window.prompt('Suspend for how many days?', '3')); if (!Number.isInteger(d) || d < 1) return; const n = askNote('Note (optional)'); if (n !== null) run(() => api(`/admin/users/${user.id}/suspend`, { method: 'POST', body: JSON.stringify({ days: d, note: n }) })); }}>Suspend</button>
      ) : null}
      {me.role === 'ADMIN' && (status === 'banned' ? (
        <button onClick={() => run(() => api(`/admin/users/${user.id}/unban`, { method: 'POST', body: '{}' }))}>Unban</button>
      ) : (
        <button className="danger" onClick={() => { if (!confirm(`Ban @${user.username}? They lose access immediately.`)) return; const n = askNote('Note (optional)'); if (n !== null) run(() => api(`/admin/users/${user.id}/ban`, { method: 'POST', body: JSON.stringify({ note: n }) })); }}>Ban</button>
      ))}
      {me.role === 'ADMIN' && (
        <select value={user.role} onChange={(e) => run(() => api(`/admin/users/${user.id}/role`, { method: 'POST', body: JSON.stringify({ role: e.target.value }) }))}>
          <option value="USER">USER</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      )}
    </>
  );
}

export default function UserDetail({ me }: { me: Me }) {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setUser(await api(`/admin/users/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const postAction = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!user) return <p className="muted">{error ?? 'Loading…'}</p>;
  const status = userStatus(user);

  return (
    <>
      <h1>@{user.username}</h1>
      <div className="card">
        <div className="head">
          <div>
            <span className={`pill ${user.role}`}>{user.role}</span>
            <span className={`pill ${status}`}>{status}</span>
            <span className="pill">{user.age_tier}</span>
            <b>{user.display_name}</b> <span className="muted">· {user.email}</span>
            <div className="dim">
              Joined {fmt.when(user.created_at)} · DOB {user.date_of_birth.slice(0, 10)}
              {user.suspended_until && status === 'suspended' && <> · suspended until {fmt.when(user.suspended_until)}</>}
              {user.banned_at && <> · banned {fmt.when(user.banned_at)}</>}
            </div>
            {user.bio && <div className="content">{user.bio}</div>}
          </div>
        </div>
        <div className="actions">
          <UserActions me={me} user={user} onDone={load} onError={setError} />
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="two-col">
        <div>
          <h2>Recent posts</h2>
          {user.posts.length === 0 && <p className="muted">None.</p>}
          {user.posts.map((p) => (
            <div className="card" key={p.id}>
              <div className="dim">
                {fmt.ago(p.created_at)} ago · {p.report_count} reports
                {p.hidden_at && <span className="pill hidden"> hidden ({p.hidden_reason})</span>}
              </div>
              <div className="content">{p.content || <i className="muted">(repost)</i>}</div>
              <div className="actions">
                {p.hidden_at ? (
                  <button className="small" onClick={() => postAction(() => api(`/admin/posts/${p.id}/restore`, { method: 'POST', body: '{}' }))}>Restore</button>
                ) : (
                  <button className="small warn" onClick={() => { const n = askNote('Note (optional)'); if (n !== null) postAction(() => api(`/admin/posts/${p.id}/hide`, { method: 'POST', body: JSON.stringify({ note: n }) })); }}>Hide</button>
                )}
                <button className="small danger" onClick={() => { if (!confirm('Delete this post permanently?')) return; const n = askNote('Note (optional)'); if (n !== null) postAction(() => api(`/admin/posts/${p.id}`, { method: 'DELETE', body: JSON.stringify({ note: n }) })); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h2>Reports received</h2>
          {user.reports_received.length === 0 && <p className="muted">None.</p>}
          {user.reports_received.map((r) => (
            <div className="card" key={r.id}>
              <b>{r.reason.toLowerCase().replace('_', ' ')}</b> by @{r.reporter.username} <span className="pill">{r.status.toLowerCase()}</span>
              <div className="dim">{fmt.when(r.created_at)}</div>
              {r.details && <div className="content">{r.details}</div>}
            </div>
          ))}
          <h2>Moderation history</h2>
          {user.moderation_received.length === 0 && <p className="muted">None.</p>}
          {user.moderation_received.map((a) => (
            <div className="card" key={a.id}>
              <b>{a.action.toLowerCase().replace(/_/g, ' ')}</b> by @{a.actor?.username ?? 'deleted'}
              <div className="dim">{fmt.when(a.created_at)}</div>
              {a.note && <div className="content">{a.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
