import type { Point } from '../vision/types';
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const angleDelta = (from: number, to: number) => normalizeAngle(to - from);
// An undirected line has the same tilt whichever endpoint appears first.
export const lineRotation = (a: Point, b: Point) =>
  normalizeAngle(Math.atan2(b.y - a.y, b.x - a.x) * 2) / 2;
