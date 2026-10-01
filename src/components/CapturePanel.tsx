import { useEffect, useRef, useState } from 'react';
import { downloadImage } from '../services/imageExporter';
export function CapturePanel({
  capture,
  enabled,
}: {
  capture: () => Promise<Blob>;
  enabled: boolean;
}) {
  const [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const activeUrl = useRef(''),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    };
  }, []);
  const reset = () => {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = '';
    setUrl('');
  };
  const takePhoto = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await capture();
      if (!alive.current) return;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      activeUrl.current = URL.createObjectURL(blob);
      setUrl(activeUrl.current);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : '拍照失敗，請重試。');
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section className="capture-panel">
      <button
        className="capture-button"
        disabled={!enabled || busy}
        onClick={() => void takePhoto()}
      >
        <span aria-hidden="true">◎</span>
        {busy ? '合成照片中…' : '拍下這個樣子'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {url && (
        <div
          className="capture-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') reset();
            if (event.key === 'Tab') {
              const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
              const first = buttons[0],
                last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <div className="capture-card">
            <div className="section-heading">
              <h2 id="capture-title">試穿結果</h2>
              <button autoFocus onClick={reset} aria-label="關閉試穿結果">
                ✕
              </button>
            </div>
            <img src={url} alt="本機合成的試穿結果" />
            <p className="hint">照片只存在目前頁面，儲存後將下載到你的裝置。</p>
            <div className="capture-actions">
              <button onClick={reset}>重新拍攝</button>
              <button className="primary-button" onClick={() => downloadImage(url)}>
                儲存圖片
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
