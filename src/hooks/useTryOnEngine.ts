import { useCallback, useRef, useState, type RefObject } from 'react';
import { TRY_ON } from '../config/tryOnConfig';
import { configureCanvas, normalizedToCanvas, type Viewport } from '../renderer/coordinateUtils';
import { composite } from '../renderer/compositor';
import {
  garmentTransform,
  hairstyleTransform,
  mergeCalibration,
} from '../renderer/overlayTransform';
import { faceFromLandmarks, poseFromLandmarks } from '../vision/transforms';
import { smoothTransform } from '../vision/smoothing';
import { canvasToBlob } from '../services/imageExporter';
import { useAnimationFrame } from './useAnimationFrame';
import type {
  CalibrationState,
  TryOnAsset,
  TryOnItemType,
  TryOnTransform,
  VisionResult,
} from '../vision/types';
export interface EngineStats {
  fps: number;
  inferenceFps: number;
  source: string;
  canvas: string;
  faceCount: number;
  poseDetected: boolean;
  center: string;
  transform: TryOnTransform | null;
  mirror: boolean;
}
export function useTryOnEngine(options: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  result: RefObject<VisionResult | null>;
  inferenceFps: RefObject<number>;
  enabled: boolean;
  mode: TryOnItemType;
  asset: TryOnAsset | null;
  calibration: CalibrationState;
  debug: boolean;
}) {
  const { videoRef, canvasRef, result, inferenceFps, enabled, mode, asset, calibration, debug } =
    options;
  const smooth = useRef<TryOnTransform | null>(null),
    previousTime = useRef(0),
    previousGeometry = useRef('');
  const finalTransform = useRef<TryOnTransform | null>(null),
    viewRef = useRef<Viewport | null>(null);
  const report = useRef({ time: 0, frames: 0 });
  const [stats, setStats] = useState<EngineStats>({
    fps: 0,
    inferenceFps: 0,
    source: '—',
    canvas: '—',
    faceCount: 0,
    poseDetected: false,
    center: '—',
    transform: null,
    mirror: TRY_ON.mirror,
  });
  const [error, setError] = useState('');
  const tick = useCallback(
    (now: number) => {
      const video = videoRef.current,
        canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const view: Viewport = {
        sourceWidth: video.videoWidth,
        sourceHeight: video.videoHeight,
        width: bounds.width,
        height: bounds.height,
        mirror: TRY_ON.mirror,
      };
      const ctx = configureCanvas(
        canvas,
        view.width,
        view.height,
        Math.min(window.devicePixelRatio || 1, TRY_ON.maxCanvasDpr),
      );
      if (!ctx) {
        setError('此瀏覽器不支援 Canvas，請使用最新版 Safari 或 Chrome。');
        return;
      }
      viewRef.current = view;
      const geometry = `${mode}:${view.width}:${view.height}:${view.sourceWidth}:${view.sourceHeight}:${asset?.width}:${asset?.height}`;
      if (geometry !== previousGeometry.current) {
        previousGeometry.current = geometry;
        previousTime.current = 0;
        smooth.current = null;
      }
      const detection = result.current;
      const fresh = enabled && detection && now - detection.timestamp < TRY_ON.trackingExpiryMs;
      const face =
        fresh && detection.faceCount === 1 ? faceFromLandmarks(detection.face, view) : null;
      const pose = fresh ? poseFromLandmarks(detection.pose, view) : null;
      if (
        asset &&
        detection &&
        fresh &&
        ((mode === 'hairstyle' && face) || (mode === 'top' && pose))
      ) {
        if (detection.timestamp !== previousTime.current) {
          const auto =
            mode === 'hairstyle'
              ? hairstyleTransform(face!, asset.width / asset.height)
              : garmentTransform(pose!, asset.width / asset.height);
          smooth.current = smoothTransform(
            smooth.current,
            auto,
            detection.timestamp - previousTime.current,
          );
          previousTime.current = detection.timestamp;
        }
        finalTransform.current = smooth.current
          ? mergeCalibration(smooth.current, calibration)
          : null;
      } else {
        smooth.current = null;
        previousTime.current = 0;
        finalTransform.current = null;
      }
      composite(ctx, video, view, asset, finalTransform.current);
      if (debug && fresh) {
        ctx.fillStyle = mode === 'hairstyle' ? '#75f1c3' : '#ffc98c';
        for (const point of mode === 'hairstyle' ? detection.face : detection.pose) {
          const mapped = normalizedToCanvas(point, view);
          ctx.beginPath();
          ctx.arc(mapped.x, mapped.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (finalTransform.current) {
          const t = finalTransform.current;
          ctx.save();
          ctx.translate(t.x, t.y);
          ctx.rotate(t.rotation);
          ctx.strokeStyle = '#75f1c3';
          ctx.lineWidth = 1;
          ctx.strokeRect(-t.width / 2, -t.height / 2, t.width, t.height);
          ctx.restore();
        }
      }
      report.current.frames++;
      const duration = now - report.current.time;
      if (duration > 250) {
        setStats({
          fps: Math.round((report.current.frames * 1000) / duration),
          inferenceFps: Math.round(inferenceFps.current),
          source: `${video.videoWidth} × ${video.videoHeight}`,
          canvas: `${canvas.width} × ${canvas.height}`,
          faceCount: fresh ? detection.faceCount : 0,
          poseDetected: !!pose,
          center: face ? `${Math.round(face.centerX)}, ${Math.round(face.centerY)}` : '—',
          transform: finalTransform.current,
          mirror: view.mirror,
        });
        report.current = { time: now, frames: 0 };
      }
    },
    [videoRef, canvasRef, result, inferenceFps, enabled, mode, asset, calibration, debug],
  );
  useAnimationFrame(tick, enabled);
  const capture = useCallback(async () => {
    const video = videoRef.current,
      view = viewRef.current;
    if (!enabled || !video || !view || video.readyState < 2)
      throw new Error('請先開啟相機再拍照。');
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, TRY_ON.maxCanvasDpr);
    const ctx = configureCanvas(canvas, view.width, view.height, dpr);
    if (!ctx) throw new Error('此瀏覽器不支援拍照。');
    const current = result.current;
    const tracked = current && performance.now() - current.timestamp < TRY_ON.trackingExpiryMs;
    composite(ctx, video, view, asset, tracked ? finalTransform.current : null);
    return canvasToBlob(canvas);
  }, [enabled, videoRef, asset, result]);
  return { stats, error, capture };
}
