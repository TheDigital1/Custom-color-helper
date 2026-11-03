import { expect, test } from '@playwright/test';

test('a shared URL restores the exact state in a fresh browser context', async ({ page, browser }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  await page.getByRole('button', { name: 'Lock LRV' }).click();
  await page.getByRole('button', { name: 'Increase Warmth' }).click();
  await page.getByRole('button', { name: 'Increase Warmth' }).click();
  await page.getByLabel('Lighting preset').selectOption('led3000');
  await page.getByLabel('How much your eye adapts').fill('40');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('light=led3000');

  const read = async (p: import('@playwright/test').Page) => ({
    values: await p.locator('.slider-value').allTextContents(),
    original: await p.locator('[data-panel="original"] .panel-name').textContent(),
    modified: await p.locator('[data-panel="modified"] .swatch').evaluate((e) => getComputedStyle(e).backgroundColor),
    lrvLocked: await p.getByRole('button', { name: 'Unlock LRV' }).count(),
    light: await p.getByLabel('Lighting preset').inputValue(),
  });
  const before = await read(page);
  const url = page.url();

  // "Another device": a brand-new context with no localStorage.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  await other.goto(url);
  await expect(other.locator('[data-panel="original"] .panel-name')).toHaveText('Alabaster');
  await expect.poll(() => read(other)).toEqual(before);
  expect(before.lrvLocked).toBe(1);
  await ctx.close();
});

test('palette board: add colors, export text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  await page.getByRole('button', { name: /Save original paint/ }).click();
  await page.getByLabel('New palette name').fill('Living room');
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByLabel('Add a saved color to this palette').selectOption({ label: 'Alabaster (Sherwin-Williams)' });
  await page.getByRole('button', { name: 'Decrease LRV' }).click();
  await page.getByRole('button', { name: '+ Current color' }).click();
  await expect(page.locator('.palette-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Copy as text' }).click();
  await expect(page.locator('.toast')).toHaveText('Palette copied to clipboard');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Living room');
  expect(text).toContain('Sherwin-Williams — Alabaster (SW 7008), LRV 82');
  expect(text).toMatch(/Custom #[0-9A-F]{6} \(tuned from Sherwin-Williams Alabaster \(SW 7008\)\), approx\. LRV/);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await download).suggestedFilename()).toBe('Living_room.csv');
});
