import { FilesetResolver, type FaceLandmarker, type PoseLandmarker } from '@mediapipe/tasks-vision';
import { createFaceLandmarker } from './faceLandmarker';
import { createPoseLandmarker } from './poseLandmarker';
import type { WorkerRequest, WorkerResponse } from './types';
let face: FaceLandmarker | null = null;
let pose: PoseLandmarker | null = null;
const send = (message: WorkerResponse) => self.postMessage(message);
self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.kind === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(`${data.baseUrl}vision/wasm`);
      if (data.mode === 'hairstyle') face = await createFaceLandmarker(files, data.baseUrl);
      else pose = await createPoseLandmarker(files, data.baseUrl);
      send({ kind: 'ready' });
    } catch {
      send({ kind: 'error', message: '本機追蹤模型載入失敗，請確認網頁資源完整後重試。' });
    }
    return;
  }
  const start = performance.now();
  try {
    const faces = face?.detectForVideo(data.frame, data.timestamp);
    const poses = pose?.detectForVideo(data.frame, data.timestamp);
    send({
      kind: 'result',
      result: {
        face: faces?.faceLandmarks[0] ?? [],
        pose: poses?.landmarks[0] ?? [],
        faceCount: faces?.faceLandmarks.length ?? 0,
        elapsedMs: performance.now() - start,
        timestamp: data.timestamp,
      },
    });
  } catch {
    send({ kind: 'error', message: '本機追蹤暫時無法運作，請重新啟動相機。' });
  } finally {
    data.frame.close();
  }
};
