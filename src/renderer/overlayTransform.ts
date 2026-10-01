import type {
  CalibrationState,
  FaceTransform,
  PoseTransform,
  TryOnTransform,
} from '../vision/types';
import { TRY_ON } from '../config/tryOnConfig';
export function hairstyleTransform(face: FaceTransform, aspect: number): TryOnTransform {
  const width = face.width * TRY_ON.face.widthMultiplier;
  const offset = face.height * TRY_ON.face.verticalOffset;
  return {
    x: face.centerX - Math.sin(face.rotation) * offset,
    y: face.centerY + Math.cos(face.rotation) * offset,
    width,
    height: width / aspect,
    rotation: face.rotation,
  };
}
export function garmentTransform(pose: PoseTransform, aspect: number): TryOnTransform {
  const width = pose.torsoWidth * TRY_ON.garment.widthMultiplier;
  return {
    x: pose.torsoCenter.x,
    y: pose.torsoCenter.y + pose.torsoHeight * TRY_ON.garment.verticalOffset,
    width,
    height: width / aspect,
    rotation: pose.rotation,
  };
}
// Offsets use viewport pixels; rotation is in radians. Calibration never alters landmarks.
export function mergeCalibration(
  auto: TryOnTransform,
  calibration: CalibrationState,
): TryOnTransform {
  return {
    x: auto.x + calibration.offsetX,
    y: auto.y + calibration.offsetY,
    width: auto.width * calibration.scale,
    height: auto.height * calibration.scale,
    rotation: auto.rotation + calibration.rotation,
  };
}
