// Extension point for a future browser-only processor. No remote implementation.
export interface BackgroundRemover {
  removeBackground(image: ImageBitmap): Promise<ImageBitmap>;
}
export async function processAsset(image: ImageBitmap, remover?: BackgroundRemover) {
  return remover ? remover.removeBackground(image) : image;
}
