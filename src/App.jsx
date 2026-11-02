import { useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import NameForm from './components/NameForm';
import InstallButton from './components/InstallButton';
import Home from './pages/Home';
import NewTrip from './pages/NewTrip';
import Join from './pages/Join';
import Trip from './pages/Trip';

export default function App() {
  const { ready, error, profile, notice, anonymous, userId, reset, logout } = useAuth();
  const [renaming, setRenaming] = useState(false);

  if (!ready) return <div className="center">Загрузка…</div>;

  if (error) {
    return (
      <div className="card narrow center-card">
        <h2>Не удалось войти</h2>
        <p className="err">{error}</p>
        <button className="btn" onClick={reset}>Начать заново</button>
      </div>
    );
  }

  // вход по имени (адрес в строке сохраняется — после входа откроется нужный поход)
  if (!userId || !profile) {
    return (
      <div className="card narrow center-card">
        <h1>Сходим в магазин?</h1>
        <p className="muted">
          Как вас зовут? Имя увидят коллеги в общем списке. С другого устройства введите то же имя — и попадёте в тот же аккаунт.
        </p>
        <NameForm submitLabel="Войти" />
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🛒 Сходим в магазин?</Link>
        <span className="who">
          <InstallButton />
          {profile.name}
          {anonymous && <button className="link" onClick={() => setRenaming((r) => !r)}>сменить имя</button>}
          <button className="link" onClick={logout}>выйти</button>
        </span>
      </header>
      <main>
        {notice && <p className="warn card">{notice}</p>}
        {renaming && (
          <div className="card narrow">
            <NameForm initial={profile.name} submitLabel="Сохранить" onDone={() => setRenaming(false)} />
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewTrip />} />
          <Route path="/join/:token" element={<Join />} />
          <Route path="/t/:id" element={<Trip />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </>
  );
}
