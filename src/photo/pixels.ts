import { PHOTO_CONFIG } from './config';
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number): Bounds | null {
  let left = width,
    right = -1,
    top = height,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < PHOTO_CONFIG.alphaThreshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
export function resizedMaskIndex(
  x: number,
  y: number,
  width: number,
  height: number,
  maskWidth: number,
  maskHeight: number,
) {
  return (
    Math.min(maskHeight - 1, Math.floor((y * maskHeight) / height)) * maskWidth +
    Math.min(maskWidth - 1, Math.floor((x * maskWidth) / width))
  );
}
// Fill only high-confidence hair with nearby background colors. This is deterministic
// pixel repair, not neural inpainting; it cannot recover unseen scenery or scalp.
export function repairHair(
  data: Uint8ClampedArray,
  categories: Uint8Array,
  confidence: Float32Array,
  width: number,
  height: number,
) {
  const size = width * height;
  if (data.length !== size * 4 || categories.length !== size || confidence.length !== size)
    throw new Error('Mask dimensions differ');
  const output = data.slice(),
    visited = new Uint8Array(size),
    removed = new Uint8Array(size),
    queue = new Int32Array(size);
  let start = 0,
    end = 0,
    count = 0;
  for (let i = 0; i < size; i++) {
    if (categories[i] === 1 && confidence[i] >= PHOTO_CONFIG.hairConfidence) {
      removed[i] = 1;
      count++;
    }
    if (categories[i] === 0 && confidence[i] < PHOTO_CONFIG.backgroundConfidence) {
      visited[i] = 1;
      queue[end++] = i;
    }
  }
  const neighbors = (i: number) => [
    i % width ? i - 1 : -1,
    i % width < width - 1 ? i + 1 : -1,
    i >= width ? i - width : -1,
    i < size - width ? i + width : -1,
  ];
  while (start < end) {
    const i = queue[start++];
    for (const j of neighbors(i)) {
      if (j < 0 || visited[j] || !removed[j]) continue;
      visited[j] = 1;
      queue[end++] = j;
      for (let channel = 0; channel < 3; channel++)
        output[j * 4 + channel] = output[i * 4 + channel];
    }
  }
  // Unreachable hair (e.g. no background) is left intact rather than replaced with black.
  for (let pass = 0; pass < PHOTO_CONFIG.repairSmoothPasses; pass++) {
    const previous = output.slice();
    for (let i = 0; i < size; i++)
      if (removed[i] && visited[i]) {
        const near = neighbors(i).filter((j) => j >= 0 && visited[j]);
        for (let channel = 0; channel < 3; channel++)
          output[i * 4 + channel] =
            near.reduce((sum, j) => sum + previous[j * 4 + channel], 0) / near.length;
      }
  }
  let repaired = 0;
  for (let i = 0; i < size; i++) {
    if (removed[i] && visited[i]) repaired++;
    else removed[i] = 0;
  }
  return { pixels: output, removed, coverage: count ? repaired / count : 0, hairPixels: count };
}
