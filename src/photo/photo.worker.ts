import { FaceLandmarker, ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import type { PhotoRequest, PhotoResponse } from './types';
let face: FaceLandmarker;
let segmenter: ImageSegmenter;
const send = (data: PhotoResponse, transfer: Transferable[] = []) =>
  self.postMessage(data, { transfer });
self.onmessage = async ({ data }: MessageEvent<PhotoRequest>) => {
  if (data.kind === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(`${data.baseUrl}vision/wasm`);
      face = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${data.baseUrl}vision/face_landmarker.task`,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numFaces: 2,
      });
      segmenter = await ImageSegmenter.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${data.baseUrl}vision/selfie_multiclass.tflite`,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      });
      const labels = segmenter.getLabels();
      if (labels.length !== 6 || !labels[1].toLowerCase().includes('hair'))
        throw new Error('Unsupported label map');
      send({ kind: 'ready' });
    } catch {
      send({ kind: 'error', message: '照片處理模型載入失敗，請確認網路後重試。' });
    }
    return;
  }
  try {
    const detected = face.detect(data.frame);
    segmenter.segment(data.frame, (output) => {
      const categories = output.categoryMask!.getAsUint8Array().slice();
      const hairConfidence = output.confidenceMasks![1].getAsFloat32Array().slice();
      send(
        {
          kind: 'result',
          result: {
            landmarks: detected.faceLandmarks[0] ?? [],
            faceCount: detected.faceLandmarks.length,
            width: output.categoryMask!.width,
            height: output.categoryMask!.height,
            categories,
            hairConfidence,
          },
        },
        [categories.buffer, hairConfidence.buffer],
      );
    });
  } catch {
    send({ kind: 'error', message: '無法分析這張照片，請改用清晰的正面照片。' });
  } finally {
    data.frame.close();
  }
};
