import { useState } from 'react';
import { useAuth } from '../auth';

// Ввод имени: первый заход и переименование
export default function NameForm({ initial = '', submitLabel, onDone }) {
  const { saveName } = useAuth();
  const [name, setName] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await saveName(name);
      onDone?.();
    } catch (err) {
      setError(err.message || String(err));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="row">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Например, Айдана"
        maxLength={40}
        required
        autoFocus
      />
      <button className="btn" disabled={busy || !name.trim()}>{submitLabel}</button>
      {error && <p className="err full">{error}</p>}
    </form>
  );
}
