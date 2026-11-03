import { expect, test, type Page } from '@playwright/test';

const sliderValue = async (page: Page, id: string) =>
  parseFloat((await page.locator(`[data-slider="${id}"] .slider-value`).textContent()) ?? 'NaN');

test('search Alabaster, lock LRV, move warmth: LRV stays fixed', async ({ page }) => {
  await page.goto('./');
  const search = page.getByRole('combobox', { name: /search paint/i });
  await search.fill('alabaster');
  await page.getByRole('option').filter({ hasText: 'Alabaster' }).first().click();
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');

  const lrvBefore = await sliderValue(page, 'lrv');
  expect(lrvBefore).toBeGreaterThan(79);
  await page.getByRole('button', { name: 'Lock LRV' }).click();

  const warmthBefore = await sliderValue(page, 'warmth');
  const warmth = page.locator('#s-warmth');
  await warmth.fill(String(warmthBefore + 3));
  await expect.poll(() => sliderValue(page, 'warmth')).toBeCloseTo(warmthBefore + 3, 0);
  // Nudge buttons too.
  await page.getByRole('button', { name: 'Increase Warmth' }).click();
  await expect.poll(() => sliderValue(page, 'warmth')).toBeCloseTo(warmthBefore + 3.5, 0);

  expect(Math.abs((await sliderValue(page, 'lrv')) - lrvBefore)).toBeLessThan(0.1);
  // The modified swatch changed but the original did not.
  const bgs = await page.locator('.compare-side .swatch').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  expect(bgs[0]).toBe('rgb(237, 234, 224)');
  expect(bgs[1]).not.toBe(bgs[0]);

  // Undo and redo.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => sliderValue(page, 'warmth')).toBeCloseTo(warmthBefore + 3, 0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(() => sliderValue(page, 'warmth')).toBeCloseTo(warmthBefore + 3.5, 0);

  // Global reset.
  await page.getByRole('button', { name: 'Reset all' }).click();
  await expect.poll(() => sliderValue(page, 'warmth')).toBeCloseTo(warmthBefore, 1);
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
