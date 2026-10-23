import { FormEvent, useState } from 'react';
import { login } from '../auth';

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onSignedIn();
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login" onSubmit={submit}>
      <h1>Fwitter moderation</h1>
      <p className="muted">Sign in with your Fwitter account. You need the moderator or admin role.</p>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
