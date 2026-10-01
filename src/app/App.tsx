import { useRef, useState } from 'react';
import { CameraView } from '../components/CameraView';
import { CameraControls } from '../components/CameraControls';
import { ItemTypeSelector } from '../components/ItemTypeSelector';
import { UploadPanel } from '../components/UploadPanel';
import { CalibrationPanel } from '../components/CalibrationPanel';
import { CapturePanel } from '../components/CapturePanel';
import { StatusPanel } from '../components/StatusPanel';
import { DebugOverlay } from '../components/DebugOverlay';
import { useCamera } from '../hooks/useCamera';
import { useUploadedAsset } from '../hooks/useUploadedAsset';
import { useVision } from '../hooks/useVision';
import { useTryOnEngine } from '../hooks/useTryOnEngine';
import { DEFAULT_CALIBRATION } from '../config/tryOnConfig';
import type { CalibrationState, TryOnItemType } from '../vision/types';
export default function App() {
  const [mode, setMode] = useState<TryOnItemType>('hairstyle');
  const [calibration, setCalibration] = useState<Record<TryOnItemType, CalibrationState>>({
    hairstyle: { ...DEFAULT_CALIBRATION },
    top: { ...DEFAULT_CALIBRATION },
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(),
    uploaded = useUploadedAsset();
  const active = camera.status === 'ready';
  const vision = useVision(camera.videoRef, active, mode);
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';
  const asset = uploaded.assets[mode] ?? null;
  const engine = useTryOnEngine({
    videoRef: camera.videoRef,
    canvasRef,
    result: vision.result,
    inferenceFps: vision.inferenceFps,
    enabled: active,
    mode,
    asset,
    calibration: calibration[mode],
    debug,
  });
  return (
    <div className="page-shell">
      <header className="site-header">
        <a href="./" className="wordmark">
          FITTING<span>ROOM</span>
          <i aria-hidden="true">↗</i>
        </a>
        <span className="local-badge">
          <span aria-hidden="true">◈</span> LOCAL ONLY
        </span>
      </header>
      <main>
        <div className="intro">
          <p className="eyebrow">A LITTLE CHANGE, A NEW YOU.</p>
          <h1>
            換個樣子，
            <br className="mobile-break" />
            <span>看看自己。</span>
          </h1>
          <p>即時虛擬試穿 · 你的私人試衣間</p>
        </div>
        <div className="workspace">
          <section className="preview-section" aria-label="相機試穿">
            <div className="preview-label">
              <span>LIVE PREVIEW</span>
              <span>前鏡頭 · 鏡像</span>
            </div>
            <CameraView videoRef={camera.videoRef} canvasRef={canvasRef} status={camera.status}>
              <div className="camera-corner top-left" />
              <div className="camera-corner bottom-right" />
              <span className="camera-mode">
                {mode === 'hairstyle' ? 'HAIR STUDIO' : 'WARDROBE'}
              </span>
              {debug && <DebugOverlay stats={engine.stats} />}
            </CameraView>
            <CameraControls
              status={camera.status}
              start={() => void camera.start()}
              stop={camera.stop}
            />
          </section>
          <aside className="control-section">
            <div className="section-heading">
              <h2>選擇你的新造型</h2>
              <span className="step-number">01 — 03</span>
            </div>
            <ItemTypeSelector mode={mode} onChange={setMode} />
            <UploadPanel
              mode={mode}
              asset={asset}
              upload={uploaded.upload}
              clear={uploaded.clear}
              loading={uploaded.loading}
              error={uploaded.error}
            />
            <StatusPanel
              cameraReady={active}
              state={vision.state}
              mode={mode}
              faceCount={engine.stats.faceCount}
              poseDetected={engine.stats.poseDetected}
              error={camera.error || vision.error || engine.error}
              retry={vision.retry}
            />
            <CalibrationPanel
              value={calibration[mode]}
              onChange={(value) => setCalibration((previous) => ({ ...previous, [mode]: value }))}
              disabled={!asset}
            />
            <CapturePanel capture={engine.capture} enabled={active} />
            <p className="session-note">
              不留歷史，只留你喜歡的樣子。
              <br />
              重新整理頁面後，圖片與結果會清除。
            </p>
          </aside>
        </div>
      </main>
      <footer>
        <span className="privacy-icon" aria-hidden="true">
          ♧
        </span>
        <p>相機影像與上傳圖片僅在目前裝置進行即時處理，不會自動上傳。</p>
        <span className="footer-brand">PRIVATE BY DESIGN.</span>
      </footer>
    </div>
  );
}
