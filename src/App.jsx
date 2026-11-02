import { useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import NameForm from './components/NameForm';
import Home from './pages/Home';
import NewTrip from './pages/NewTrip';
import Join from './pages/Join';
import Trip from './pages/Trip';

export default function App() {
  const { ready, error, profile, reset } = useAuth();
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

  // первый заход: сначала имя (адрес в строке сохраняется — после имени откроется нужный поход)
  if (!profile) {
    return (
      <div className="card narrow center-card">
        <h1>Сходим в магазин?</h1>
        <p className="muted">Как вас зовут? Имя увидят коллеги в общем списке.</p>
        <NameForm submitLabel="Продолжить" />
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🛒 Сходим в магазин?</Link>
        <span className="who">
          {profile.name}
          <button className="link" onClick={() => setRenaming((r) => !r)}>сменить имя</button>
        </span>
      </header>
      <main>
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
