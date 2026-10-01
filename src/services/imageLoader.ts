import { TRY_ON } from '../config/tryOnConfig';
const supported = new Set(['image/png', 'image/jpeg', 'image/webp']);
export async function loadLocalImage(file: File): Promise<ImageBitmap> {
  if (!supported.has(file.type)) throw new Error('請選擇 PNG、JPG 或 WEBP 圖片。');
  if (file.size > TRY_ON.maxImageBytes) throw new Error('圖片太大，請選擇 15 MB 以下的圖片。');
  let original: ImageBitmap;
  try {
    original = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('無法讀取此圖片，請選擇其他 PNG、JPG 或 WEBP。');
  }
  if (original.width * original.height > TRY_ON.maxImagePixels) {
    original.close();
    throw new Error('圖片解析度太高，請縮小後重試。');
  }
  const scale = Math.min(1, TRY_ON.maxImageSide / Math.max(original.width, original.height));
  if (scale === 1) return original;
  try {
    return await createImageBitmap(original, {
      resizeWidth: Math.round(original.width * scale),
      resizeHeight: Math.round(original.height * scale),
      resizeQuality: 'high',
    });
  } finally {
    original.close();
  }
}
