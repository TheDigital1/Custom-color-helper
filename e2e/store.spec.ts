import { expect, test } from '@playwright/test';

test('store card suggests strength formulas and an adjustment, and copies a note', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  const handle = page.locator('.sheet-handle');
  if (page.viewportSize()!.width < 900) await handle.click();
  const card = page.locator('.store-help');
  // Unmodified: the stock paint is the answer.
  await expect(card).toContainText('Just buy Sherwin-Williams Alabaster');

  if (page.viewportSize()!.width < 900) await handle.click();
  await page.locator('#s-lrv').fill('60');
  if (page.viewportSize()!.width < 900) await handle.click();
  await expect(card).toContainText('adjusted:');
  await expect(card).toContainText(/darker/);
  await expect(card.locator('.strength-row').first()).toBeVisible();
  await expect(card.locator('.strength-row').first()).toContainText(/at \d+%/);

  await card.getByRole('button', { name: 'Copy note' }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Color I'm looking for: #");
  expect(text).toMatch(/strength \(estimated ΔE/);
  expect(text).toContain('Compared with Sherwin-Williams Alabaster (SW 7008)');
});
