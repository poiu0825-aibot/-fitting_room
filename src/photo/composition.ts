import { PHOTO_CONFIG } from './config';
import { alphaBounds, resizedMaskIndex } from './pixels';
import type { HairAsset, PhotoAnalysis } from './types';
import type { CalibrationState, Point } from '../vision/types';
import { distance, lineRotation, midpoint } from '../utils/math';
import { normalizedToCanvas } from '../renderer/coordinateUtils';
export function photoCanvas(image: ImageBitmap, maxSide: number = PHOTO_CONFIG.photoMaxSide) {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('此瀏覽器不支援照片合成。');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
export function validatePortrait(analysis: PhotoAnalysis) {
  if (analysis.faceCount !== 1 || analysis.landmarks.length < 455)
    throw new Error(
      analysis.faceCount > 1
        ? '請使用只有一人的正面照片。'
        : '沒有找到清晰臉部，請用正面、光線充足的照片。',
    );
  const points = analysis.landmarks;
  const ratio =
    Math.abs((points[234].z ?? 0) - (points[454].z ?? 0)) /
    Math.max(0.001, Math.abs(points[234].x - points[454].x));
  if (ratio > PHOTO_CONFIG.maxProfileRatio)
    throw new Error('這張照片側臉角度太大，請正對鏡頭重新拍攝。');
}
export function photoAnchors(analysis: PhotoAnalysis, width: number, height: number) {
  const view = { sourceWidth: width, sourceHeight: height, width, height, mirror: false };
  const at = (i: number) => normalizedToCanvas(analysis.landmarks[i], view);
  return {
    forehead: at(10),
    width: distance(at(234), at(454)),
    rotation: lineRotation(at(33), at(263)),
    eyeY: midpoint(at(33), at(263)).y,
  };
}
export async function makeHairAsset(
  image: ImageBitmap,
  analysis?: PhotoAnalysis,
): Promise<HairAsset> {
  const canvas = photoCanvas(image),
    ctx = canvas.getContext('2d')!;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let reference: ReturnType<typeof photoAnchors> | null = null;
  if (analysis) {
    if (analysis.faceCount === 1) reference = photoAnchors(analysis, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const index = resizedMaskIndex(
          x,
          y,
          canvas.width,
          canvas.height,
          analysis.width,
          analysis.height,
        );
        pixels.data[(y * canvas.width + x) * 4 + 3] *= Math.max(
          0,
          Math.min(
            1,
            (analysis.hairConfidence[index] - PHOTO_CONFIG.extractionMin) /
              (PHOTO_CONFIG.extractionFull - PHOTO_CONFIG.extractionMin),
          ),
        );
      }
    ctx.putImageData(pixels, 0, 0);
  }
  const bounds = alphaBounds(pixels.data, canvas.width, canvas.height);
  if (!bounds || bounds.width * bounds.height < PHOTO_CONFIG.minimumHairArea)
    throw new Error('沒有找到可用髮型。請選透明髮型 PNG / WEBP，或清晰的參考人像。');
  const cropped = await createImageBitmap(canvas, bounds.x, bounds.y, bounds.width, bounds.height);
  const anchor: Point = reference
    ? {
        x: (reference.forehead.x - bounds.x) / bounds.width,
        y: (reference.forehead.y - bounds.y) / bounds.height,
      }
    : { ...PHOTO_CONFIG.defaultAnchor };
  return {
    image: cropped,
    anchor,
    faceWidthRatio: reference ? reference.width / bounds.width : PHOTO_CONFIG.defaultFaceWidthRatio,
    extracted: !!analysis,
  };
}
export function hasTransparency(image: ImageBitmap) {
  const canvas = photoCanvas(image, PHOTO_CONFIG.repairMaxSide),
    pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;
  for (let i = 3; i < pixels.length; i += 4)
    if (pixels[i] < PHOTO_CONFIG.alphaThreshold) transparent++;
  return transparent / (pixels.length / 4) > PHOTO_CONFIG.transparentFraction;
}
function faceProtection(analysis: PhotoAnalysis, width: number, height: number) {
  const oval = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
    148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  ];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  oval.forEach((index, i) => {
    const point = analysis.landmarks[index];
    if (i === 0) ctx.moveTo(point.x * width, point.y * height);
    else ctx.lineTo(point.x * width, point.y * height);
  });
  ctx.closePath();
  ctx.fill();
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const protectedPixels = new Uint8Array(width * height),
    anchors = photoAnchors(analysis, width, height);
  const a = analysis.landmarks[33],
    b = analysis.landmarks[263];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!pixels[i * 4 + 3]) continue;
      const eyeLine =
        a.y * height + ((x - a.x * width) * (b.y - a.y) * height) / ((b.x - a.x) * width || 1);
      if (y > eyeLine - anchors.width * PHOTO_CONFIG.faceProtectionMargin) protectedPixels[i] = 1;
    }
  return protectedPixels;
}
export function prepareRepair(original: HTMLCanvasElement, analysis: PhotoAnalysis) {
  const protectedFace = faceProtection(analysis, original.width, original.height);
  return { protectedFace };
}

export function composePhoto(
  original: HTMLCanvasElement,
  analysis: PhotoAnalysis,
  repair: ReturnType<typeof prepareRepair>,
  hair: HairAsset,
  calibration: CalibrationState,
  brightness: number,
) {
  const width = original.width,
    height = original.height,
    anchor = photoAnchors(analysis, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(original, 0, 0);
  // Preserve the original hair and background; background reconstruction is unsupported.
  const newWidth = (anchor.width / Math.max(0.1, hair.faceWidthRatio)) * calibration.scale,
    newHeight = (newWidth * hair.image.height) / hair.image.width;
  ctx.save();
  ctx.translate(anchor.forehead.x + calibration.offsetX, anchor.forehead.y + calibration.offsetY);
  ctx.rotate(anchor.rotation + calibration.rotation);
  ctx.filter = `brightness(${brightness})`;
  ctx.drawImage(
    hair.image,
    -hair.anchor.x * newWidth,
    -hair.anchor.y * newHeight,
    newWidth,
    newHeight,
  );
  ctx.restore();
  // Preserve facial identity and eyewear below the eyebrows; leave the forehead open for bangs.
  const result = ctx.getImageData(0, 0, width, height),
    source = original.getContext('2d')!.getImageData(0, 0, width, height);
  const eyeA = analysis.landmarks[33],
    eyeB = analysis.landmarks[263];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = resizedMaskIndex(x, y, width, height, analysis.width, analysis.height),
        label = analysis.categories[index];
      const eyeLine =
        eyeA.y * height +
        ((x - eyeA.x * width) * (eyeB.y - eyeA.y) * height) / ((eyeB.x - eyeA.x) * width || 1);
      if (
        repair.protectedFace[y * width + x] ||
        ((label === 3 || label === 5) &&
          y > eyeLine - anchor.width * PHOTO_CONFIG.faceProtectionMargin)
      ) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 4; c++) result.data[i + c] = source.data[i + c];
      }
    }
  ctx.putImageData(result, 0, 0);
  return canvas;
}
