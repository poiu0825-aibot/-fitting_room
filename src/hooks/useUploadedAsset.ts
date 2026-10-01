import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLocalImage } from '../services/imageLoader';
import type { TryOnAsset, TryOnItemType } from '../vision/types';
export function useUploadedAsset() {
  const owned = useRef<Partial<Record<TryOnItemType, TryOnAsset>>>({});
  const generation = useRef({ hairstyle: 0, top: 0 });
  const [assets, setAssets] = useState<Partial<Record<TryOnItemType, TryOnAsset>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(0);
  const upload = useCallback(async (file: File, type: TryOnItemType) => {
    const id = ++generation.current[type];
    pending.current++;
    setLoading(true);
    setError('');
    try {
      const image = await loadLocalImage(file);
      if (id !== generation.current[type]) {
        image.close();
        return;
      }
      const asset: TryOnAsset = {
        image,
        width: image.width,
        height: image.height,
        name: file.name,
        type,
      };
      owned.current[type]?.image.close();
      owned.current = { ...owned.current, [type]: asset };
      setAssets(owned.current);
    } catch (cause) {
      if (id === generation.current[type])
        setError(cause instanceof Error ? cause.message : '圖片讀取失敗。');
    } finally {
      pending.current--;
      if (!pending.current) setLoading(false);
    }
  }, []);
  const clear = useCallback((type: TryOnItemType) => {
    generation.current[type]++;
    owned.current[type]?.image.close();
    const next = { ...owned.current };
    delete next[type];
    owned.current = next;
    setAssets(next);
    setError('');
  }, []);
  useEffect(
    () => () => {
      generation.current.hairstyle++;
      generation.current.top++;
      Object.values(owned.current).forEach((asset) => asset?.image.close());
      owned.current = {};
    },
    [],
  );
  return { assets, upload, clear, error, loading };
}
