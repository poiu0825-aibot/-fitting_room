import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
export const createPoseLandmarker = (
  files: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  baseUrl: string,
) =>
  PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: `${baseUrl}vision/pose_landmarker_lite.task`, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
  });
