import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, must } from '../lib/supabase';

// Открытие ссылки-приглашения: присоединяемся к походу и переходим в него
export default function Join() {
  const { token } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = must(await supabase.rpc('join_trip', { p_token: token }));
        if (alive) nav(`/t/${id}`, { replace: true });
      } catch (e) {
        if (alive) setError(e.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, [token, nav]);

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
