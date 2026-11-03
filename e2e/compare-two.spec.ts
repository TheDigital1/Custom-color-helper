import { expect, test, type Page } from '@playwright/test';

async function pick(page: Page, side: 'A' | 'B', query: string, name: string) {
  await page.getByRole('combobox', { name: `Search paint for color ${side}` }).fill(query);
  await page.locator(`#ct-results-${side.toLowerCase()}`).getByRole('option').filter({ hasText: name }).first().click();
}

test('compare two named colors and see slider differences', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  const section = page.locator('.compare-two');
  await section.scrollIntoViewIfNeeded();
  await expect(section).toContainText('Pick a color for both A and B');

  await pick(page, 'A', 'alabaster', 'Alabaster');
  await pick(page, 'B', 'fixture sherwin 117', 'Fixture Sherwin 117');
  await expect(section.locator('[data-slot="a"] .hit-name')).toHaveText('Alabaster');
  await expect(section.locator('[data-slot="b"] .hit-name')).toHaveText('Fixture Sherwin 117');

  // Differences: every slider row, signed B − A, plus published LRV (both fixtures publish one).
  const lrvRow = section.locator('tr[data-row="lrv"]');
  const [a, b, d] = (await lrvRow.locator('td').allTextContents()).map((t) => t.trim());
  const expected = parseFloat(b) - parseFloat(a);
  expect(parseFloat(d.replace('−', '-'))).toBeCloseTo(expected, 0);
  expect(d).toMatch(/^[+−]\d+\.\d$/);
  await expect(section.locator('tr[data-row="publishedLrv"]')).toBeVisible();
  await expect(section.locator('tbody tr')).toHaveCount(13);
  await expect(section.locator('.ct-de')).toContainText(/ΔE \d+\.\d/);
  await expect(section.locator('.ct-summary')).toContainText('B vs. A:');

  // Swap flips the signs.
  await section.getByRole('button', { name: 'Swap A and B' }).click();
  await expect(section.locator('[data-slot="a"] .hit-name')).toHaveText('Fixture Sherwin 117');
  const d2 = (await lrvRow.locator('td').nth(2).textContent())!.trim();
  expect(d2[0]).not.toBe(d[0]);

  // Remembered across reloads.
  await page.reload();
  await expect(page.locator('.compare-two [data-slot="a"] .hit-name')).toHaveText('Fixture Sherwin 117');

  // "Use modified" puts the tuned color in a slot; "Edit this" loads a paint into the main tool.
  await page.locator('.compare-two').getByRole('button', { name: 'Use modified' }).first().click();
  await expect(page.locator('.compare-two [data-slot="a"] .hit-name')).toHaveText('Modified color');
  await page.locator('.compare-two [data-slot="b"]').getByRole('button', { name: 'Edit this' }).click();
  await expect(page.locator('[data-panel="original"] .panel-name')).toHaveText('Alabaster');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
