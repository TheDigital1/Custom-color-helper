import { expect, test, type Page } from '@playwright/test';

const canvasData = (page: Page, key: 'visible' | 'labels') => page.locator('.map-canvas').evaluate((c, k) => Number((c as HTMLCanvasElement).dataset[k]), key);
const hashParam = (page: Page, k: string) => page.evaluate((key) => new URLSearchParams(location.hash.slice(1)).get(key), k);

test('open the map from the tuner, find a paint, zoom, pan, and send it back', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  await page.getByRole('link', { name: 'Color map' }).click();
  await expect(page).toHaveURL(/map\.html#c=/);
  await expect.poll(() => canvasData(page, 'visible')).toBeGreaterThan(0);
  await expect(page.locator('.map-slice')).toContainText(/LRV \d+–\d+ · [\d,]+ paints/);

  // Find a paint: the card shows it and names are drawn.
  await page.getByRole('combobox', { name: 'Find a paint on the map' }).fill('fixture behr 010');
  await page.locator('#map-search-results').getByRole('option').first().click();
  await expect(page.locator('.map-card .hit-name')).toHaveText('Fixture Behr 010');
  await expect.poll(() => canvasData(page, 'labels')).toBeGreaterThan(0);
  await expect.poll(() => hashParam(page, 'sel')).toBe('behr:FX-2010');

  // Zoom buttons and dragging change the view (kept in the URL).
  const zoomOf = async () => Number((await hashParam(page, 'v'))!.split(',')[2]);
  const z0 = await zoomOf();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(zoomOf).toBeCloseTo(z0 / 2, 3);
  const box = (await page.locator('.map-canvas').boundingBox())!;
  const xOf = async () => Number((await hashParam(page, 'v'))!.split(',')[0]);
  const x0 = await xOf();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(xOf).toBeGreaterThan(x0);

  // Lightness slice: "All" shows more paints than a ±2 slice.
  await page.getByRole('button', { name: '±2' }).click();
  const narrow = parseInt((await page.locator('.map-slice .muted').textContent())!.replace(/\D/g, ''));
  await page.getByRole('button', { name: 'All' }).click();
  await expect.poll(async () => parseInt((await page.locator('.map-slice .muted').textContent())!.replace(/\D/g, ''))).toBeGreaterThan(narrow);

  // Send to compare, then open in the tuner.
  await page.getByRole('button', { name: 'Add to compare' }).click();
  await expect(page.locator('.toast')).toContainText('Fixture Behr 010 added to Compare two colors');
  await page.getByRole('link', { name: 'Open in tuner' }).click();
  await expect(page.locator('[data-panel="original"] .panel-name')).toHaveText('Fixture Behr 010');
  await expect(page.locator('.compare-two [data-slot="a"] .hit-name')).toHaveText('Fixture Behr 010');
});

test('tapping a dot selects the nearest paint', async ({ page }) => {
  await page.goto('./map.html#v=0,0,1&lrv=50&band=all');
  await expect.poll(() => canvasData(page, 'visible')).toBeGreaterThan(100);
  const box = (await page.locator('.map-canvas').boundingBox())!;
  // Paints cluster near the gray center; tap just off center.
  await page.mouse.click(box.x + box.width / 2 + 6, box.y + box.height / 2 - 6);
  await expect(page.locator('.map-card')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.map-card')).toHaveCount(0);
});

test('pinch to zoom and one-finger drag on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch gestures are a phone concern');
  await page.goto('./map.html#v=0,0,2&lrv=50&band=5');
  await expect.poll(() => canvasData(page, 'visible')).toBeGreaterThan(0);
  const cdp = await page.context().newCDPSession(page);
  const zoomOf = async () => Number((await hashParam(page, 'v'))!.split(',')[2]);
  const cx = 195;
  const cy = 420;
  // Fingers 60 px apart spread to 240 px apart: about 4× zoom.
  const pts = (d: number) => [
    { x: cx - d / 2, y: cy, id: 1 },
    { x: cx + d / 2, y: cy, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(60) });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(60 + i * 18) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(zoomOf).toBeGreaterThan(6);
  await expect.poll(zoomOf).toBeLessThan(10);

  const yOf = async () => Number((await hashParam(page, 'v'))!.split(',')[1]);
  const y0 = await yOf();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy + i * 15 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // Dragging down moves the view up the wheel.
  await expect.poll(yOf).toBeGreaterThan(y0);
});
