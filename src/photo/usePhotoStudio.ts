import { PHOTO_CONFIG } from './config';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLocalImage } from '../services/imageLoader';
import { canvasToBlob } from '../services/imageExporter';
import { DEFAULT_CALIBRATION } from '../config/tryOnConfig';
import { PhotoAnalyser } from './analyser';
import {
  composePhoto,
  hasTransparency,
  makeHairAsset,
  photoCanvas,
  prepareRepair,
  validatePortrait,
} from './composition';
import type { HairAsset, PhotoAnalysis } from './types';
export function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
export function usePhotoStudio() {
  const [portrait, setPortrait] = useState<HTMLCanvasElement | null>(null);
  const [portraitBlob, setPortraitBlob] = useState<Blob | null>(null);
  const [hair, setHair] = useState<HairAsset | null>(null);
  const [hairBlob, setHairBlob] = useState<Blob | null>(null);
  const [analysis, setAnalysis] = useState<{
    data: PhotoAnalysis;
    repair: ReturnType<typeof prepareRepair>;
  } | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false),
    [rendering, setRendering] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState('');
  const [calibration, setCalibration] = useState({ ...DEFAULT_CALIBRATION });
  const [removal, setRemoval] = useState(1),
    [brightness, setBrightness] = useState(1);
  const analyser = useRef<PhotoAnalyser | null>(null),
    ownedHair = useRef<ImageBitmap | null>(null),
    generation = useRef(0);
  const portraitUrl = useBlobUrl(portraitBlob),
    hairUrl = useBlobUrl(hairBlob),
    resultUrl = useBlobUrl(resultBlob);
  useEffect(
    () => () => {
      generation.current++;
      analyser.current?.close();
      ownedHair.current?.close();
    },
    [],
  );
  const setPhoto = useCallback(async (image: ImageBitmap) => {
    const id = ++generation.current;
    setBusy(true);
    setError('');
    setAnalysis(null);
    setResultBlob(null);
    try {
      const canvas = photoCanvas(image),
        blob = await canvasToBlob(canvas);
      if (id !== generation.current) return;
      setPortrait(canvas);
      setPortraitBlob(blob);
      setCalibration({ ...DEFAULT_CALIBRATION });
      setStatus('照片已準備好，請選擇新髮型。');
    } catch (cause) {
      if (id === generation.current)
        setError(cause instanceof Error ? cause.message : '照片讀取失敗。');
    } finally {
      image.close();
      if (id === generation.current) setBusy(false);
    }
  }, []);
  const uploadPhoto = useCallback(
    async (file: File) => {
      const id = ++generation.current;
      setBusy(true);
      setError('');
      try {
        const image = await loadLocalImage(file);
        if (id !== generation.current) {
          image.close();
          return;
        }
        await setPhoto(image);
      } catch (cause) {
        if (id === generation.current) {
          setError(cause instanceof Error ? cause.message : '照片讀取失敗。');
          setBusy(false);
        }
      }
    },
    [setPhoto],
  );
  const uploadHair = useCallback(async (file: File) => {
    const id = ++generation.current;
    setBusy(true);
    setError('');
    setStatus('正在準備新髮型…');
    setResultBlob(null);
    let image: ImageBitmap | null = null,
      prepared: HairAsset | null = null;
    try {
      image = await loadLocalImage(file);
      if (id !== generation.current) return;
      let data: PhotoAnalysis | undefined;
      if (!hasTransparency(image)) {
        setStatus('正在本機擷取參考照片的頭髮…');
        analyser.current = new PhotoAnalyser();
        data = await analyser.current.analyse(image);
        validatePortrait(data);
      }
      prepared = await makeHairAsset(image, data);
      const blob = await canvasToBlob(photoCanvas(prepared.image));
      if (id !== generation.current) {
        prepared.image.close();
        prepared = null;
        return;
      }
      ownedHair.current?.close();
      ownedHair.current = prepared.image;
      setHair(prepared);
      setHairBlob(blob);
      setCalibration({ ...DEFAULT_CALIBRATION });
      setStatus(
        prepared.extracted
          ? '已在本機擷取頭髮，請確認髮際線中心。'
          : '透明髮型已準備好，請點選髮際線中心。',
      );
    } catch (cause) {
      prepared?.image.close();
      if (id === generation.current)
        setError(cause instanceof Error ? cause.message : '髮型讀取失敗。');
    } finally {
      image?.close();
      analyser.current?.close();
      analyser.current = null;
      if (id === generation.current) setBusy(false);
    }
  }, []);
  const process = useCallback(async () => {
    if (!portrait || !hair || busy) return;
    const id = ++generation.current;
    setBusy(true);
    setError('');
    setStatus('正在本機辨識臉部與原本頭髮…');
    let bitmap: ImageBitmap | null = null;
    try {
      analyser.current = new PhotoAnalyser();
      bitmap = await createImageBitmap(portrait);
      const data = await analyser.current.analyse(bitmap);
      validatePortrait(data);
      if (id !== generation.current) return;
      setStatus('正在修補舊髮區域並合成…');
      const repair = prepareRepair(portrait, data);
      setAnalysis({ data, repair });
    } catch (cause) {
      if (id === generation.current)
        setError(cause instanceof Error ? cause.message : '照片處理失敗。');
    } finally {
      bitmap?.close();
      analyser.current?.close();
      analyser.current = null;
      if (id === generation.current) setBusy(false);
    }
  }, [portrait, hair, busy]);
  useEffect(() => {
    if (!portrait || !analysis || !hair) return;
    let cancelled = false;
    setRendering(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const canvas = composePhoto(
          portrait,
          analysis.data,
          analysis.repair,
          hair,
          calibration,
          removal,
          brightness,
        );
        const blob = await canvasToBlob(canvas);
        if (!cancelled) {
          setResultBlob(blob);
          setStatus(
            analysis.repair.hairPixels > 0 && analysis.repair.coverage < 0.9
              ? '已套用新髮型，但部分舊髮無法修補。請使用背景更簡單的照片。'
              : '合成完成。請檢查邊緣、臉部與眼鏡，再決定是否保存。',
          );
        }
      } catch (cause) {
        if (!cancelled) {
          setResultBlob(null);
          setError(cause instanceof Error ? cause.message : '合成失敗。');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, PHOTO_CONFIG.previewDebounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [portrait, analysis, hair, calibration, removal, brightness]);
  const reset = useCallback(() => {
    generation.current++;
    analyser.current?.close();
    analyser.current = null;
    ownedHair.current?.close();
    ownedHair.current = null;
    setPortrait(null);
    setPortraitBlob(null);
    setHair(null);
    setHairBlob(null);
    setAnalysis(null);
    setResultBlob(null);
    setBusy(false);
    setRendering(false);
    setError('');
    setStatus('');
    setCalibration({ ...DEFAULT_CALIBRATION });
    setRemoval(1);
    setBrightness(1);
  }, []);
  return {
    portrait,
    portraitUrl,
    hair,
    hairUrl,
    resultUrl,
    analysis,
    busy,
    rendering,
    status,
    error,
    calibration,
    setCalibration,
    removal,
    setRemoval,
    brightness,
    setBrightness,
    uploadPhoto,
    setPhoto,
    uploadHair,
    process,
    reset,
    setAnchor: (x: number, y: number) =>
      setHair((previous) =>
        previous
          ? {
              ...previous,
              anchor: { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) },
            }
          : null,
      ),
  };
}
