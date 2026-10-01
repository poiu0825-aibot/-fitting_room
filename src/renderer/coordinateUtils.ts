import type { Point } from '../vision/types';
export interface Viewport {
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  mirror: boolean;
}
export function coverRect(view: Viewport) {
  const scale = Math.max(view.width / view.sourceWidth, view.height / view.sourceHeight);
  const width = view.sourceWidth * scale,
    height = view.sourceHeight * scale;
  return { scale, width, height, x: (view.width - width) / 2, y: (view.height - height) / 2 };
}
export function normalizedToCanvas(point: Point, view: Viewport): Point {
  const rect = coverRect(view);
  const x = point.x * rect.width + rect.x;
  return { x: view.mirror ? view.width - x : x, y: point.y * rect.height + rect.y };
}
export function canvasToNormalized(point: Point, view: Viewport): Point {
  const rect = coverRect(view);
  return {
    x: ((view.mirror ? view.width - point.x : point.x) - rect.x) / rect.width,
    y: (point.y - rect.y) / rect.height,
  };
}
export function drawCamera(
  ctx: CanvasRenderingContext2D,
  video: CanvasImageSource,
  view: Viewport,
) {
  const rect = coverRect(view);
  ctx.save();
  if (view.mirror) {
    ctx.translate(view.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}
export function configureCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
) {
  const w = Math.max(1, Math.round(width * dpr)),
    h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
