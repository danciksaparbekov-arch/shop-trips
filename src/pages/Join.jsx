import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, must } from '../lib/supabase';

// Присоединение к походу: по ссылке-приглашению (token) или из списка открытых походов (id)
export default function Join() {
  const { token, id: openId } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = must(await (openId
          ? supabase.rpc('join_open_trip', { p_id: openId })
          : supabase.rpc('join_trip', { p_token: token })));
        if (alive) nav(`/t/${id}`, { replace: true });
      } catch (e) {
        if (alive) setError(e.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, [token, openId, nav]);

  if (error) {
    return (
      <div className="card narrow center-card">
        <p className="err">{error}</p>
        <Link to="/" className="btn">К моим походам</Link>
      </div>
    );
  }
  return <div className="center">Открываем поход…</div>;
}
