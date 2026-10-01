export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('無法產生照片，請重新拍攝。'))),
      'image/png',
    ),
  );
}
export function downloadImage(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `fitting-room-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
