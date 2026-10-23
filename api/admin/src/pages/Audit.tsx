import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmt } from '../api';
import type { ActionRow } from '../types';

export default function Audit() {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (next?: string | null) => {
    try {
      const data = await api(`/admin/actions?limit=50${next ? `&cursor=${encodeURIComponent(next)}` : ''}`);
      setRows((prev) => (next ? [...prev, ...data.actions] : data.actions));
      setCursor(data.nextCursor);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <h1>Audit log</h1>
      {error && <div className="error">{error}</div>}
      <table>
        <thead>
          <tr><th>When</th><th>By</th><th>Action</th><th>Target</th><th>Note</th></tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="dim">{fmt.when(a.created_at)}</td>
              <td>@{a.actor?.username ?? 'deleted'}</td>
              <td><b>{a.action.toLowerCase().replace(/_/g, ' ')}</b></td>
              <td>
                {a.target_user && <Link to={`/users/${a.target_user.id}`}>@{a.target_user.username}</Link>}
                {a.post_snapshot && <div className="dim">“{a.post_snapshot.slice(0, 120)}{a.post_snapshot.length > 120 ? '…' : ''}”</div>}
              </td>
              <td className="muted">{a.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cursor && <button onClick={() => load(cursor)}>Load more</button>}
    </>
  );
}
