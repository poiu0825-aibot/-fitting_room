import type { EngineStats } from '../hooks/useTryOnEngine';
export function DebugOverlay({ stats }: { stats: EngineStats }) {
  return (
    <details className="debug-overlay" open>
      <summary>LOCAL DEBUG</summary>
      <pre>
        {JSON.stringify(
          {
            renderFPS: stats.fps,
            inferenceFPS: stats.inferenceFps,
            source: stats.source,
            canvas: stats.canvas,
            faceCount: stats.faceCount,
            poseDetected: stats.poseDetected,
            faceCenter: stats.center,
            mirror: stats.mirror,
            transform: stats.transform,
          },
          null,
          2,
        )}
      </pre>
    </details>
  );
}
