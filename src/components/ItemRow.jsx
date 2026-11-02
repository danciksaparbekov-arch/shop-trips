import { useState } from 'react';
import { supabase, must } from '../lib/supabase';
import { money, lineTotal } from '../lib/money';

// Строка списка: название × штук, комментарий, цена; у автора — правка и удаление
export default function ItemRow({ item, canEdit, canRemove, hint, showPrice, onChange }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [note, setNote] = useState(item.note || '');
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      must(await supabase.from('items').update({ name: name.trim(), qty: Number(qty) || 1, note: note.trim() || null })
        .eq('id', item.id).select('id'));
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function remove() {
    if (!window.confirm(`Убрать «${item.name}» из списка?`)) return;
    try {
      const deleted = must(await supabase.from('items').delete().eq('id', item.id).select('id'));
      if (!deleted.length) throw new Error('Не удалось удалить: нет прав');
      onChange();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="row edit-row">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(e.target.value)} className="qty" />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Комментарий" />
          <button className="btn small">Сохранить</button>
          <button type="button" className="link" onClick={() => setEditing(false)}>отмена</button>
        </form>
        {error && <p className="err">{error}</p>}
      </li>
    );
  }

  const total = lineTotal(item);
  return (
    <li className={item.missing ? 'missing' : ''}>
      <span className="item-name">
        {item.name} <small>× {item.qty}</small>
        {item.note && <small className="muted"> — {item.note}</small>}
      </span>
      <span className="item-price">
        {item.missing && <em>не нашли</em>}
        {!item.missing && showPrice && (item.price != null ? money(total) : <em>без цены</em>)}
        {!item.missing && !showPrice && hint && <span className="muted small">≈ {money(hint.price * item.qty)}</span>}
      </span>
      {canEdit && <button className="link" title="Изменить" aria-label="Изменить" onClick={() => setEditing(true)}>✎</button>}
      {canRemove && <button className="link" title="Убрать" aria-label="Убрать" onClick={remove}>✕</button>}
      {error && <p className="err full">{error}</p>}
    </li>
  );
}
