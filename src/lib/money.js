export const CURRENCY = 'сом';

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const money = (n) => `${nf.format(round2(n))} ${CURRENCY}`;

// '120', '99,5', '1 250' → число; пусто или мусор → null
export function parsePrice(text) {
  const s = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? round2(n) : null;
}

// Название → ключ справочника цен («Молоко  3,2%» и «молоко 3,2%» — одна позиция)
export const priceKey = (name) => name.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// Сумма по позиции: цена за штуку × количество; «не нашли» и позиции без цены не считаются
export const lineTotal = (item) => (item.missing || item.price == null ? 0 : round2(item.price * item.qty));

// Сумма по каждому человеку: { [user_id]: число }
export function totalsByUser(items) {
  const sums = {};
  items.forEach((i) => { sums[i.user_id] = round2((sums[i.user_id] || 0) + lineTotal(i)); });
  return sums;
}
