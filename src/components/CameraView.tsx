import type { ReactNode, RefObject } from 'react';
import type { CameraStatus } from '../hooks/useCamera';
export function CameraView({
  videoRef,
  canvasRef,
  status,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  children: ReactNode;
}) {
  return (
    <div className="camera-view">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="camera-source"
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="try-on-canvas" aria-label="鏡像相機與即時試穿畫面" />
      {status !== 'ready' && (
        <div className="camera-placeholder">
          <div className="face-guide">
            <span />
          </div>
          <p>{status === 'requesting' ? '等待相機權限…' : '你的鏡頭，你的試衣間'}</p>
          <span>開啟前鏡頭，開始探索新的樣子。</span>
        </div>
      )}
      {children}
    </div>
  );
}
