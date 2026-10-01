import { expect, it } from 'vitest';
import { alphaBounds, repairHair, resizedMaskIndex } from '../src/photo/pixels';
import { validatePortrait } from '../src/photo/composition';
import type { PhotoAnalysis } from '../src/photo/types';
it('trims transparent padding without losing opaque edges', () => {
  const pixels = new Uint8ClampedArray(5 * 4 * 4);
  pixels[(1 * 5 + 2) * 4 + 3] = 255;
  pixels[(3 * 5 + 4) * 4 + 3] = 255;
  expect(alphaBounds(pixels, 5, 4)).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  expect(alphaBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
});
it('resamples mask coordinates at image boundaries', () => {
  expect(resizedMaskIndex(99, 199, 100, 200, 10, 20)).toBe(199);
  expect(resizedMaskIndex(50, 100, 100, 200, 10, 20)).toBe(105);
});
it('repairs only confident hair while preserving face, glasses, clothes and alpha', () => {
  const pixels = new Uint8ClampedArray([
    100, 110, 120, 255, 0, 0, 0, 255, 50, 60, 70, 255, 20, 30, 40, 255, 10, 20, 30, 255,
  ]);
  const result = repairHair(
    pixels,
    new Uint8Array([0, 1, 3, 5, 4]),
    new Float32Array([0, 1, 0, 0, 0]),
    5,
    1,
  );
  expect(Array.from(result.pixels.slice(4, 8))).toEqual([100, 110, 120, 255]);
  expect(Array.from(result.pixels.slice(8))).toEqual(Array.from(pixels.slice(8)));
  expect(result.coverage).toBe(1);
  expect(pixels[4]).toBe(0);
});
it('leaves hair intact when no safe background exists', () => {
  const pixels = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const result = repairHair(pixels, new Uint8Array([1, 3]), new Float32Array([1, 0]), 2, 1);
  expect(result.pixels).toEqual(pixels);
  expect(result.coverage).toBe(0);
});
it('does not erase ambiguous hair predictions', () => {
  const pixels = new Uint8ClampedArray([255, 255, 255, 255, 20, 20, 20, 255]);
  expect(
    repairHair(pixels, new Uint8Array([0, 1]), new Float32Array([0, 0.4]), 2, 1).pixels,
  ).toEqual(pixels);
});
it('rejects multi-person, missing-face and steep-profile photos', () => {
  const data: PhotoAnalysis = {
    width: 1,
    height: 1,
    categories: new Uint8Array(1),
    hairConfidence: new Float32Array(1),
    landmarks: [],
    faceCount: 2,
  };
  expect(() => validatePortrait(data)).toThrow('一人');
  expect(() => validatePortrait({ ...data, faceCount: 0 })).toThrow('清晰臉部');
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[234] = { x: 0.4, y: 0.5, z: -0.2 };
  landmarks[454] = { x: 0.6, y: 0.5, z: 0.2 };
  expect(() => validatePortrait({ ...data, faceCount: 1, landmarks })).toThrow('側臉');
});
