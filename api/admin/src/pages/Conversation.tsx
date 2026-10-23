import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmt } from '../api';

type Payload = {
  participants: { id: string; username: string; display_name: string }[];
  messages: { id: string; sender_id: string; content: string; created_at: string }[];
};

// Full transcript of a reported conversation, oldest first.
export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Payload>(`/admin/conversations/${id}/messages`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error === 'conversation_not_reported' ? 'This conversation has not been reported, so it cannot be read.' : error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const name = (sid: string) => data.participants.find((p) => p.id === sid);
  return (
    <>
      <h1>Conversation</h1>
      <p className="muted">
        Between{' '}
        {data.participants.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ' and '}
            <Link to={`/users/${p.id}`}>@{p.username}</Link>
          </span>
        ))}
        . Take action from either profile.
      </p>
      {data.messages.length === 0 && <p className="muted">No messages.</p>}
      {data.messages.map((m) => (
        <div className="card" key={m.id}>
          <div className="dim">
            <b>@{name(m.sender_id)?.username ?? 'unknown'}</b> · {fmt.when(m.created_at)}
          </div>
          <div className="content">{m.content}</div>
        </div>
      ))}
    </>
  );
}
