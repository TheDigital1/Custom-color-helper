import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
});

async function openSheet(page: import('@playwright/test').Page) {
  const handle = page.locator('.sheet-handle');
  if ((await handle.getAttribute('aria-expanded')) === 'false' && (await page.viewportSize())!.width < 900) await handle.click();
}

test('matches update when a slider moves, with top 3 per brand and labels', async ({ page }) => {
  await openSheet(page);
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('h3', { hasText: 'Best overall' })).toBeVisible();
  for (const b of ['Sherwin-Williams', 'Benjamin Moore', 'Behr', 'PPG']) {
    await expect(sheet.locator('h3', { hasText: b })).toBeVisible();
  }
  const firstBefore = await sheet.locator('.match-row').first().getAttribute('data-match');
  expect(firstBefore).toContain('sw:');
  await expect(sheet.locator('.match-row').first()).toContainText('indistinguishable');
  // Each brand list has at most 3 rows.
  const counts = await sheet.locator('.match-list').evaluateAll((ls) => ls.map((l) => l.children.length));
  expect(Math.max(...counts)).toBeLessThanOrEqual(3);

  await page.locator('#s-lrv').fill('40');
  await expect.poll(() => sheet.locator('.match-row').first().getAttribute('data-match')).not.toBe(firstBefore);
});

test('brand filter and selected-brand-only mode', async ({ page }) => {
  await openSheet(page);
  const sheet = page.locator('.sheet');
  await sheet.getByLabel('Sherwin-Williams only').check();
  await expect(sheet.locator('h3', { hasText: 'Behr' })).toHaveCount(0);
  await sheet.getByLabel('Sherwin-Williams only').uncheck();
  await sheet.getByRole('button', { name: /Brands/ }).click();
  await sheet.getByLabel(/^Behr/).uncheck();
  await expect(sheet.locator('h3', { hasText: 'Behr' })).toHaveCount(0);
  await expect(sheet.locator('h3', { hasText: 'PPG' })).toBeVisible();
});

test('tap a match to compare it or make it the original', async ({ page }) => {
  await page.locator('#s-lrv').fill('50');
  await openSheet(page);
  const sheet = page.locator('.sheet');
  const row = sheet.locator('.match-list').nth(1).locator('.match-row').nth(1);
  const name = (await row.locator('.hit-name').textContent())!;
  await row.getByRole('button', { name: /third panel/ }).click();
  await expect(page.locator('[data-panel="third"]')).toContainText('Picked match');
  await expect(page.locator('[data-panel="third"] .panel-name')).toHaveText(name);
  await row.getByRole('button', { name: /as the original/ }).click();
  await expect(page.locator('[data-panel="original"] .panel-name')).toHaveText(name);
});
