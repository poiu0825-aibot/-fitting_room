import { PHOTO_CONFIG } from './config';
import type { PhotoAnalysis, PhotoResponse } from './types';
export class PhotoAnalyser {
  private worker: Worker;
  private ready: Promise<void>;
  private rejectPending: ((reason: Error) => void) | null = null;
  private cancelReady: () => void;
  private closed = false;
  constructor() {
    if (
      typeof Worker === 'undefined' ||
      typeof OffscreenCanvas === 'undefined' ||
      typeof createImageBitmap === 'undefined'
    )
      throw new Error('此瀏覽器不支援本機照片處理，請更新 Safari 或 Chrome。');
    const baseUrl = new URL(import.meta.env.BASE_URL, location.href);
    this.worker = new Worker(new URL('vision/photo.worker.js', baseUrl));
    this.cancelReady = () => {};
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('照片模型載入逾時，請重試。'));
        this.worker.terminate();
      }, PHOTO_CONFIG.modelTimeoutMs);
      this.cancelReady = () => {
        clearTimeout(timer);
        reject(new Error('處理已取消。'));
      };
      this.worker.onmessage = ({ data }: MessageEvent<PhotoResponse>) => {
        clearTimeout(timer);
        if (data.kind === 'ready') resolve();
        else reject(new Error(data.kind === 'error' ? data.message : '模型回應錯誤。'));
      };
      this.worker.onerror = () => {
        clearTimeout(timer);
        reject(new Error('照片處理無法啟動，請更新瀏覽器。'));
      };
    });
    // The caller may close the studio before awaiting initialization.
    void this.ready.catch(() => {});
    this.worker.postMessage({ kind: 'init', baseUrl: baseUrl.href });
  }
  async analyse(image: ImageBitmap): Promise<PhotoAnalysis> {
    await this.ready;
    if (this.closed) throw new Error('處理已取消。');
    const scale = Math.min(1, PHOTO_CONFIG.inferenceMaxSide / Math.max(image.width, image.height));
    const frame = await createImageBitmap(image, {
      resizeWidth: Math.round(image.width * scale),
      resizeHeight: Math.round(image.height * scale),
    });
    if (this.closed) {
      frame.close();
      throw new Error('處理已取消。');
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.worker.terminate();
        this.closed = true;
        reject(new Error('照片分析逾時，請改用較小照片後重試。'));
      }, PHOTO_CONFIG.modelTimeoutMs);
      this.rejectPending = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      this.worker.onmessage = ({ data }: MessageEvent<PhotoResponse>) => {
        clearTimeout(timer);
        this.rejectPending = null;
        if (data.kind === 'result') resolve(data.result);
        else reject(new Error(data.kind === 'error' ? data.message : '分析回應錯誤。'));
      };
      this.worker.onerror = () => {
        clearTimeout(timer);
        this.rejectPending = null;
        reject(new Error('照片處理失敗，請重試。'));
      };
      this.worker.postMessage({ kind: 'analyse', frame }, [frame]);
    });
  }
  close() {
    this.closed = true;
    this.cancelReady();
    this.rejectPending?.(new Error('處理已取消。'));
    this.worker.terminate();
  }
}
