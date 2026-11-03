import { expect, test } from '@playwright/test';

test('loads and lists brand counts', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText(/colors from 4 brands/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sherwin-Williams' })).toBeVisible();
  await expect(page.getByText(/CC BY 4.0|test data/).first()).toBeVisible();
});
