import { expect, test } from '@playwright/test';

test('room mockup renders without horizontal scroll and takes favorites', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  await page.getByRole('button', { name: 'Decrease LRV' }).click();
  await page.getByRole('button', { name: /Save current color/ }).click();
  await page.getByRole('button', { name: /Save original paint/ }).click();
  await expect(page.locator('.fav-list .match-row')).toHaveCount(2);

  const svg = page.locator('.room-svg');
  await svg.scrollIntoViewIfNeeded();
  await expect(svg).toBeVisible();
  const box = (await svg.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Assign the saved Alabaster to the trim; the trim fill changes to it.
  await page.getByLabel('Trim color').selectOption({ label: '★ Alabaster (Sherwin-Williams)' });
  await expect(page.locator('[data-surface="trim"]')).toHaveAttribute('fill', '#edeae0');
  // Wall (current color) vs trim (Alabaster) contrast is shown.
  await expect(page.locator('[data-pair="wall-trim"] .num')).toHaveText(/^\d+\.\d\d:1$/);

  // Favorites persist across reloads.
  await page.reload();
  await expect(page.locator('.fav-list .match-row')).toHaveCount(2);
});
