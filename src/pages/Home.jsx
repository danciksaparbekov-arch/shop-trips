import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { STATUS_LABEL } from '../lib/status';

const REFRESH_MS = 10000; // новые походы коллег появляются без перезагрузки

// Мои походы (RLS отдаёт только те, где я участник) + открытые походы коллег, куда можно зайти в один клик
export default function Home() {
  const { userId } = useAuth();
  const [trips, setTrips] = useState(null);
  const [others, setOthers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [mine, open] = await Promise.all([
      supabase
        .from('trips')
        .select('id, title, store, planned_for, status, owner_id, created_at, profiles!trips_owner_id_fkey(name)')
        .order('created_at', { ascending: false }),
      supabase.rpc('open_trips'),
    ]);
    setError(mine.error?.message || open.error?.message || '');
    setTrips(mine.data || []);
    setOthers((open.data || []).filter((t) => !t.joined));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!trips) return <div className="center">Загрузка…</div>;

  const active = trips.filter((t) => t.status !== 'closed');
  const closed = trips.filter((t) => t.status === 'closed');

  const details = (t, ownerName) =>
    `${[t.store, t.planned_for].filter(Boolean).join(' · ') || 'без подробностей'} · идёт ${t.owner_id === userId ? 'вы' : ownerName || '—'}`;

  const card = (t) => (
    <Link key={t.id} to={`/t/${t.id}`} className="card trip-card">
      <span className={`status ${t.status}`}>{STATUS_LABEL[t.status]}</span>
      <h3>{t.title}</h3>
      <p className="muted">{details(t, t.profiles?.name)}</p>
    </Link>
  );

  const otherCard = (t) => (
    <Link key={t.id} to={`/o/${t.id}`} className="card trip-card">
      <span className="status open">Собираем список</span>
      <h3>{t.title}</h3>
      <p className="muted">{details(t, t.owner_name)}</p>
    </Link>
  );

  return (
    <section className="narrow">
      <div className="head-row">
        <h2>Мои походы</h2>
        <Link to="/new" className="btn">+ Новый поход</Link>
      </div>
      {error && <p className="err">{error}</p>}

      {active.length === 0 && <p className="muted">У вас пока нет походов. Создайте свой или зайдите в поход коллеги ниже.</p>}
      {active.map(card)}

      {others.length > 0 && (
        <>
          <h2>Коллеги идут в магазин</h2>
          <p className="muted">Нажмите на поход, чтобы дописать, что вам нужно.</p>
          {others.map(otherCard)}
        </>
      )}

      {closed.length > 0 && (
        <details>
          <summary>Завершённые ({closed.length})</summary>
          {closed.map(card)}
        </details>
      )}
    </section>
  );
}
