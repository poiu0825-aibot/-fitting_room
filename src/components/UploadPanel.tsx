import { useRef } from 'react';
import type { TryOnAsset, TryOnItemType } from '../vision/types';
export function UploadPanel({
  mode,
  asset,
  upload,
  clear,
  loading,
  error,
}: {
  mode: TryOnItemType;
  asset: TryOnAsset | null;
  upload: (file: File, mode: TryOnItemType) => Promise<void>;
  clear: (mode: TryOnItemType) => void;
  loading: boolean;
  error: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="upload-panel" aria-label="本機圖片">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="選擇試穿圖片"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file, mode);
          event.target.value = '';
        }}
      />
      <button
        className="upload-button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        <span className="plus" aria-hidden="true">
          ＋
        </span>
        <span>
          {loading
            ? '讀取圖片中…'
            : asset
              ? '更換圖片'
              : `上傳${mode === 'hairstyle' ? '髮型' : '上衣'}圖片`}
          <small>PNG · JPG · WEBP ／ 最大 15 MB</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      {asset && (
        <div className="asset-name">
          <span title={asset.name}>{asset.name}</span>
          <button onClick={() => clear(mode)}>移除</button>
        </div>
      )}
      <p className="hint">使用透明背景 PNG / WEBP 可獲得最佳效果。</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
