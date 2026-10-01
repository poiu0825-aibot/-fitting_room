import { useCallback, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { configureCanvas, drawCamera } from '../renderer/coordinateUtils';
import { usePhotoStudio } from '../photo/usePhotoStudio';
import { downloadImage } from '../services/imageExporter';
import { CameraView } from './CameraView';
import { CameraControls } from './CameraControls';
import { CalibrationPanel } from './CalibrationPanel';
export function PhotoStudio() {
  const studio = usePhotoStudio(),
    camera = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null),
    photoInput = useRef<HTMLInputElement>(null),
    hairInput = useRef<HTMLInputElement>(null);
  const [showOriginal, setShowOriginal] = useState(false),
    [snapshotError, setSnapshotError] = useState('');
  const active = camera.status === 'ready';
  const draw = useCallback(() => {
    const canvas = canvasRef.current,
      video = camera.videoRef.current;
    if (!canvas || !video?.videoWidth || video.readyState < 2) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ctx = configureCanvas(
      canvas,
      rect.width,
      rect.height,
      Math.min(window.devicePixelRatio || 1, 2),
    );
    if (ctx)
      drawCamera(ctx, video, {
        sourceWidth: video.videoWidth,
        sourceHeight: video.videoHeight,
        width: rect.width,
        height: rect.height,
        mirror: true,
      });
  }, [camera.videoRef]);
  useAnimationFrame(draw, active);
  const takePhoto = async () => {
    setSnapshotError('');
    try {
      if (!canvasRef.current || !active || !camera.videoRef.current?.videoWidth)
        throw new Error('請等相機畫面出現再拍照。');
      draw();
      const image = await createImageBitmap(canvasRef.current);
      camera.stop();
      setShowOriginal(false);
      await studio.setPhoto(image);
    } catch {
      setSnapshotError('拍照失敗，請重新開啟相機或選擇照片。');
    }
  };
  const error = studio.error || (camera.status === 'error' ? camera.error : '') || snapshotError;
  return (
    <section className="photo-studio" aria-label="本機照片換髮型">
      <p className="photo-notice">
        照片版試用：使用正面、光線充足、背景簡單的照片。原頭髮由本機分割與補色處理，無法還原被遮住的真實細節；效果需自行檢查。
      </p>
      <div className="workspace">
        <div className="preview-section">
          <div className="preview-label">
            <span>{studio.resultUrl && !active ? 'PHOTO RESULT' : 'PORTRAIT'}</span>
            <span>只在本機處理</span>
          </div>
          <div hidden={!!studio.portraitUrl && !active && camera.status !== 'requesting'}>
            <CameraView videoRef={camera.videoRef} canvasRef={canvasRef} status={camera.status}>
              <span className="camera-mode">正對鏡頭 · 拍照後處理</span>
            </CameraView>
          </div>
          {studio.portraitUrl && !active && camera.status !== 'requesting' && (
            <div className="photo-result">
              <img
                src={!showOriginal && studio.resultUrl ? studio.resultUrl : studio.portraitUrl}
                alt={showOriginal || !studio.resultUrl ? '原始人像照片' : '本機換髮型合成結果'}
              />
            </div>
          )}
          {studio.resultUrl && !active && (
            <div className="mode-selector" role="group" aria-label="前後對照">
              <button aria-pressed={showOriginal} onClick={() => setShowOriginal(true)}>
                原始照片
              </button>
              <button aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)}>
                換髮型結果
              </button>
            </div>
          )}
          {!studio.busy && (
            <CameraControls
              status={camera.status}
              start={() => {
                setSnapshotError('');
                void camera.start();
              }}
              stop={camera.stop}
            />
          )}
          {active && (
            <button
              className="capture-button"
              disabled={studio.busy}
              onClick={() => void takePhoto()}
            >
              拍下正面照片
            </button>
          )}
        </div>
        <aside className="control-section">
          <h2>拍照，再換個髮型</h2>
          <input
            ref={photoInput}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="選擇人像照片"
            disabled={studio.busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                camera.stop();
                setShowOriginal(false);
                void studio.uploadPhoto(file);
              }
              event.target.value = '';
            }}
          />
          <input
            ref={hairInput}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="選擇新髮型圖片"
            disabled={studio.busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void studio.uploadHair(file);
              event.target.value = '';
            }}
          />
          <button
            className="upload-button"
            disabled={studio.busy}
            onClick={() => photoInput.current?.click()}
          >
            1. {studio.portrait ? '更換人像照片' : '選擇人像照片'}
            <small>或用左側／上方相機拍攝</small>
          </button>
          <button
            className="upload-button"
            disabled={studio.busy}
            onClick={() => hairInput.current?.click()}
          >
            2. {studio.hair ? '更換新髮型' : '選擇新髮型'}
            <small>透明髮型 PNG / WEBP，或參考人像</small>
          </button>
          {studio.hairUrl && studio.hair && (
            <div className="hair-anchor-panel">
              <p>
                點選圖片中的<strong>髮際線中心</strong>，對準額頭上緣。
              </p>
              <div className="hair-anchor-image">
                <img
                  src={studio.hairUrl}
                  alt="新髮型與髮際線錨點"
                  draggable={false}
                  onClick={(event) => {
                    if (studio.busy) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    studio.setAnchor(
                      (event.clientX - rect.left) / rect.width,
                      (event.clientY - rect.top) / rect.height,
                    );
                  }}
                />
                <span
                  className="anchor-cross"
                  style={{
                    left: `${studio.hair.anchor.x * 100}%`,
                    top: `${studio.hair.anchor.y * 100}%`,
                  }}
                  aria-hidden="true"
                >
                  ＋
                </span>
              </div>
              <label>
                髮際線左右
                <input
                  aria-label="髮際線左右"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={studio.hair.anchor.x}
                  disabled={studio.busy}
                  onChange={(e) => studio.setAnchor(Number(e.target.value), studio.hair!.anchor.y)}
                />
              </label>
              <label>
                髮際線上下
                <input
                  aria-label="髮際線上下"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={studio.hair.anchor.y}
                  disabled={studio.busy}
                  onChange={(e) => studio.setAnchor(studio.hair!.anchor.x, Number(e.target.value))}
                />
              </label>
            </div>
          )}
          <button
            className="capture-button"
            disabled={!studio.portrait || !studio.hair || studio.busy}
            onClick={() => {
              camera.stop();
              setShowOriginal(false);
              void studio.process();
            }}
          >
            {studio.busy ? '正在本機處理…' : '3. 分析照片並合成'}
          </button>
          <p className="hint" role="status">
            {studio.rendering
              ? '正在更新合成預覽…'
              : studio.status || '你的照片與參考圖片都不會上傳。'}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {studio.analysis && (
            <>
              <CalibrationPanel
                value={studio.calibration}
                onChange={studio.setCalibration}
                disabled={studio.busy}
              />
              <label className="photo-adjust">
                舊髮處理強度
                <input
                  aria-label="舊髮處理強度"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={studio.removal}
                  onChange={(e) => studio.setRemoval(Number(e.target.value))}
                />
              </label>
              <label className="photo-adjust">
                新髮亮度
                <input
                  aria-label="新髮亮度"
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={studio.brightness}
                  onChange={(e) => studio.setBrightness(Number(e.target.value))}
                />
              </label>
              <p className="hint">
                舊髮補色可能出現模糊或背景痕跡，特別是長髮改短髮。可降低處理強度或更換照片。
              </p>
            </>
          )}
          {studio.resultUrl && (
            <button
              className="capture-button"
              disabled={studio.busy || studio.rendering}
              onClick={() => downloadImage(studio.resultUrl)}
            >
              儲存換髮型結果
            </button>
          )}
          {(studio.portrait || studio.hair) && (
            <button
              disabled={studio.busy}
              onClick={() => {
                camera.stop();
                studio.reset();
                setShowOriginal(false);
              }}
            >
              清除本次照片與髮型
            </button>
          )}
          <p className="session-note">不保留歷史。重新整理或離開此流程後，照片與結果會清除。</p>
        </aside>
      </div>
    </section>
  );
}
