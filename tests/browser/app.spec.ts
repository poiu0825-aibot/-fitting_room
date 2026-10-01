import { expect, test } from '@playwright/test';
async function syntheticPng(page: import('@playwright/test').Page) {
  return Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, 120, 80);
      return canvas.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
}
test('mobile upload, calibration, reset, mode isolation and session clearing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /換個樣子，\s*看看自己。/ })).toBeVisible();
  await expect(
    page.getByText('相機影像與上傳圖片僅在目前裝置進行即時處理，不會自動上傳。'),
  ).toBeVisible();
  await page.getByLabel('選擇試穿圖片').setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: await syntheticPng(page),
  });
  await expect(page.getByText('synthetic.png')).toBeVisible();
  await page.getByLabel('大小', { exact: true }).fill('1.5');
  await expect(page.getByText('150%')).toBeVisible();
  await page.getByRole('button', { name: '↺ 重設' }).click();
  await expect(page.getByText('100%')).toBeVisible();
  await page.getByRole('button', { name: '上衣' }).click();
  await expect(page.getByRole('button', { name: '上傳上衣圖片' })).toBeVisible();
  await page.getByRole('button', { name: '髮型' }).click();
  await expect(page.getByText('synthetic.png')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.reload();
  await expect(page.getByText('synthetic.png')).toHaveCount(0);
  await expect(page.getByText('相機未開啟')).toBeVisible();
});
test('camera denial presents recoverable Traditional Chinese guidance', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByRole('alert')).toContainText('相機權限遭拒絕');
  await expect(page.getByRole('button', { name: '重新啟動' })).toBeVisible();
});
test('fake camera renders, exports local pixels and stops tracks; no data leaves the device', async ({
  page,
}) => {
  const outbound: string[] = [];
  page.on('request', (request) => {
    if (
      !request.url().startsWith('blob:') &&
      (request.method() !== 'GET' || !request.url().startsWith('http://127.0.0.1:5173'))
    )
      outbound.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByText('相機已開啟')).toBeVisible();
  await expect
    .poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width))
    .toBeGreaterThan(300);
  await page.getByRole('button', { name: '拍下這個樣子' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText('本機合成的試穿結果')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(300);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '儲存圖片' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^fitting-room-.*\.png$/);
  await page.getByRole('button', { name: '重新拍攝' }).click();
  await page.getByRole('button', { name: '關閉相機' }).click();
  await expect(page.getByText('相機未開啟')).toBeVisible();
  expect(
    await page.locator('video').evaluate((video: HTMLVideoElement) => video.srcObject),
  ).toBeNull();
  expect(outbound).toEqual([]);
});

test('closing camera clears a failed model status and permits retry', async ({ page }) => {
  await page.route('**/vision/face_landmarker.task', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByRole('alert')).toContainText('模型載入失敗', { timeout: 30000 });
  await page.getByRole('button', { name: '關閉相機' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('準備好後，開啟相機並上傳一張圖片。')).toBeVisible();
  await page.unroute('**/vision/face_landmarker.task');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByText('請將臉部放在畫面中央，並保持光線充足。')).toBeVisible({
    timeout: 30000,
  });
});
