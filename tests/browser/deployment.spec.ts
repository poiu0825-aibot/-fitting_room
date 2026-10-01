import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('production CSP permits only local camera, Worker, WASM and model resources', async ({
  context,
  page,
}) => {
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
  await page.goto('/');
  await page.getByRole('button', { name: '開啟相機' }).click();
  await expect(page.getByText('相機已開啟')).toBeVisible();
  await expect(page.getByText('請將臉部放在畫面中央，並保持光線充足。')).toBeVisible({
    timeout: 30000,
  });
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
  await page.getByRole('button', { name: '關閉相機' }).click();
});
