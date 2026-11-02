import { useState } from 'react';
import { supabase, must } from '../lib/supabase';
import { priceKey, money } from '../lib/money';

// Добавить свою позицию. Названия из справочника цен покупателя подсказываются, цена показывается как ориентир.
export default function AddItem({ tripId, hints, onChange }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const hint = hints[priceKey(name)];

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      must(await supabase.from('items').insert({
        trip_id: tripId,
        name: name.trim(),
        qty: Number(qty) || 1,
        note: note.trim() || null,
      }));
      setName(''); setQty(1); setNote('');
      onChange();
    } catch (err) {
      setError(err.message || String(err));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card add-item">
      <div className="row">
        <label className="grow">
          Что нужно
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required list="known-items" placeholder="Например, молоко" />
        </label>
        <label>
          Штук
          <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(e.target.value)} className="qty" />
        </label>
      </div>
      <datalist id="known-items">
        {Object.values(hints).map((h) => <option key={h.name} value={h.name} />)}
      </datalist>
      <label>
        Комментарий (необязательно)
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Марка, жирность, размер…" />
      </label>
      {hint && <p className="muted small">Ориентир по цене: ≈ {money(hint.price)} за штуку</p>}
      <button className="btn" disabled={busy || !name.trim()}>Добавить в список</button>
      {error && <p className="err">{error}</p>}
    </form>
  );
}
