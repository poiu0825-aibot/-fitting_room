import type { TryOnItemType, VisionState } from '../vision/types';
export function StatusPanel({
  cameraReady,
  state,
  mode,
  faceCount,
  poseDetected,
  error,
  retry,
}: {
  cameraReady: boolean;
  state: VisionState;
  mode: TryOnItemType;
  faceCount: number;
  poseDetected: boolean;
  error: string;
  retry: () => void;
}) {
  let message = '準備好後，開啟相機並上傳一張圖片。';
  if (cameraReady) {
    if (state === 'loading') message = '正在載入本機追蹤模型…';
    else if (state === 'ready')
      message =
        mode === 'hairstyle'
          ? faceCount > 1
            ? '偵測到多張臉，請保留一人入鏡。'
            : faceCount === 1
              ? '已偵測到臉部，可微調髮型位置。'
              : '請將臉部放在畫面中央，並保持光線充足。'
          : poseDetected
            ? '已偵測到肩膀與軀幹，可微調上衣位置。'
            : '請稍微後退，讓肩膀與腰部完整入鏡。';
  }
  return (
    <div className={`status-panel ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'}>
      <span aria-hidden="true">{error ? '!' : '◎'}</span>
      <p>{error || message}</p>
      {state === 'error' && cameraReady && <button onClick={retry}>重試模型</button>}
    </div>
  );
}
