import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, must } from '../lib/supabase';
import { prepareImage, uploadTripFile, removeFiles } from '../lib/upload';
import { useAuth } from '../auth';
import SignedImage from '../components/SignedImage';

// Профиль: сохранённый QR для оплаты — подставляется в новые походы по галочке
export default function Profile() {
  const { userId, profile, patchProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(qr_path) {
    must(await supabase.from('profiles').update({ qr_path }).eq('id', userId));
    patchProfile({ qr_path });
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setBusy(true);
    let path;
    try {
      const ready = await prepareImage(file);
      path = await uploadTripFile(userId, ready); // личная папка «<user_id>/»
      const old = profile.qr_path;
      await save(path);
      await removeFiles([old]);
    } catch (err) {
      await removeFiles([path]);
      setError(err.message || String(err));
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm('Удалить сохранённый QR? В уже созданных походах он останется.')) return;
    setError(''); setBusy(true);
    try {
      const old = profile.qr_path;
      await save(null);
      await removeFiles([old]);
    } catch (err) {
      setError(err.message || String(err));
    }
    setBusy(false);
  }

  return (
    <section className="narrow">
      <Link to="/" className="back">← Мои походы</Link>
      <h2>Профиль</h2>
      <div className="card">
        <h3>QR для оплаты</h3>
        <p className="muted small">
          Сохраните QR, куда вам переводить деньги, — при создании похода его можно приложить одной галочкой.
          Видят его только участники ваших походов.
        </p>
        {profile.qr_path && <SignedImage path={profile.qr_path} alt="сохранённый QR" className="qr" />}
        <div className="actions">
          <label className="btn ghost file-btn">
            {profile.qr_path ? 'Заменить QR' : 'Загрузить QR'}
            <input type="file" accept="image/*" onChange={pick} disabled={busy} hidden />
          </label>
          {profile.qr_path && <button className="btn danger" onClick={remove} disabled={busy}>Удалить</button>}
        </div>
        {busy && <p className="muted small">Сохраняем…</p>}
        {error && <p className="err">{error}</p>}
      </div>
    </section>
  );
}
