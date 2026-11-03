import { supabase, BUCKET } from './supabase';

const MAX_SIDE = 1800;          // чтобы текст на чеке оставался читаемым
const MAX_SIZE = 5 * 1024 * 1024; // 5 МБ — лимит бакета

// Сжимает фото в JPEG до MAX_SIDE по длинной стороне (телефонные фото бывают по 10 МБ)
export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(`«${file.name}»: нужна картинка`);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`«${file.name}»: не удалось открыть картинку`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // прозрачные PNG (QR) иначе станут чёрными
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob || blob.size > MAX_SIZE) throw new Error(`«${file.name}»: слишком большой файл`);
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

// Загружает файл в папку похода под неугадываемым именем, возвращает путь
export async function uploadTripFile(tripId, file) {
  const path = `${tripId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

// Копирует файл внутри хранилища (например, сохранённый QR из профиля в папку похода), возвращает новый путь
export async function copyToTrip(tripId, fromPath) {
  const path = `${tripId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).copy(fromPath, path);
  if (error) throw error;
  return path;
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}
