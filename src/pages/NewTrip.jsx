import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, must } from '../lib/supabase';
import { copyToTrip } from '../lib/upload';
import { useAuth } from '../auth';

export default function NewTrip() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [useQr, setUseQr] = useState(true);
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
      if (useQr && profile.qr_path) {
        // QR прикладываем уже к созданному походу; не получилось — поход всё равно создан, QR можно прикрепить позже
        try {
          const path = await copyToTrip(id, profile.qr_path);
          must(await supabase.from('trips').update({ qr_path: path }).eq('id', id).select('id'));
        } catch (qrErr) {
          console.warn('QR не приложен', qrErr);
        }
      }
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
        {profile.qr_path ? (
          <label className="check">
            <input type="checkbox" checked={useQr} onChange={(e) => setUseQr(e.target.checked)} />
            Приложить сохранённый QR для оплаты
          </label>
        ) : (
          <p className="muted small">QR для оплаты можно сохранить в <Link to="/profile">профиле</Link> и прикладывать галочкой.</p>
        )}
        <button className="btn" disabled={busy || !title.trim()}>Создать и получить ссылку</button>
        {error && <p className="err">{error}</p>}
      </form>
    </section>
  );
}
