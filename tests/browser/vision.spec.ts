import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
for (const mode of ['hairstyle', 'top'] as const) {
  test(`real ${mode} model initializes and infers in a classic Worker`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const result = await page.evaluate(async (mode) => {
      const worker = new Worker('/vision/vision.worker.js');
      try {
        const ready = new Promise<void>((resolve, reject) => {
          worker.onmessage = ({ data }) =>
            data.kind === 'ready'
              ? resolve()
              : data.kind === 'error'
                ? reject(new Error(data.message))
                : undefined;
          worker.onerror = (event) => reject(new Error(event.message));
        });
        worker.postMessage({ kind: 'init', mode, baseUrl: `${location.origin}/` });
        await ready;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const frame = await createImageBitmap(canvas);
        const output = new Promise<{ faceCount: number; poseCount: number; elapsedMs: number }>(
          (resolve, reject) => {
            worker.onmessage = ({ data }) =>
              data.kind === 'error'
                ? reject(new Error(data.message))
                : resolve({
                    faceCount: data.result.faceCount,
                    poseCount: data.result.pose.length,
                    elapsedMs: data.result.elapsedMs,
                  });
          },
        );
        worker.postMessage({ kind: 'frame', frame, timestamp: performance.now() }, [frame]);
        return await output;
      } finally {
        worker.terminate();
      }
    }, mode);
    expect(result.faceCount).toBe(0);
    expect(result.poseCount).toBe(0);
    expect(result.elapsedMs).toBeGreaterThan(0);
  });
}
// Official MediaPipe example photos may be supplied from /tmp for integration validation.
// No face/body photos are committed or downloaded by CI; these tests are explicitly skipped without a fixture.
for (const [mode, variable] of [
  ['hairstyle', 'VISION_TEST_FACE_IMAGE'],
  ['top', 'VISION_TEST_POSE_IMAGE'],
] as const) {
  test(`real ${mode} model detects official example fixture`, async ({ page }) => {
    test.skip(
      !process.env[variable],
      `Set ${variable} to an untracked official test image to exercise real detection.`,
    );
    test.setTimeout(60000);
    const bytes = Array.from(readFileSync(process.env[variable]!));
    await page.goto('/');
    const count = await page.evaluate(
      async ({ mode, bytes }) => {
        const worker = new Worker('/vision/vision.worker.js');
        try {
          const ready = new Promise<void>((resolve, reject) => {
            worker.onmessage = ({ data }) =>
              data.kind === 'ready' ? resolve() : reject(new Error(data.message));
            worker.onerror = (event) => reject(new Error(event.message));
          });
          worker.postMessage({ kind: 'init', mode, baseUrl: `${location.origin}/` });
          await ready;
          const frame = await createImageBitmap(
            new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
          );
          const output = new Promise<number>((resolve, reject) => {
            worker.onmessage = ({ data }) =>
              data.kind === 'error'
                ? reject(new Error(data.message))
                : resolve(mode === 'hairstyle' ? data.result.face.length : data.result.pose.length);
          });
          worker.postMessage({ kind: 'frame', frame, timestamp: performance.now() }, [frame]);
          return await output;
        } finally {
          worker.terminate();
        }
      },
      { mode, bytes },
    );
    expect(count).toBeGreaterThanOrEqual(mode === 'hairstyle' ? 468 : 33);
  });
}
