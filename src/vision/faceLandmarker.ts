import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
export const createFaceLandmarker = (
  files: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  baseUrl: string,
) =>
  FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: `${baseUrl}vision/face_landmarker.task`, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numFaces: 2,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
  });
