export type TryOnItemType = 'hairstyle' | 'top';
export interface Point {
  x: number;
  y: number;
}
export interface Landmark extends Point {
  z?: number;
  visibility?: number;
}
export interface FaceTransform {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  eyeDistance: number;
  rotation: number;
  scale: number;
}
export interface PoseTransform {
  leftShoulder: Point;
  rightShoulder: Point;
  leftHip: Point;
  rightHip: Point;
  torsoCenter: Point;
  torsoWidth: number;
  torsoHeight: number;
  rotation: number;
}
export interface CalibrationState {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}
export interface TryOnTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
export type HairstyleTransform = TryOnTransform;
export type GarmentTransform = TryOnTransform;
export interface TryOnAsset {
  image: ImageBitmap;
  width: number;
  height: number;
  name: string;
  type: TryOnItemType;
}
export type GarmentAsset = TryOnAsset & { type: 'top' };
export interface VisionResult {
  face: Landmark[];
  pose: Landmark[];
  faceCount: number;
  elapsedMs: number;
  timestamp: number;
}
export type VisionState = 'idle' | 'loading' | 'ready' | 'error';
export type WorkerRequest =
  | { kind: 'init'; mode: TryOnItemType; baseUrl: string }
  | { kind: 'frame'; frame: ImageBitmap; timestamp: number };
export type WorkerResponse =
  { kind: 'ready' } | { kind: 'error'; message: string } | { kind: 'result'; result: VisionResult };
