import type { TryOnTransform } from './types';
import { angleDelta, normalizeAngle } from '../utils/math';
import { TRY_ON } from '../config/tryOnConfig';
export function smoothTransform(
  previous: TryOnTransform | null,
  next: TryOnTransform,
  elapsedMs: number,
  timeMs = TRY_ON.smoothingTimeMs,
): TryOnTransform {
  if (!previous) return { ...next };
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / timeMs);
  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  return {
    x: lerp(previous.x, next.x),
    y: lerp(previous.y, next.y),
    width: lerp(previous.width, next.width),
    height: lerp(previous.height, next.height),
    rotation: normalizeAngle(
      previous.rotation + angleDelta(previous.rotation, next.rotation) * alpha,
    ),
  };
}
