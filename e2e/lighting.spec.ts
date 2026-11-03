import { expect, test } from '@playwright/test';

const bg = (page: import('@playwright/test').Page, panel: string) =>
  page.locator(`[data-panel="${panel}"] .swatch`).evaluate((e) => getComputedStyle(e).backgroundColor);
const rgb = (s: string) => s.match(/\d+/g)!.map(Number);

test('lighting presets shift both swatches consistently; matches stay under D65', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  await page.getByRole('button', { name: 'Decrease LRV' }).click();
  const o0 = rgb(await bg(page, 'original'));
  const m0 = rgb(await bg(page, 'modified'));
  const topMatch = await page.locator('.match-row').first().getAttribute('data-match');

  await page.getByLabel('Lighting preset').selectOption('incandescent');
  const o1 = rgb(await bg(page, 'original'));
  const m1 = rgb(await bg(page, 'modified'));
  // Both get warmer (red up relative to blue).
  expect(o1[0] - o1[2]).toBeGreaterThan(o0[0] - o0[2] + 10);
  expect(m1[0] - m1[2]).toBeGreaterThan(m0[0] - m0[2] + 10);
  await expect(page.locator('.compare-note')).toContainText('Incandescent');
  expect(await page.locator('.match-row').first().getAttribute('data-match')).toBe(topMatch);

  await page.getByLabel('Lighting preset').selectOption('north');
  const o2 = rgb(await bg(page, 'original'));
  expect(o2[0] - o2[2]).toBeLessThan(o0[0] - o0[2]);

  // Full adaptation removes the cast.
  await page.getByLabel('How much your eye adapts').fill('100');
  expect(rgb(await bg(page, 'original'))).toEqual(o0);
});
