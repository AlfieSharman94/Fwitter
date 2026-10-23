import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

export default function BannedWords() {
  const [words, setWords] = useState<{ word: string; created_at: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setWords(await api('/admin/banned-words'));
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/admin/banned-words', { method: 'POST', body: JSON.stringify({ word: draft.trim() }) });
      setDraft('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (word: string) => {
    if (!confirm(`Remove “${word}” from the list?`)) return;
    try {
      await api(`/admin/banned-words/${encodeURIComponent(word)}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <h1>Banned words</h1>
      <p className="muted">Matched as whole words, case-insensitive, in posts, usernames, display names and bios. A match blocks the submit with a message to the member. Changes apply within a minute.</p>
      <form className="toolbar" onSubmit={add}>
        <input type="search" placeholder="Add a word or phrase" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="primary" disabled={!draft.trim()}>Add</button>
      </form>
      {error && <div className="error">{error}</div>}
      <table>
        <tbody>
          {words.map((w) => (
            <tr key={w.word}>
              <td><b>{w.word}</b></td>
              <td style={{ width: 90, textAlign: 'right' }}><button className="small danger" onClick={() => remove(w.word)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {words.length === 0 && <p className="muted">The list is empty.</p>}
    </>
  );
}
