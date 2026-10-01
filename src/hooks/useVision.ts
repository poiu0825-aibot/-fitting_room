import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { TRY_ON } from '../config/tryOnConfig';
import type { TryOnItemType, VisionResult, VisionState, WorkerResponse } from '../vision/types';
export function useVision(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  mode: TryOnItemType,
) {
  const [state, setState] = useState<VisionState>('idle');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const result = useRef<VisionResult | null>(null);
  const inferenceFps = useRef(0);
  const retry = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    result.current = null;
    inferenceFps.current = 0;
    if (!enabled) {
      setError('');
      setState('idle');
      return;
    }
    if (
      typeof Worker === 'undefined' ||
      typeof OffscreenCanvas === 'undefined' ||
      typeof createImageBitmap === 'undefined'
    ) {
      setState('error');
      setError('此瀏覽器不支援本機追蹤。請更新至最新版 Safari 或 Chrome。');
      return;
    }
    let cancelled = false,
      busy = false,
      ready = false,
      lastFrame = -1,
      lastSent = 0,
      lastResult = 0;
    let worker: Worker;
    setState('loading');
    setError('');
    try {
      worker = new Worker(
        new URL('vision/vision.worker.js', new URL(import.meta.env.BASE_URL, window.location.href)),
      );
    } catch {
      setState('error');
      setError('本機追蹤無法啟動，請更新瀏覽器。');
      return;
    }
    const fail = (message: string) => {
      ready = false;
      busy = false;
      result.current = null;
      setState('error');
      setError(message);
    };
    const timeout = setTimeout(() => {
      if (!ready) fail('追蹤模型載入逾時，請確認網路或重新載入模型。');
    }, 60000);
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (cancelled) return;
      if (data.kind === 'ready') {
        clearTimeout(timeout);
        ready = true;
        setState('ready');
      } else if (data.kind === 'error') {
        clearTimeout(timeout);
        fail(data.message);
      } else {
        const now = performance.now();
        inferenceFps.current = lastResult ? 1000 / (now - lastResult) : 0;
        lastResult = now;
        result.current = data.result;
        busy = false;
      }
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      fail('本機追蹤無法執行，請更新瀏覽器或重新載入模型。');
    };
    worker.postMessage({
      kind: 'init',
      mode,
      baseUrl: new URL(import.meta.env.BASE_URL, window.location.href).href,
    });
    const sendFrame = async () => {
      const video = videoRef.current;
      const now = performance.now();
      if (
        !ready ||
        busy ||
        cancelled ||
        document.hidden ||
        !video ||
        video.readyState < 2 ||
        !video.videoWidth ||
        video.currentTime === lastFrame ||
        now - lastSent < 1000 / TRY_ON.inferenceFps[mode]
      )
        return;
      busy = true;
      lastSent = now;
      lastFrame = video.currentTime;
      try {
        const width = Math.min(video.videoWidth, TRY_ON.inferenceMaxWidth);
        const bitmap = await createImageBitmap(video, {
          resizeWidth: width,
          resizeHeight: Math.round((width * video.videoHeight) / video.videoWidth),
        });
        if (cancelled || !ready) {
          bitmap.close();
          busy = false;
          return;
        }
        worker.postMessage({ kind: 'frame', frame: bitmap, timestamp: now }, [bitmap]);
      } catch {
        if (!cancelled) fail('無法讀取相機畫面進行追蹤，請重新啟動相機。');
      }
    };
    const timer = setInterval(() => {
      void sendFrame();
    }, 12);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(timer);
      worker.terminate();
      result.current = null;
    };
  }, [enabled, mode, revision, videoRef]);
  return { state, error, result, inferenceFps, retry };
}
