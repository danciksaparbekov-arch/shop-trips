import { createClient } from '@supabase/supabase-js';

// detectSessionInUrl выключен: адреса у нас вида #/join/..., а не токены входа
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { detectSessionInUrl: false } },
);

export const BUCKET = 'trip-files';

// Бакет закрытый: показываем файл по временной ссылке (на час)
export async function signedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// supabase-js не бросает ошибки сам — приводим к исключению
export function must(res) {
  if (res.error) throw res.error;
  return res.data;
}
