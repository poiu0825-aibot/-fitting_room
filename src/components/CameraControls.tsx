import type { CameraStatus } from '../hooks/useCamera';
export function CameraControls({
  status,
  start,
  stop,
}: {
  status: CameraStatus;
  start: () => void;
  stop: () => void;
}) {
  return (
    <div className="camera-controls">
      <span className={`status-dot ${status === 'ready' ? 'active' : ''}`} />
      <span>
        {status === 'ready' ? '相機已開啟' : status === 'requesting' ? '等待授權' : '相機未開啟'}
      </span>
      <button onClick={status === 'ready' || status === 'requesting' ? stop : start}>
        {status === 'ready' || status === 'requesting'
          ? '關閉相機'
          : status === 'error'
            ? '重新啟動'
            : '開啟相機'}
      </button>
    </div>
  );
}
