import { useEffect, useState } from 'react';
import { signedUrl } from '../lib/supabase';

// Картинка из закрытого хранилища: берём временную ссылку; по клику открывается целиком
export default function SignedImage({ path, alt, className }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(''); setFailed(false);
    if (path) signedUrl(path).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [path]);

  if (!path) return null;
  if (failed) return <span className="err small">Не удалось загрузить: {alt}</span>;
  if (!url) return <span className="muted small">Загрузка: {alt}…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className={className} loading="lazy" />
    </a>
  );
}
