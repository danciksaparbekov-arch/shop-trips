import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Ссылка-приглашение: по ней коллеги попадают в поход. Её же можно показать QR-кодом с экрана.
export default function ShareLink({ token, title }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [big, setBig] = useState(false);
  const [qr, setQr] = useState('');
  const link = `${window.location.origin}${window.location.pathname}#/join/${token}`;

  // QR рисуем только когда его открыли; белое поле вокруг обязательно — иначе камера плохо читает
  useEffect(() => {
    if (!showQr) return undefined;
    let alive = true;
    QRCode.toDataURL(link, { width: 640, margin: 3, errorCorrectionLevel: 'M' })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(''));
    return () => { alive = false; };
  }, [showQr, link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Скопируйте ссылку:', link); // если буфер недоступен
    }
  }

  async function share() {
    try {
      await navigator.share({ title, text: `Пойдём в магазин? Допишите, что вам нужно: «${title}»`, url: link });
    } catch { /* человек закрыл окно */ }
  }

  return (
    <div className="card share">
      <b>Ссылка для коллег</b>
      <p className="muted small">Кто откроет её, сможет дописывать позиции. Не публикуйте её в открытых местах.</p>
      <div className="row">
        <input readOnly value={link} onFocus={(e) => e.target.select()} />
        <button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</button>
        {navigator.share && <button className="btn ghost" onClick={share}>Поделиться</button>}
        <button className="btn ghost" onClick={() => setShowQr((s) => !s)}>{showQr ? 'Скрыть QR' : 'Показать QR'}</button>
      </div>

      {showQr && (
        <div className="qr-box">
          {qr
            ? <img src={qr} alt="QR-код со ссылкой на поход" className="qr-invite" onClick={() => setBig(true)} />
            : <span className="muted small">Рисуем QR…</span>}
          <p className="muted small">Пусть коллеги наведут камеру телефона. Нажмите на код, чтобы увеличить.</p>
        </div>
      )}

      {big && qr && (
        <div className="qr-overlay" onClick={() => setBig(false)} role="dialog" aria-label="QR-код приглашения">
          <img src={qr} alt="QR-код со ссылкой на поход" />
          <p>{title}<br /><small>Нажмите, чтобы закрыть</small></p>
        </div>
      )}
    </div>
  );
}
