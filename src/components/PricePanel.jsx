import { useState } from 'react';
import { supabase, must } from '../lib/supabase';
import { prepareImage, uploadTripFile, removeFiles } from '../lib/upload';
import { money, parsePrice, priceKey, totalsByUser, round2 } from '../lib/money';
import { useAuth } from '../auth';
import SignedImage from './SignedImage';

// Панель покупателя: цены за штуку, «не нашли», итог по чеку, фото чека и QR, запомнить цены.
// В полях хранится только то, что человек менял; остальное берётся из позиции или справочника.
export default function PricePanel({ trip, items, hints, onChange }) {
  const { userId } = useAuth();
  const [priceText, setPriceText] = useState({});   // { id позиции: строка }
  const [missing, setMissing] = useState({});       // { id позиции: bool }
  const [totalText, setTotalText] = useState(trip.receipt_total != null ? String(trip.receipt_total) : '');
  const [receiptFile, setReceiptFile] = useState(null);
  const [qrFile, setQrFile] = useState(null);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // текущее значение поля: правка → цена в базе → цена из справочника
  const shownPrice = (i) => priceText[i.id] ?? (i.price != null ? String(i.price) : (hints[priceKey(i.name)]?.price != null ? String(hints[priceKey(i.name)].price) : ''));
  const isPrefilled = (i) => priceText[i.id] === undefined && i.price == null && hints[priceKey(i.name)] != null;
  const isMissing = (i) => missing[i.id] ?? i.missing;

  async function pickFile(e, setter) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      setter(await prepareImage(file));
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function save() {
    setError(''); setSaved(false);
    const uploaded = [];
    setBusy(true);
    try {
      // 1. проверяем всё до записи
      const rows = items.map((i) => {
        const text = shownPrice(i);
        const price = parsePrice(text);
        if (text.trim() !== '' && price === null) throw new Error(`Цена «${i.name}»: введите число`);
        return { item: i, price, missing: isMissing(i) };
      });
      let receiptTotal = null;
      if (totalText.trim() !== '') {
        receiptTotal = parsePrice(totalText);
        if (receiptTotal === null) throw new Error('Итог по чеку: введите число');
      }

      // 2. файлы
      const patch = { receipt_total: receiptTotal };
      if (receiptFile) { const p = await uploadTripFile(trip.id, receiptFile); uploaded.push(p); patch.receipt_path = p; }
      if (qrFile) { const p = await uploadTripFile(trip.id, qrFile); uploaded.push(p); patch.qr_path = p; }

      // 3. цены позиций (только изменившиеся)
      const changed = rows.filter((r) => r.price !== r.item.price || r.missing !== r.item.missing);
      await Promise.all(changed.map(async (r) => {
        const done = must(await supabase.from('items').update({ price: r.price, missing: r.missing }).eq('id', r.item.id).select('id'));
        if (!done.length) throw new Error('Не удалось сохранить цены: нет прав');
      }));

      // 4. запись о походе; старые файлы удаляем только после успеха
      const done = must(await supabase.from('trips').update(patch).eq('id', trip.id).select('id'));
      if (!done.length) throw new Error('Не удалось сохранить: нет прав');
      await removeFiles([receiptFile && trip.receipt_path, qrFile && trip.qr_path]);

      // 5. справочник цен: одна запись на название (при повторе побеждает последняя)
      if (remember) {
        const byKey = new Map();
        rows.filter((r) => r.price !== null && !r.missing).forEach((r) => {
          byKey.set(priceKey(r.item.name), { user_id: userId, key: priceKey(r.item.name), name: r.item.name.trim(), price: r.price, updated_at: new Date().toISOString() });
        });
        if (byKey.size) must(await supabase.from('product_prices').upsert([...byKey.values()], { onConflict: 'user_id,key' }));
      }

      setReceiptFile(null); setQrFile(null); setSaved(true);
      onChange();
    } catch (err) {
      await removeFiles(uploaded);
      setError(err.message || String(err));
    }
    setBusy(false);
  }

  // итог по позициям на экране — для сверки с чеком
  const liveSum = round2(Object.values(totalsByUser(items.map((i) => ({
    ...i, price: parsePrice(shownPrice(i)), missing: isMissing(i),
  })))).reduce((a, b) => a + b, 0));

  return (
    <div className="card price-panel">
      <h3>Цены и чек</h3>
      <p className="muted small">Впишите цену за одну штуку. Серые цены подставлены из справочника — проверьте их.</p>

      <ul className="items price-list">
        {items.map((i) => (
          <li key={i.id} className={isMissing(i) ? 'missing' : ''}>
            <span className="item-name">
              {i.name} <small>× {i.qty}</small>
              <small className="muted"> · {i.profiles?.name}</small>
            </span>
            <input
              className={`price-input${isPrefilled(i) ? ' prefilled' : ''}`}
              inputMode="decimal"
              placeholder="цена"
              disabled={isMissing(i)}
              value={shownPrice(i)}
              onChange={(e) => setPriceText({ ...priceText, [i.id]: e.target.value })}
              aria-label={`Цена: ${i.name}`}
            />
            <label className="check">
              <input type="checkbox" checked={isMissing(i)} onChange={(e) => setMissing({ ...missing, [i.id]: e.target.checked })} />
              не нашли
            </label>
          </li>
        ))}
      </ul>
      <p><b>Сумма по позициям: {money(liveSum)}</b></p>

      <label>
        Итог по чеку, {`сом`} (необязательно, для сверки)
        <input inputMode="decimal" value={totalText} onChange={(e) => setTotalText(e.target.value)} className="price-input wide" />
      </label>

      <div className="files">
        <div>
          <b>Чек</b>
          {trip.receipt_path && !receiptFile && <SignedImage path={trip.receipt_path} alt="чек" className="thumb" />}
          {receiptFile && <p className="ok small">Выбрано новое фото</p>}
          <label className="btn ghost file-btn">
            {trip.receipt_path || receiptFile ? 'Заменить фото чека' : 'Прикрепить фото чека'}
            <input type="file" accept="image/*" onChange={(e) => pickFile(e, setReceiptFile)} hidden />
          </label>
        </div>
        <div>
          <b>QR для оплаты</b>
          {trip.qr_path && !qrFile && <SignedImage path={trip.qr_path} alt="QR" className="thumb" />}
          {qrFile && <p className="ok small">Выбрано новое фото</p>}
          <label className="btn ghost file-btn">
            {trip.qr_path || qrFile ? 'Заменить QR' : 'Прикрепить QR'}
            <input type="file" accept="image/*" onChange={(e) => pickFile(e, setQrFile)} hidden />
          </label>
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Запомнить цены позиций для следующих походов
      </label>

      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
      {saved && <span className="ok"> Сохранено</span>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
