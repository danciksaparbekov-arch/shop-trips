import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, must } from '../lib/supabase';
import { removeFiles } from '../lib/upload';
import { priceKey } from '../lib/money';
import { useAuth } from '../auth';
import { STATUS_LABEL } from '../lib/status';
import ShareLink from '../components/ShareLink';
import AddItem from '../components/AddItem';
import ItemRow from '../components/ItemRow';
import PricePanel from '../components/PricePanel';
import Settlement from '../components/Settlement';

const REFRESH_MS = 10000; // другие люди дописывают список — подтягиваем без перезагрузки

export default function Trip() {
  const { id } = useParams();
  const { userId } = useAuth();
  const nav = useNavigate();
  const [trip, setTrip] = useState(undefined); // undefined — грузим, null — нет доступа
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [hints, setHints] = useState({}); // справочник цен покупателя: { ключ: { name, price } }
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [t, m, it] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).maybeSingle(),
      supabase.from('trip_members').select('user_id, paid, joined_at, profiles(name)').eq('trip_id', id).order('joined_at'),
      supabase.from('items').select('*, profiles(name)').eq('trip_id', id).order('created_at'),
    ]);
    setError(t.error?.message || m.error?.message || it.error?.message || '');
    setTrip(t.data || null);
    setMembers(m.data || []);
    setItems(it.data || []);
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const ownerId = trip?.owner_id;
  const loadHints = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase.from('product_prices').select('key, name, price').eq('user_id', ownerId);
    setHints(Object.fromEntries((data || []).map((p) => [p.key, p])));
  }, [ownerId]);
  useEffect(() => { loadHints(); }, [loadHints]);

  // позиции по людям: мои — первыми
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      if (!map.has(i.user_id)) map.set(i.user_id, { userId: i.user_id, name: i.profiles?.name || '—', list: [] });
      map.get(i.user_id).list.push(i);
    });
    return [...map.values()].sort((a, b) => (b.userId === userId) - (a.userId === userId));
  }, [items, userId]);

  if (trip === undefined) return <div className="center">Загрузка…</div>;
  if (trip === null) {
    return (
      <div className="card narrow center-card">
        <p>Поход не найден или у вас нет доступа. Откройте ссылку-приглашение от коллеги.</p>
        {error && <p className="err">{error}</p>}
        <Link to="/" className="btn">К моим походам</Link>
      </div>
    );
  }

  const isOwner = trip.owner_id === userId;
  const ownerName = members.find((m) => m.user_id === trip.owner_id)?.profiles?.name || '—';

  async function setStatus(status, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      must(await supabase.from('trips').update({ status }).eq('id', trip.id).select('id'));
      load();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function removeTrip() {
    if (!window.confirm(`Удалить поход «${trip.title}» вместе со списком, чеком и QR?`)) return;
    try {
      // сначала запись, потом файлы: при отказе в правах файлы остаются на месте
      const deleted = must(await supabase.from('trips').delete().eq('id', trip.id).select('id'));
      if (!deleted.length) throw new Error('Не удалось удалить: нет прав');
      await removeFiles([trip.receipt_path, trip.qr_path]);
      nav('/', { replace: true });
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  return (
    <section className="trip">
      <Link to="/" className="back">← Мои походы</Link>
      <div className="head-row">
        <h2>{trip.title}</h2>
        <span className={`status ${trip.status}`}>{STATUS_LABEL[trip.status]}</span>
      </div>
      <p className="muted">
        {[trip.store, trip.planned_for].filter(Boolean).join(' · ')}
        {(trip.store || trip.planned_for) && ' · '}идёт {isOwner ? 'вы' : ownerName}
      </p>
      {error && <p className="err">{error}</p>}

      <ShareLink token={trip.token} title={trip.title} />

      <p className="members muted">
        Участники:{' '}
        {members.map((m) => (
          <span key={m.user_id} className="chip">{m.profiles?.name || '—'}</span>
        ))}
      </p>

      <h3>Список</h3>
      {trip.status === 'open' && <AddItem tripId={trip.id} hints={hints} onChange={load} />}
      {groups.length === 0 && <p className="muted">Пока пусто. Допишите, что нужно.</p>}
      {groups.map((g) => (
        <div key={g.userId} className="card group">
          <h4>{g.userId === userId ? 'Моё' : g.name}</h4>
          <ul className="items">
            {g.list.map((i) => (
              <ItemRow
                key={i.id}
                item={i}
                canEdit={trip.status === 'open' && (i.user_id === userId)}
                canRemove={trip.status === 'open' ? (i.user_id === userId || isOwner) : false}
                hint={hints[priceKey(i.name)]}
                showPrice={trip.status !== 'open'}
                onChange={load}
              />
            ))}
          </ul>
        </div>
      ))}

      {isOwner && trip.status === 'open' && (
        <div className="actions">
          <button className="btn" onClick={() => setStatus('bought', 'Закрыть приём позиций и перейти к ценам и чеку?')}>
            Купил — внести цены и чек
          </button>
        </div>
      )}

      {isOwner && trip.status === 'bought' && (
        <PricePanel trip={trip} items={items} hints={hints} onChange={() => { load(); loadHints(); }} />
      )}

      {trip.status !== 'open' && (
        <Settlement trip={trip} members={members} items={items} userId={userId} isOwner={isOwner} onChange={load} />
      )}

      {isOwner && (
        <div className="actions owner-actions">
          {trip.status === 'bought' && (
            <>
              <button className="btn" onClick={() => setStatus('closed', 'Завершить поход? Он уйдёт в «Завершённые».')}>Завершить поход</button>
              <button className="btn ghost" onClick={() => setStatus('open', 'Вернуться к списку? Люди снова смогут дописывать позиции.')}>Вернуть к списку</button>
            </>
          )}
          {trip.status === 'closed' && (
            <button className="btn ghost" onClick={() => setStatus('bought')}>Вернуть в работу</button>
          )}
          <button className="btn danger" onClick={removeTrip}>Удалить поход</button>
        </div>
      )}
    </section>
  );
}
