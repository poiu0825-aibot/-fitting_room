import type { TryOnAsset, TryOnTransform } from '../vision/types';
import { drawCamera, type Viewport } from './coordinateUtils';
import { drawHairstyle } from './hairstyleRenderer';
import { drawGarment } from './garmentRenderer';
export function composite(
  ctx: CanvasRenderingContext2D,
  camera: CanvasImageSource,
  view: Viewport,
  asset: TryOnAsset | null,
  transform: TryOnTransform | null,
) {
  ctx.clearRect(0, 0, view.width, view.height);
  drawCamera(ctx, camera, view);
  if (asset && transform)
    (asset.type === 'hairstyle' ? drawHairstyle : drawGarment)(ctx, asset, transform);
}
