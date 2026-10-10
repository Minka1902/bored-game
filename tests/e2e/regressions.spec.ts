// Regressions from the final review: lifecycle leaks, soft-locks and shell keyboard handling.
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number; __keys: number };
    w.__raf = 0;
    w.__keys = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => {
      w.__raf++;
      cb(t);
    });
    window.addEventListener('keydown', () => w.__keys++);
  });
});

const stageBox = async (page: Page) => (await page.locator('#stage').boundingBox())!;
const rafOver = async (page: Page, ms: number) => {
  const before = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => (window as unknown as { __raf: number }).__raf)) - before;
};

test('leaving a game with settings open does not revive its loop', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#/play/fireworks');
  await page.waitForSelector('#stage[data-ready="1"]');
  await page.click('[data-act="settings"]');
  await page.evaluate(() => history.back());
  await expect(page.locator('.tile').first()).toBeVisible();
  if (await page.locator('.sheet-wrap').count()) await page.click('[data-act="close"]');
  expect(await page.locator('.sheet-wrap').count()).toBe(0);
  expect(await rafOver(page, 600)).toBe(0);
});

test('a game over that lands after leaving neither shows up nor eats keys', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#/play/ten-seconds');
  await page.waitForSelector('#stage[data-ready="1"]');
  const b = await stageBox(page);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.click('[data-act="home"]');
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => (window as unknown as { __keys: number }).__keys);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as unknown as { __keys: number }).__keys) - before).toBe(2);
  expect(await page.locator('.gameover').count()).toBe(0);
});

test('game-over card: focus starts on Again and Enter on a focused Next goes to another game', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#/play/ten-seconds');
  await page.waitForSelector('#stage[data-ready="1"]');
  const b = await stageBox(page);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.gameover.armed');
  expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.act)).toBe('retry');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.act)).toBe('next');
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/ten-seconds/);
});

test('peg drop finishes on a short landscape screen', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 420 });
  await page.goto('/#/play/peg-drop');
  await page.waitForSelector('#stage[data-ready="1"]');
  const b = await stageBox(page);
  for (let i = 0; i < 10; i++) await page.mouse.click(b.x + b.width * (0.3 + i * 0.04), b.y + 40);
  await expect(page.locator('.gameover')).toBeVisible({ timeout: 25_000 });
});

test('peg drop still finishes when the screen grows mid-round', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 700 });
  await page.goto('/#/play/peg-drop');
  await page.waitForSelector('#stage[data-ready="1"]');
  const b = await stageBox(page);
  for (let i = 0; i < 10; i++) await page.mouse.click(b.x + b.width * (0.3 + i * 0.04), b.y + 40);
  await page.setViewportSize({ width: 412, height: 1000 });
  await expect(page.locator('.gameover')).toBeVisible({ timeout: 25_000 });
});

test('kaleido mode chip stays readable', async ({ page }) => {
  await page.goto('/#/play/kaleido');
  await page.waitForSelector('#stage[data-ready="1"]');
  await page.waitForTimeout(5000);
  const lum = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas') as HTMLCanvasElement;
    const k = c.width / c.getBoundingClientRect().width;
    // inside the chip, left of its label
    const d = c.getContext('2d')!.getImageData(Math.round((c.width / k - 76) * k), Math.round((c.height / k - 36) * k), 1, 1).data;
    return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
  });
  expect(lum).toBeLessThan(120);
});

test('switchboard can scroll on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto('/#/play/switchboard');
  await page.waitForSelector('#stage[data-ready="1"]');
  const r = await page.evaluate(() => {
    const sb = document.querySelector('.sb') as HTMLElement;
    return { touch: getComputedStyle(sb).touchAction, scrollable: sb.scrollHeight > sb.clientHeight };
  });
  expect(r.scrollable).toBe(true);
  expect(r.touch).toBe('pan-y');
});
