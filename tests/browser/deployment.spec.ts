import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('production CSP permits only local camera, Worker, WASM and model resources', async ({
  context,
  page,
}) => {
  test.setTimeout(90000);
  test.skip(
    process.env.PLAYWRIGHT_SERVER_MODE !== 'preview',
    'CSP is validated against production output, not Vite dev scripts.',
  );
  const securityHeaders: Record<string, string> = {};
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0)
      securityHeaders[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  await context.route('http://127.0.0.1:5173/**', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...securityHeaders } });
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(event.violatedDirective),
    );
  });
  await page.goto('/?mode=live');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByText('相機已開啟')).toBeVisible();
  await expect(page.getByText('請將臉部放在畫面中央，並保持光線充足。')).toBeVisible({
    timeout: 30000,
  });
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
  await page.getByRole('button', { name: '關閉相機' }).click();
  await page.getByRole('button', { name: '照片換髮型', exact: true }).click();
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByText('相機已開啟')).toBeVisible();
  await page.getByRole('button', { name: '拍下正面照片' }).click();
  await expect(page.getByAltText('原始人像照片')).toBeVisible();
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#794328';
    ctx.fillRect(20, 10, 80, 60);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page
    .getByLabel('選擇新髮型圖片')
    .setInputFiles({
      name: 'synthetic-hair.png',
      mimeType: 'image/png',
      buffer: Buffer.from(bytes, 'base64'),
    });
  await expect(page.getByAltText('新髮型與髮際線錨點')).toBeVisible();
  await page.getByLabel('髮際線上下').fill('0.4');
  await page.getByRole('button', { name: '3. 分析照片並合成' }).click();
  await expect(page.getByRole('alert')).toContainText('沒有找到清晰臉部', { timeout: 45000 });
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
});
