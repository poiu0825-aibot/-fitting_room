import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
async function imageFile(page: import('@playwright/test').Page, hair: boolean) {
  const bytes = await page.evaluate((hair) => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = hair ? '#794328' : '#e2c0a0';
    ctx.fillRect(hair ? 20 : 0, hair ? 10 : 0, hair ? 80 : 120, hair ? 100 : 160);
    return canvas.toDataURL('image/png').split(',')[1];
  }, hair);
  return {
    name: hair ? 'synthetic-hair.png' : 'synthetic-portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes, 'base64'),
  };
}
test('photo studio is default, trims local hair and resets on reload without upload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const outbound: string[] = [];
  page.on('request', (r) => {
    if (
      /^https?:/.test(r.url()) &&
      (!r.url().startsWith('http://127.0.0.1:5173') || r.method() !== 'GET')
    )
      outbound.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: '本機照片換髮型' })).toBeVisible();
  await page.getByLabel('選擇人像照片').setInputFiles(await imageFile(page, false));
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  await page.getByLabel('選擇新髮型圖片').setInputFiles(await imageFile(page, true));
  await expect(page.getByAltText('新髮型與髮際線錨點')).toBeVisible();
  await expect(page.getByRole('button', { name: '3. 分析照片並合成' })).toBeEnabled();
  await page.getByLabel('髮際線上下').fill('0.4');
  await expect(page.getByLabel('髮際線上下')).toHaveValue('0.4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/photo-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByAltText('原始人像照片')).toHaveCount(0);
  await expect(page.getByAltText('新髮型與髮際線錨點')).toHaveCount(0);
  expect(outbound).toEqual([]);
});
test('real segmentation worker initializes and infers without a webcam', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const worker = new Worker('/vision/photo.worker.js');
    try {
      await new Promise<void>((resolve, reject) => {
        worker.onmessage = ({ data }) =>
          data.kind === 'ready' ? resolve() : reject(new Error(data.message));
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage({ kind: 'init', baseUrl: `${location.origin}/` });
      });
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const frame = await createImageBitmap(canvas);
      return await new Promise<{
        faceCount: number;
        pixels: number;
        categories: number;
        confidence: number;
      }>((resolve, reject) => {
        worker.onmessage = ({ data }) =>
          data.kind === 'error'
            ? reject(new Error(data.message))
            : resolve({
                faceCount: data.result.faceCount,
                pixels: data.result.width * data.result.height,
                categories: data.result.categories.length,
                confidence: data.result.hairConfidence.length,
              });
        worker.postMessage({ kind: 'analyse', frame }, [frame]);
      });
    } finally {
      worker.terminate();
    }
  });
  expect(result.faceCount).toBe(0);
  expect(result.pixels).toBeGreaterThan(0);
  expect(result.categories).toBe(result.pixels);
  expect(result.confidence).toBe(result.pixels);
});
test('synthetic portrait without a face fails honestly rather than returning a fake makeover', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByLabel('選擇人像照片').setInputFiles(await imageFile(page, false));
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  await page.getByLabel('選擇新髮型圖片').setInputFiles(await imageFile(page, true));
  await expect(page.getByAltText('新髮型與髮際線錨點')).toBeVisible();
  await page.getByRole('button', { name: '3. 分析照片並合成' }).click();
  await expect(page.getByRole('alert')).toContainText('沒有找到清晰臉部', { timeout: 45000 });
  await expect(page.getByAltText('本機換髮型合成結果')).toHaveCount(0);
});

test('official portrait: local hair extraction, composition, comparison and download', async ({
  page,
}) => {
  test.skip(
    !process.env.VISION_TEST_FACE_IMAGE,
    'Provide an untracked official portrait for real photo integration.',
  );
  test.setTimeout(90000);
  await page.goto('/');
  const file = {
    name: 'official-example.jpg',
    mimeType: 'image/jpeg',
    buffer: readFileSync(process.env.VISION_TEST_FACE_IMAGE!),
  };
  await page.getByLabel('選擇人像照片').setInputFiles(file);
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  await page.getByLabel('選擇新髮型圖片').setInputFiles(file);
  await expect(page.getByAltText('新髮型與髮際線錨點')).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '3. 分析照片並合成' }).click();
  await expect(page.getByAltText('本機換髮型合成結果')).toBeVisible({ timeout: 45000 });
  await page.getByLabel('新髮亮度').fill('0.8');
  await expect(page.getByRole('button', { name: '儲存換髮型結果' })).toBeEnabled();
  await page.getByRole('button', { name: '原始照片', exact: true }).click();
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  await page.getByRole('button', { name: '換髮型結果', exact: true }).click();
  const capture = page.waitForEvent('download');
  await page.getByRole('button', { name: '儲存換髮型結果' }).click();
  expect((await capture).suggestedFilename()).toMatch(/^fitting-room-.*\.png$/);
  await page.screenshot({ path: 'test-results/photo-official-result.png', fullPage: true });
  await page.getByRole('button', { name: '清除本次照片與髮型' }).click();
  await expect(page.getByAltText('本機換髮型合成結果')).toHaveCount(0);
  await expect(page.getByAltText('新髮型與髮際線錨點')).toHaveCount(0);
});

test('composition preserves the lower face even when segmentation mislabels it as hair', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { Worker: unknown }).Worker = class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      closed = false;
      postMessage(message: { kind: string; frame?: ImageBitmap }) {
        setTimeout(() => {
          if (this.closed) return;
          if (message.kind === 'init') {
            this.onmessage?.({ data: { kind: 'ready' } } as MessageEvent);
            return;
          }
          const oval = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
          ];
          const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.55, z: 0 }));
          oval.forEach((index, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / oval.length;
            landmarks[index] = {
              x: 0.5 + 0.2 * Math.cos(angle),
              y: 0.55 + 0.25 * Math.sin(angle),
              z: 0,
            };
          });
          landmarks[10] = { x: 0.5, y: 0.3, z: 0 };
          landmarks[152] = { x: 0.5, y: 0.8, z: 0 };
          landmarks[234] = { x: 0.3, y: 0.55, z: 0 };
          landmarks[454] = { x: 0.7, y: 0.55, z: 0 };
          landmarks[33] = { x: 0.4, y: 0.45, z: 0 };
          landmarks[263] = { x: 0.6, y: 0.45, z: 0 };
          const categories = new Uint8Array(120 * 160),
            hairConfidence = new Float32Array(120 * 160);
          for (let y = 0; y < 160; y++)
            for (let x = 0; x < 120; x++)
              if (x > 35 && x < 85 && y > 20 && y < 135) {
                categories[y * 120 + x] = 1;
                hairConfidence[y * 120 + x] = 1;
              }
          message.frame?.close();
          this.onmessage?.({
            data: {
              kind: 'result',
              result: {
                landmarks,
                faceCount: 1,
                width: 120,
                height: 160,
                categories,
                hairConfidence,
              },
            },
          } as MessageEvent);
        }, 0);
      }
      terminate() {
        this.closed = true;
      }
    };
  });
  await page.goto('/');
  await page.getByLabel('選擇人像照片').setInputFiles(await imageFile(page, false));
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  await page.getByLabel('選擇新髮型圖片').setInputFiles(await imageFile(page, true));
  await expect(page.getByAltText('新髮型與髮際線錨點')).toBeVisible();
  await page.getByRole('button', { name: '3. 分析照片並合成' }).click();
  await expect(page.getByAltText('本機換髮型合成結果')).toBeVisible();
  const samples = await page
    .getByAltText('本機換髮型合成結果')
    .evaluate((img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return {
        face: Array.from(ctx.getImageData(60, 88, 1, 1).data),
        forehead: Array.from(ctx.getImageData(60, 50, 1, 1).data),
      };
    });
  expect(samples.face).toEqual([226, 192, 160, 255]);
  expect(samples.forehead).toEqual([121, 67, 40, 255]);
});

test('denied camera can recover by choosing a local portrait', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByRole('alert')).toContainText('相機權限遭拒絕');
  await page.getByLabel('選擇人像照片').setInputFiles(await imageFile(page, false));
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
