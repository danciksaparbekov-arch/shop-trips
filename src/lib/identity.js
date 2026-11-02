// Вход «только по имени»: из имени вычисляются скрытые логин и пароль, одинаковые на любом устройстве.
// ВАЖНО: код открыт, поэтому любой может вычислить их для чужого имени — защиты от «подмены имени» нет.
// Это осознанный выбор (удобство важнее); добавить PIN можно, подмешав его в пароль.

// «Айдана », «айдана» и «АЙДАНА» — одно и то же имя
export const normalizeName = (name) => name.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function credentialsFor(name) {
  const n = normalizeName(name);
  return {
    email: `n${(await sha256hex(`shop-trips:email:${n}`)).slice(0, 32)}@example.com`, // письма на него не уходят
    password: await sha256hex(`shop-trips:pass:${n}`),
  };
}
