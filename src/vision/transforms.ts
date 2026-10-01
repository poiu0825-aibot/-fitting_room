import type { FaceTransform, Landmark, PoseTransform } from './types';
import { normalizedToCanvas, type Viewport } from '../renderer/coordinateUtils';
import { distance, midpoint, lineRotation } from '../utils/math';
import { TRY_ON } from '../config/tryOnConfig';
export function faceFromLandmarks(raw: Landmark[], view: Viewport): FaceTransform | null {
  if (raw.length < 455) return null;
  const at = (i: number) => normalizedToCanvas(raw[i], view);
  const left = at(234),
    right = at(454),
    top = at(10),
    chin = at(152);
  const eyeA = at(33),
    eyeB = at(263),
    center = midpoint(top, chin);
  const width = distance(left, right),
    height = distance(top, chin),
    eyeDistance = distance(eyeA, eyeB);
  if (width < 1 || height < 1 || eyeDistance < 1) return null;
  return {
    centerX: center.x,
    centerY: center.y,
    width,
    height,
    eyeDistance,
    rotation: lineRotation(eyeA, eyeB),
    scale: eyeDistance / (view.width * TRY_ON.face.eyeReference),
  };
}
export function poseFromLandmarks(raw: Landmark[], view: Viewport): PoseTransform | null {
  if (
    raw.length < 25 ||
    [11, 12, 23, 24].some((i) => (raw[i].visibility ?? 0) < TRY_ON.minVisibility)
  )
    return null;
  const at = (i: number) => normalizedToCanvas(raw[i], view);
  const leftShoulder = at(11),
    rightShoulder = at(12),
    leftHip = at(23),
    rightHip = at(24);
  const shoulders = midpoint(leftShoulder, rightShoulder),
    hips = midpoint(leftHip, rightHip);
  const torsoWidth = distance(leftShoulder, rightShoulder),
    torsoHeight = distance(shoulders, hips);
  if (torsoWidth < 1 || torsoHeight < 1) return null;
  return {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    torsoCenter: midpoint(shoulders, hips),
    torsoWidth,
    torsoHeight,
    rotation: lineRotation(leftShoulder, rightShoulder),
  };
}
