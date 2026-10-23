import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, askNote, fmt } from '../api';
import type { Me, ReportRow } from '../types';
import { userStatus } from '../types';
import { UserActions } from './UserDetail';
import { Media } from '../Media';

type Status = 'OPEN' | 'RESOLVED' | 'DISMISSED' | 'ALL';
type Group = { key: string; post: ReportRow['post']; user: ReportRow['user']; reports: ReportRow[] };

// Reports are shown per target: one card per post or user, with everyone who reported it.
function group(rows: ReportRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = r.post ? `post:${r.post.id}` : `user:${r.user?.id}`;
    const g = map.get(key) ?? { key, post: r.post, user: r.user, reports: [] };
    g.reports.push(r);
    map.set(key, g);
  }
  return [...map.values()];
}

export default function Reports({ me }: { me: Me }) {
  const [status, setStatus] = useState<Status>('OPEN');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ openReports: number; hiddenPosts: number; suspended: number; banned: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next?: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const q = `/admin/reports?status=${status}&limit=50${next ? `&cursor=${encodeURIComponent(next)}` : ''}`;
        const [data, s] = await Promise.all([api(q), api('/admin/summary')]);
        setRows((prev) => (next ? [...prev, ...data.reports] : data.reports));
        setCursor(data.nextCursor);
        setSummary(s);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    [status],
  );

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const groups = group(rows);

  return (
    <>
      <h1>Reports</h1>
      {summary && (
        <div className="stats">
          <div className="stat"><b>{summary.openReports}</b><span>open reports</span></div>
          <div className="stat"><b>{summary.hiddenPosts}</b><span>hidden posts</span></div>
          <div className="stat"><b>{summary.suspended}</b><span>suspended</span></div>
          <div className="stat"><b>{summary.banned}</b><span>banned</span></div>
        </div>
      )}
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
          <option value="ALL">All</option>
        </select>
        <button onClick={() => load()} disabled={busy}>Refresh</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!busy && groups.length === 0 && <p className="muted">Nothing here.</p>}

      <div className="reports-list">
        {groups.map((g) => (
          <div className="card" key={g.key}>
            {g.post ? (
              <>
                <div className="head">
                  <div>
                    <span className="pill">post</span>
                    {g.post.hidden_at && <span className="pill hidden">hidden ({g.post.hidden_reason})</span>}
                    <Link to={`/users/${g.post.users.id}`}>@{g.post.users.username}</Link>
                    <span className="dim"> · {fmt.ago(g.post.created_at)} ago · {g.post.report_count} reports total</span>
                  </div>
                </div>
                <div className="content">{g.post.content}</div>
                <Media media={g.post.media} />
                <Reporters reports={g.reports} />
                {g.reports.some((r) => r.status === 'OPEN') && (
                  <div className="actions">
                    {g.post.hidden_at ? (
                      <button onClick={() => act(() => api(`/admin/posts/${g.post!.id}/restore`, { method: 'POST', body: '{}' }))}>Restore</button>
                    ) : (
                      <button className="warn" onClick={() => { const n = askNote('Note (optional)'); if (n !== null) act(() => api(`/admin/posts/${g.post!.id}/hide`, { method: 'POST', body: JSON.stringify({ note: n }) })); }}>Hide</button>
                    )}
                    <button className="danger" onClick={() => { if (!confirm('Delete this post permanently?')) return; const n = askNote('Note (optional)'); if (n !== null) act(() => api(`/admin/posts/${g.post!.id}`, { method: 'DELETE', body: JSON.stringify({ note: n }) })); }}>Delete</button>
                    <button onClick={() => { const n = askNote('Why no action? (optional)'); if (n !== null) act(() => api(`/admin/reports/${g.reports[0].id}/dismiss`, { method: 'POST', body: JSON.stringify({ note: n }) })); }}>Dismiss</button>
                  </div>
                )}
              </>
            ) : g.user ? (
              <>
                <div className="head">
                  <div>
                    <span className="pill">user</span>
                    <span className={`pill ${userStatus(g.user)}`}>{userStatus(g.user)}</span>
                    {g.user.role !== 'USER' && <span className={`pill ${g.user.role}`}>{g.user.role}</span>}
                    <Link to={`/users/${g.user.id}`}>@{g.user.username}</Link> <span className="muted">{g.user.display_name}</span>
                  </div>
                </div>
                <Reporters reports={g.reports} />
                {g.reports.some((r) => r.status === 'OPEN') && (
                  <div className="actions">
                    <UserActions me={me} user={g.user} onDone={() => load()} onError={setError} />
                    <button onClick={() => { const n = askNote('Why no action? (optional)'); if (n !== null) act(() => api(`/admin/reports/${g.reports[0].id}/dismiss`, { method: 'POST', body: JSON.stringify({ note: n }) })); }}>Dismiss</button>
                  </div>
                )}
              </>
            ) : (
              <span className="muted">Target no longer exists.</span>
            )}
          </div>
        ))}
      </div>
      {cursor && <button onClick={() => load(cursor)} disabled={busy}>Load more</button>}
    </>
  );
}

function Reporters({ reports }: { reports: ReportRow[] }) {
  return (
    <div className="reporters">
      {reports.map((r) => (
        <div key={r.id}>
          <b>{r.reason.toLowerCase().replace('_', ' ')}</b> by @{r.reporter.username} · {fmt.ago(r.created_at)} ago
          {r.status !== 'OPEN' && <span className="pill">{r.status.toLowerCase()}</span>}
          {r.details && <span className="muted"> · “{r.details}”</span>}
        </div>
      ))}
    </div>
  );
}
