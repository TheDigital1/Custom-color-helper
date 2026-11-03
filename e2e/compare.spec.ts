import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
});

test('side-by-side shows original, modified and nearest paint', async ({ page }) => {
  await expect(page.locator('[data-panel="original"]')).toBeVisible();
  await expect(page.locator('[data-panel="modified"]')).toBeVisible();
  const third = page.locator('[data-panel="third"]');
  await expect(third).toContainText('Nearest paint');
  // Unmodified Alabaster: nearest paint is Alabaster itself.
  await expect(third).toContainText('ΔE 0.0');
  await page.getByRole('button', { name: 'Increase Lightness' }).click();
  await page.getByRole('button', { name: 'Decrease Lightness' }).click();
  await page.getByRole('button', { name: 'Decrease LRV' }).click();
  await expect(third).not.toContainText('ΔE 0.0');
});

test('nested mode swaps inner and outer with one tap', async ({ page }) => {
  await page.getByRole('button', { name: 'Decrease LRV' }).click();
  await page.getByRole('button', { name: 'Nested' }).click();
  const swatch = page.locator('.nested-swatch');
  await expect(swatch).toHaveAttribute('data-outer', 'original');
  const before = await swatch.evaluate((e) => getComputedStyle(e).backgroundColor);
  await swatch.click();
  await expect(swatch).toHaveAttribute('data-outer', 'modified');
  const after = await swatch.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(after).not.toBe(before);
  const inner = await page.locator('.nested-inner').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(inner).toBe(before);
});

test('full-screen swatch opens and closes', async ({ page }) => {
  await page.locator('[data-panel="original"] .swatch').click();
  const fs = page.locator('.fullscreen');
  await expect(fs).toBeVisible();
  const box = await fs.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.width).toBe(vp.width);
  expect(box!.height).toBe(vp.height);
  expect(await fs.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(237, 234, 224)');
  await fs.click();
  await expect(fs).toBeHidden();
  // Nested full screen.
  await page.getByRole('button', { name: 'Nested' }).click();
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect(page.locator('.fullscreen-inner')).toBeVisible();
});

test('undertone pull sliders are present and move the color', async ({ page }) => {
  const green = page.locator('[data-slider="pullGreen"] .slider-value');
  const before = parseFloat((await green.textContent())!);
  await page.getByRole('button', { name: 'Increase Green pull' }).click();
  await expect.poll(async () => parseFloat((await green.textContent())!)).toBeGreaterThan(before + 0.1);
});
