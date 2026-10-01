import type { Landmark, Point } from '../vision/types';
export interface PhotoAnalysis {
  landmarks: Landmark[];
  faceCount: number;
  width: number;
  height: number;
  categories: Uint8Array;
  hairConfidence: Float32Array;
}
export interface HairAsset {
  image: ImageBitmap;
  anchor: Point;
  faceWidthRatio: number;
  extracted: boolean;
}
export type PhotoRequest =
  { kind: 'init'; baseUrl: string } | { kind: 'analyse'; frame: ImageBitmap };
export type PhotoResponse =
  | { kind: 'ready' }
  | { kind: 'result'; result: PhotoAnalysis }
  | { kind: 'error'; message: string };
