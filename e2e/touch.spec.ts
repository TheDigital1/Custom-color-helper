import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

test.skip(({ isMobile }) => !isMobile, 'touch gestures are a phone concern');

async function swipe(cdp: CDPSession, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Wait until scrolling (including fling momentum) has stopped. */
async function settle(page: Page) {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => scrollY);
    if (y === last) return;
    last = y;
    await page.waitForTimeout(100);
  }
}

/** Scroll so the slider's center sits at viewport y, and return a point on it at fraction fx. */
async function place(page: Page, row: Locator, y: number, fx: number) {
  const box = (await row.boundingBox())!;
  await page.evaluate((dy) => scrollBy(0, dy), box.y + box.height / 2 - y);
  await settle(page);
  const b = (await row.boundingBox())!;
  const pt = { x: b.x + b.width * fx, y: b.y + b.height / 2 };
  // Make sure the finger really lands on this slider (not on the sticky header or the sheet).
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-slider]')?.getAttribute('data-slider'), pt);
  expect(hit).toBe('hue');
  return pt;
}

const value = async (page: Page, id: string) => parseFloat((await page.locator(`[data-slider="${id}"] .slider-value`).textContent())!);

test('vertical swipes over a slider scroll the page without changing it; sideways drags adjust it', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  const cdp = await page.context().newCDPSession(page);
  const row = page.locator('[data-slider="hue"] .tsr');
  const before = await value(page, 'hue');

  // Scroll: finger lands near the end of the track and moves up (slightly diagonal, as thumbs do).
  let pt = await place(page, row, 620, 0.85);
  const scrollBefore = await page.evaluate(() => scrollY);
  await swipe(cdp, pt, { x: pt.x - 15, y: pt.y - 180 });
  await settle(page);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore + 50);
  expect(await value(page, 'hue')).toBe(before);

  // Tap on the track: no jump.
  pt = await place(page, row, 600, 0.9);
  await swipe(cdp, pt, pt, 1);
  await page.waitForTimeout(150);
  expect(await value(page, 'hue')).toBe(before);

  // Sideways drag: adjusts relative to where the finger started (no jump to the finger).
  pt = await place(page, row, 600, 0.3);
  await swipe(cdp, pt, { x: pt.x + 60, y: pt.y + 4 });
  await expect.poll(() => value(page, 'hue')).toBeGreaterThan(before + 5);
  // 60 px on a ~240 px track is about a quarter of 360°; it must not have jumped to 30% (≈108°)
  // first and then added the movement on top.
  expect(await value(page, 'hue')).toBeLessThan(before + 120);
});
