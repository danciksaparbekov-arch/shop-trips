import { useState } from 'react';
import { supabase, must } from '../lib/supabase';
import { money, totalsByUser, round2 } from '../lib/money';
import SignedImage from './SignedImage';

// Расчёт: кто сколько должен покупателю. Покупатель отмечает «оплатил», остальные видят свою сумму и QR.
export default function Settlement({ trip, members, items, userId, isOwner, onChange }) {
  const [error, setError] = useState('');
  const sums = totalsByUser(items);
  const grand = round2(Object.values(sums).reduce((a, b) => a + b, 0));
  const unpriced = items.filter((i) => !i.missing && i.price == null).length;
  const debtors = members.filter((m) => m.user_id !== trip.owner_id && (sums[m.user_id] || 0) > 0);
  const owedLeft = round2(debtors.filter((m) => !m.paid).reduce((a, m) => a + sums[m.user_id], 0));
  const me = members.find((m) => m.user_id === userId);
  const ownerName = members.find((m) => m.user_id === trip.owner_id)?.profiles?.name || 'покупателю';
  const mySum = sums[userId] || 0;
  const myItems = items.filter((i) => i.user_id === userId);
  const myUnpriced = myItems.filter((i) => !i.missing && i.price == null).length;

  async function togglePaid(m) {
    setError('');
    try {
      const done = must(await supabase.from('trip_members').update({ paid: !m.paid })
        .eq('trip_id', trip.id).eq('user_id', m.user_id).select('user_id'));
      if (!done.length) throw new Error('Не удалось отметить: нет прав');
      onChange();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  return (
    <div className="card settlement">
      <h3>Расчёт</h3>

      {unpriced > 0 && (
        <p className="warn">Для {unpriced} поз. ещё не указана цена — итоговые суммы могут измениться.</p>
      )}

      {/* что платить мне */}
      {!isOwner && me && (
        <div className="my-pay">
          {mySum > 0 && me.paid && <p className="ok"><b>Оплачено: {money(mySum)}</b></p>}
          {!me.paid && (
            <>
              {mySum > 0
                ? <p className="pay-sum">Вам нужно перевести {ownerName}: <b>{money(mySum)}</b></p>
                : <p className="muted">
                    {myItems.length === 0
                      ? 'У вас нет позиций в этом походе.'
                      : myUnpriced > 0
                        ? `${ownerName} ещё не указал(а) цены ваших позиций — сумма появится после этого.`
                        : 'По вашим позициям нет суммы к оплате.'}
                  </p>}
            </>
          )}
        </div>
      )}

      {/* QR виден всем участникам похода, в том числе после завершения */}
      <div className="qr-pay">
        <b>QR для оплаты</b>
        {trip.qr_path
          ? <SignedImage path={trip.qr_path} alt="QR для оплаты" className="qr" />
          : <p className="muted small">
              {isOwner
                ? 'QR не прикреплён. Нажмите «Вернуть в работу» и прикрепите его в блоке «Цены и чек».'
                : `${ownerName} пока не прикрепил(а) QR.`}
            </p>}
      </div>

      <ul className="debts">
        {members.map((m) => {
          const s = sums[m.user_id] || 0;
          const own = m.user_id === trip.owner_id;
          return (
            <li key={m.user_id}>
              <span>{m.profiles?.name || '—'}{own && <small className="muted"> (купил)</small>}</span>
              <span>{money(s)}</span>
              {!own && s > 0 && (
                isOwner
                  ? <button className={m.paid ? 'btn small ghost' : 'btn small'} onClick={() => togglePaid(m)}>
                      {m.paid ? '✓ Оплатил (отменить)' : 'Отметить оплату'}
                    </button>
                  : <span className={m.paid ? 'ok' : 'muted'}>{m.paid ? '✓ оплачено' : 'ждёт оплаты'}</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="totals">
        Всего по позициям: <b>{money(grand)}</b>
        {isOwner && debtors.length > 0 && <> · Вам ещё должны: <b>{money(owedLeft)}</b></>}
      </p>
      {trip.receipt_total != null && (
        <p className={round2(trip.receipt_total - grand) === 0 ? 'ok small' : 'warn small'}>
          Итог по чеку: {money(trip.receipt_total)}
          {round2(trip.receipt_total - grand) !== 0 && ` — разница с позициями ${money(round2(trip.receipt_total - grand))}`}
        </p>
      )}

      {trip.receipt_path && (
        <div className="receipt">
          <b>Чек</b>
          <SignedImage path={trip.receipt_path} alt="чек" className="thumb" />
        </div>
      )}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
