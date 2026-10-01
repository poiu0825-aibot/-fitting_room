import { describe, expect, it } from 'vitest';
import {
  coverRect,
  normalizedToCanvas,
  canvasToNormalized,
  type Viewport,
} from '../src/renderer/coordinateUtils';
import { angleDelta, lineRotation } from '../src/utils/math';
import { smoothTransform } from '../src/vision/smoothing';
import { faceFromLandmarks, poseFromLandmarks } from '../src/vision/transforms';
import {
  garmentTransform,
  hairstyleTransform,
  mergeCalibration,
} from '../src/renderer/overlayTransform';
import type { Landmark, TryOnTransform } from '../src/vision/types';
const view: Viewport = {
  sourceWidth: 1280,
  sourceHeight: 720,
  width: 360,
  height: 480,
  mirror: false,
};
const transform: TryOnTransform = { x: 10, y: 20, width: 100, height: 200, rotation: 0 };
describe('single coordinate system', () => {
  it('centers and crops landscape camera into portrait without stretching', () => {
    const rect = coverRect(view);
    expect(rect.height).toBe(480);
    expect(rect.width).toBeCloseTo(853.3333);
    expect(rect.x).toBeCloseTo(-246.6667);
    expect(normalizedToCanvas({ x: 0.5, y: 0.5 }, view)).toEqual({ x: 180, y: 240 });
  });
  it('mirrors exactly once and reverses the horizontal movement', () => {
    const original = normalizedToCanvas({ x: 0.6, y: 0.4 }, view);
    const mirrored = normalizedToCanvas({ x: 0.6, y: 0.4 }, { ...view, mirror: true });
    expect(mirrored.x).toBeCloseTo(view.width - original.x);
    expect(mirrored.y).toBe(original.y);
  });
  it.each([true, false])('round trips normalized coordinates with mirror=%s', (mirror) => {
    const v = { ...view, mirror };
    const point = { x: 0.32, y: 0.65 };
    const roundtrip = canvasToNormalized(normalizedToCanvas(point, v), v);
    expect(roundtrip.x).toBeCloseTo(point.x);
    expect(roundtrip.y).toBeCloseTo(point.y);
  });
  it('maps the same face center after viewport orientation changes', () => {
    expect(normalizedToCanvas({ x: 0.5, y: 0.5 }, { ...view, width: 640, height: 360 })).toEqual({
      x: 320,
      y: 180,
    });
  });
});
describe('angle and frame-rate independent smoothing', () => {
  it('takes the short path across ±π', () =>
    expect(angleDelta((179 * Math.PI) / 180, (-179 * Math.PI) / 180)).toBeCloseTo(
      (2 * Math.PI) / 180,
    ));
  it('preserves tilt when shoulder endpoint ordering reverses', () => {
    const a = { x: 10, y: 10 },
      b = { x: 40, y: 25 };
    expect(lineRotation(a, b)).toBeCloseTo(lineRotation(b, a));
  });
  it('starts with the first known transform', () =>
    expect(smoothTransform(null, transform, 20)).toEqual(transform));
  it('smooths position, size and rotation', () => {
    const next = { x: 110, y: 120, width: 200, height: 300, rotation: 1 };
    const result = smoothTransform(transform, next, 85);
    expect(result.x).toBeGreaterThan(10);
    expect(result.x).toBeLessThan(110);
    expect(result.width).toBeGreaterThan(100);
    expect(result.rotation).toBeCloseTo(1 - Math.exp(-1));
    expect(transform.x).toBe(10);
  });
  it('gives equal smoothing for equal elapsed time at different inference rates', () => {
    const next = { ...transform, x: 200 };
    const twice = smoothTransform(smoothTransform(transform, next, 20), next, 20);
    expect(twice.x).toBeCloseTo(smoothTransform(transform, next, 40).x);
  });
});
function facePoints() {
  const points: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  points[234] = { x: 0.4, y: 0.5 };
  points[454] = { x: 0.6, y: 0.5 };
  points[10] = { x: 0.5, y: 0.25 };
  points[152] = { x: 0.5, y: 0.75 };
  points[33] = { x: 0.45, y: 0.4 };
  points[263] = { x: 0.55, y: 0.45 };
  return points;
}
describe('face transforms', () => {
  it('extracts center, physical dimensions, eye distance, tilt and scale', () => {
    const face = faceFromLandmarks(facePoints(), view)!;
    expect(face.centerX).toBe(180);
    expect(face.centerY).toBe(240);
    expect(face.width).toBeCloseTo(170.6667);
    expect(face.height).toBe(240);
    expect(face.eyeDistance).toBeGreaterThan(85);
    expect(face.rotation).toBeGreaterThan(0);
    expect(face.scale).toBeGreaterThan(1);
  });
  it('mirrors head tilt while preserving scale', () => {
    const normal = faceFromLandmarks(facePoints(), view)!;
    const mirror = faceFromLandmarks(facePoints(), { ...view, mirror: true })!;
    expect(mirror.rotation).toBeCloseTo(-normal.rotation);
    expect(mirror.width).toBeCloseTo(normal.width);
  });
  it('rejects missing or degenerate faces', () => {
    expect(faceFromLandmarks([], view)).toBeNull();
    expect(
      faceFromLandmarks(
        Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 })),
        view,
      ),
    ).toBeNull();
  });
  it('positions hair above the head and scales with face width', () => {
    const face = faceFromLandmarks(facePoints(), view)!;
    const hair = hairstyleTransform(face, 2);
    expect(hair.y).toBeLessThan(face.centerY);
    expect(hair.width / hair.height).toBe(2);
    expect(hairstyleTransform({ ...face, width: face.width * 2 }, 2).width).toBeCloseTo(
      hair.width * 2,
    );
  });
});
function posePoints() {
  const points: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  points[11] = { x: 0.4, y: 0.25, visibility: 1 };
  points[12] = { x: 0.6, y: 0.3, visibility: 1 };
  points[23] = { x: 0.42, y: 0.75, visibility: 1 };
  points[24] = { x: 0.58, y: 0.8, visibility: 1 };
  return points;
}
describe('pose and garment calibration', () => {
  it('places garments using shoulders and torso center without distorting aspect', () => {
    const pose = poseFromLandmarks(posePoints(), view)!;
    const garment = garmentTransform(pose, 0.8);
    expect(pose.torsoCenter.x).toBeCloseTo(180);
    expect(pose.torsoHeight).toBeCloseTo(240);
    expect(garment.width).toBeCloseTo(pose.torsoWidth * 1.55);
    expect(garment.width / garment.height).toBeCloseTo(0.8);
    expect(garment.rotation).toBe(pose.rotation);
  });
  it('rejects invisible hips and missing poses', () => {
    const points = posePoints();
    points[23].visibility = 0.1;
    expect(poseFromLandmarks(points, view)).toBeNull();
    expect(poseFromLandmarks([], view)).toBeNull();
  });
  it('merges manual offsets, scale and angle without modifying tracking input', () => {
    expect(
      mergeCalibration(transform, { offsetX: 5, offsetY: -8, scale: 1.5, rotation: 0.2 }),
    ).toEqual({ x: 15, y: 12, width: 150, height: 300, rotation: 0.2 });
    expect(transform).toEqual({ x: 10, y: 20, width: 100, height: 200, rotation: 0 });
  });
});
