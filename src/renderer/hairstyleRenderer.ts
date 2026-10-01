import type { TryOnAsset, TryOnTransform } from '../vision/types';
export function drawAsset(
  ctx: CanvasRenderingContext2D,
  asset: TryOnAsset,
  transform: TryOnTransform,
) {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.rotate(transform.rotation);
  ctx.drawImage(
    asset.image,
    -transform.width / 2,
    -transform.height / 2,
    transform.width,
    transform.height,
  );
  ctx.restore();
}
export { drawAsset as drawHairstyle };
