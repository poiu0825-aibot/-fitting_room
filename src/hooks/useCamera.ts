import { useCallback, useEffect, useRef, useState } from 'react';
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';
export interface CameraProvider {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
}
export function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return '相機權限遭拒絕。請在瀏覽器網站設定允許相機，再重新啟動。';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return '找不到可用的相機，請確認裝置已連接鏡頭。';
  if (name === 'NotReadableError') return '相機可能正被其他程式使用，請關閉其他相機程式後重試。';
  return '無法啟動相機，請確認使用 HTTPS 與支援相機的瀏覽器。';
}
export function useCamera(provider?: CameraProvider) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestId = useRef(0);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState('');
  const stop = useCallback(() => {
    requestId.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);
  const start = useCallback(async () => {
    stop();
    const current = ++requestId.current;
    const media = provider ?? navigator.mediaDevices;
    if (!media?.getUserMedia || !window.isSecureContext) {
      setError('此瀏覽器無法使用相機。請用 HTTPS 開啟最新版 Safari 或 Chrome。');
      setStatus('error');
      return;
    }
    setStatus('requesting');
    setError('');
    try {
      const stream = await media.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (current !== requestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (current === requestId.current) setStatus('ready');
    } catch (cause) {
      if (current !== requestId.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setError(cameraError(cause));
      setStatus('error');
    }
  }, [provider, stop]);
  useEffect(() => {
    const requests = requestId,
      streams = streamRef;
    const onPageHide = () => stop();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      requests.current++;
      streams.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stop]);
  return { videoRef, status, error, start, stop };
}
