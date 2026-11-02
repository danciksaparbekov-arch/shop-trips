import { useState } from 'react';

// Ссылка-приглашение: по ней коллеги попадают в поход
export default function ShareLink({ token, title }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}#/join/${token}`;

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
      </div>
    </div>
  );
}
