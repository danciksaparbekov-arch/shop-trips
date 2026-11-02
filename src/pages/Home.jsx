import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { STATUS_LABEL } from '../lib/status';

// Список моих походов (RLS отдаёт только те, где я участник)
export default function Home() {
  const { userId } = useAuth();
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('trips')
      .select('id, title, store, planned_for, status, owner_id, created_at, profiles(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        setError(e?.message || '');
        setTrips(data || []);
      });
  }, []);

  if (!trips) return <div className="center">Загрузка…</div>;

  const active = trips.filter((t) => t.status !== 'closed');
  const closed = trips.filter((t) => t.status === 'closed');

  const card = (t) => (
    <Link key={t.id} to={`/t/${t.id}`} className="card trip-card">
      <span className={`status ${t.status}`}>{STATUS_LABEL[t.status]}</span>
      <h3>{t.title}</h3>
      <p className="muted">
        {[t.store, t.planned_for].filter(Boolean).join(' · ') || 'без подробностей'}
        {' · идёт '}{t.owner_id === userId ? 'вы' : t.profiles?.name || '—'}
      </p>
    </Link>
  );

  return (
    <section className="narrow">
      <div className="head-row">
        <h2>Мои походы</h2>
        <Link to="/new" className="btn">+ Новый поход</Link>
      </div>
      {error && <p className="err">{error}</p>}

      {active.length === 0 && (
        <p className="muted">
          Пока нет активных походов. Создайте свой или откройте ссылку, которую прислал коллега.
        </p>
      )}
      {active.map(card)}

      {closed.length > 0 && (
        <details>
          <summary>Завершённые ({closed.length})</summary>
          {closed.map(card)}
        </details>
      )}
    </section>
  );
}
