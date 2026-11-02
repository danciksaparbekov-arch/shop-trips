import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, must } from './lib/supabase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// Анонимный вход: у каждого браузера свой скрытый id, регистрации нет.
// Запускаем один раз на всё приложение (StrictMode иначе создал бы двух пользователей).
let boot = null;
function bootstrap() {
  boot ||= (async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    const profile = must(await supabase.from('profiles').select('id, name').eq('id', session.user.id).maybeSingle());
    return { userId: session.user.id, profile };
  })();
  return boot;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, userId: null, profile: null, error: '' });

  useEffect(() => {
    let alive = true;
    bootstrap()
      .then((s) => alive && setState({ ready: true, ...s, error: '' }))
      .catch((e) => alive && setState({ ready: true, userId: null, profile: null, error: e.message || String(e) }));
    return () => { alive = false; };
  }, []);

  // первое сохранение имени создаёт профиль, дальше — переименование
  const saveName = useCallback(async (name) => {
    const clean = name.trim();
    const q = state.profile
      ? supabase.from('profiles').update({ name: clean }).eq('id', state.userId)
      : supabase.from('profiles').insert({ id: state.userId, name: clean });
    must(await q);
    setState((s) => ({ ...s, profile: { id: s.userId, name: clean } }));
  }, [state.profile, state.userId]);

  // «Начать заново»: новая анонимная учётная запись (старые походы станут недоступны на этом устройстве)
  const reset = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.reload();
  }, []);

  return <Ctx.Provider value={{ ...state, saveName, reset }}>{children}</Ctx.Provider>;
}
