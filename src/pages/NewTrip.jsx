import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, must } from '../lib/supabase';

export default function NewTrip() {
  const nav = useNavigate();
  const [title, setTitle] = useState('Поход в магазин');
  const [store, setStore] = useState('');
  const [planned, setPlanned] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const id = must(await supabase.rpc('create_trip', { p_title: title, p_store: store, p_planned: planned }));
      nav(`/t/${id}`, { replace: true });
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  return (
    <section className="narrow">
      <h2>Новый поход в магазин</h2>
      <form onSubmit={submit} className="form card">
        <label>
          Название
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        </label>
        <label>
          Магазин (необязательно)
          <input value={store} onChange={(e) => setStore(e.target.value)} maxLength={60} placeholder="Например, Народный" />
        </label>
        <label>
          Когда идёте (необязательно)
          <input value={planned} onChange={(e) => setPlanned(e.target.value)} maxLength={60} placeholder="Например, сегодня в 13:00" />
        </label>
        <button className="btn" disabled={busy || !title.trim()}>Создать и получить ссылку</button>
        {error && <p className="err">{error}</p>}
      </form>
    </section>
  );
}
