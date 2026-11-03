import { expect, test } from '@playwright/test';

test('per-color source and hex disagreements between sources are shown', async ({ page }) => {
  await page.goto('./');
  const original = page.locator('[data-panel="original"]');
  await expect(original.locator('.panel-name')).toHaveText('Alabaster');
  await expect(original).toContainText('Source: Test fixture');
  // The third fixture source lists Alabaster as #EEEAE1.
  await expect(original.locator('.alt-hex')).toContainText('Third test source: #EEEAE1 (vs #EDEAE0)');

  // Footer lists brand counts, including the brand added by another source.
  await page.locator('.data-info summary').click();
  await expect(page.locator('.brand-table')).toContainText('Rodda');
  await expect(page.locator('.brand-table tr', { hasText: 'Behr' })).toContainText('Test fixture, Third test source');

  // A color that only exists in the second source is searchable and shows its source.
  await page.getByRole('combobox', { name: 'Search paint colors by name or code' }).fill('rodda two');
  await page.getByRole('option').first().click();
  await expect(original.locator('.panel-name')).toHaveText('Fixture Rodda Two');
  await expect(original).toContainText('Source: Second test source');
});
