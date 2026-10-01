import { expect, it, vi } from 'vitest';
import { composite } from '../src/renderer/compositor';
import type { TryOnAsset } from '../src/vision/types';
it('composites mirrored camera and calibrated overlay with isolated transforms', () => {
  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
  };
  const video = {} as CanvasImageSource,
    image = {} as ImageBitmap;
  const asset: TryOnAsset = {
    image,
    width: 200,
    height: 100,
    name: 'synthetic',
    type: 'hairstyle',
  };
  composite(
    ctx as unknown as CanvasRenderingContext2D,
    video,
    { sourceWidth: 640, sourceHeight: 480, width: 320, height: 240, mirror: true },
    asset,
    { x: 100, y: 80, width: 200, height: 100, rotation: 0.2 },
  );
  expect(ctx.drawImage.mock.calls).toEqual([
    [video, 0, 0, 320, 240],
    [image, -100, -50, 200, 100],
  ]);
  expect(ctx.scale).toHaveBeenCalledExactlyOnceWith(-1, 1);
  expect(ctx.rotate).toHaveBeenCalledWith(0.2);
  expect(ctx.save).toHaveBeenCalledTimes(2);
  expect(ctx.restore).toHaveBeenCalledTimes(2);
});
it('keeps camera visible when detection is lost', () => {
  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
  };
  composite(
    ctx as unknown as CanvasRenderingContext2D,
    {} as CanvasImageSource,
    { sourceWidth: 640, sourceHeight: 480, width: 320, height: 240, mirror: false },
    null,
    null,
  );
  expect(ctx.drawImage).toHaveBeenCalledTimes(1);
});
