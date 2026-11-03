import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, must } from './lib/supabase';
import { credentialsFor } from './lib/identity';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const NO_CONFIRM_HINT = 'Вход по имени не настроен: в Supabase выключите Authentication → Sign In / Providers → Email → Confirm email.';
const NAME_TAKEN = 'Это имя уже занято другим аккаунтом';

const fetchProfile = async (userId) =>
  must(await supabase.from('profiles').select('id, name, qr_path').eq('id', userId).maybeSingle());

// Старые анонимные аккаунты превращаем в постоянные «по имени» — id и все данные сохраняются.
// Возвращает { notice } при неудаче и { dropped: true }, если пустой аккаунт заменён входом по имени.
async function upgradeAnonymous(userId, name) {
  const { email, password } = await credentialsFor(name);
  const { error } = await supabase.auth.updateUser({ email, password });
  if (!error) return {};
  if (!/already|registered|exists/i.test(error.message)) return { notice: error.message };

  // имя уже занято постоянным аккаунтом (например, ноутбук уже перешёл на вход по имени)
  const [m, i] = await Promise.all([
    supabase.from('trip_members').select('trip_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (!m.error && !i.error && !m.count && !i.count) {
    await supabase.auth.signOut(); // здесь ничего нет — просто входим по имени в существующий аккаунт
    return { dropped: true };
  }
  return { notice: `${NAME_TAKEN}, а в этом аккаунте уже есть походы. Смените имя (ссылка «сменить имя» вверху) — оно привяжется к этому аккаунту.` };
}

// Запускаем один раз на всё приложение (StrictMode иначе выполнил бы дважды)
let boot = null;
function bootstrap() {
  boot ||= (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { userId: null, profile: null, anonymous: false, notice: '' };
    const { user } = session;
    let profile = await fetchProfile(user.id);
    let notice = '';
    let anonymous = user.is_anonymous;
    if (anonymous && profile) {
      const r = await upgradeAnonymous(user.id, profile.name);
      if (r.dropped) return { userId: null, profile: null, anonymous: false, notice: '' };
      notice = r.notice || '';
      anonymous = !!r.notice; // удалось — аккаунт уже постоянный
    }
    return { userId: user.id, profile, anonymous, notice };
  })();
  return boot;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, userId: null, profile: null, anonymous: false, notice: '', error: '' });

  useEffect(() => {
    let alive = true;
    bootstrap()
      .then((s) => alive && setState({ ready: true, ...s, error: '' }))
      .catch((e) => alive && setState({ ready: true, userId: null, profile: null, anonymous: false, notice: '', error: e.message || String(e) }));
    return () => { alive = false; };
  }, []);

  // Вход по имени: есть такой аккаунт — входим, нет — создаём
  const login = useCallback(async (name) => {
    const clean = name.trim();
    const { email, password } = await credentialsFor(clean);
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (!/invalid login credentials/i.test(error.message)) throw error;
      ({ data, error } = await supabase.auth.signUp({ email, password }));
      if (error) throw error;
      if (!data.session) throw new Error(NO_CONFIRM_HINT);
    }
    const userId = data.user.id;
    let profile = await fetchProfile(userId);
    if (!profile) {
      must(await supabase.from('profiles').insert({ id: userId, name: clean }));
      profile = { id: userId, name: clean, qr_path: null };
    }
    setState({ ready: true, userId, profile, anonymous: false, notice: '', error: '' });
  }, []);

  // Только для старых анонимных аккаунтов: задать имя или сменить его (например, при конфликте имён).
  // У постоянного аккаунта имя — это логин, его не меняем (смена почты в Supabase шлёт письмо на скрытый адрес).
  const saveName = useCallback(async (name) => {
    const clean = name.trim();
    const q = state.profile
      ? supabase.from('profiles').update({ name: clean }).eq('id', state.userId)
      : supabase.from('profiles').insert({ id: state.userId, name: clean });
    must(await q);
    // после смены имени снова пробуем сделать аккаунт постоянным
    const r = await upgradeAnonymous(state.userId, clean);
    if (r.dropped) { window.location.reload(); return; }
    setState((s) => ({ ...s, profile: { ...s.profile, id: s.userId, name: clean }, anonymous: !!r.notice, notice: r.notice || '' }));
  }, [state.profile, state.userId]);

  // Обновить поля профиля в состоянии после записи в базу (например, qr_path)
  const patchProfile = useCallback((patch) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })), []);

  // Выйти (например, на чужом устройстве)
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.reload();
  }, []);

  return <Ctx.Provider value={{ ...state, login, saveName, patchProfile, logout, reset: logout }}>{children}</Ctx.Provider>;
}
