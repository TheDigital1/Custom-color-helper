import { expect, test } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'mouse behavior is a desktop concern');

test('mouse: click jumps to the spot, drag adjusts, keyboard still works', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel-name').first()).toHaveText('Alabaster');
  const row = page.locator('[data-slider="hue"] .tsr');
  const val = async () => parseFloat((await page.locator('[data-slider="hue"] .slider-value').textContent())!);
  const b = (await row.boundingBox())!;
  const xAt = (f: number) => b.x + 15 + f * (b.width - 30);
  await page.mouse.click(xAt(0.75), b.y + b.height / 2);
  await expect.poll(val).toBeCloseTo(270, -1);
  await page.mouse.move(xAt(0.75), b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(xAt(0.5), b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(val).toBeCloseTo(180, -1);
  await page.locator('#s-hue').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(val).toBeGreaterThan(180);
});
