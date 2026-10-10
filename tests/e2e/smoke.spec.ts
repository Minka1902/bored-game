import { test, expect, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  return errs;
}

async function gameIds(page: Page): Promise<string[]> {
  await page.goto('/');
  return page.evaluate(() => (window as unknown as { __GAMES__: string[] }).__GAMES__);
}

/** True when the game drew something: a canvas pixel that isn't the untouched black, or DOM content. */
async function stageHasInk(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const stage = document.querySelector('#stage')!;
    const c = stage.querySelector('canvas');
    if (!c) return stage.querySelectorAll(':scope > :not(.hud):not(.hint)').length > 0;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 0) ink++;
    return ink > 10;
  });
}

async function poke(page: Page) {
  const box = (await page.locator('#stage').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + 40, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 40, box.y + box.height * 0.45, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
}

test('every game boots, survives input and resizing, and returns home', async ({ page }) => {
  const errs = collectErrors(page);
  for (const id of await gameIds(page)) {
    await page.goto(`/#/play/${id}`);
    await page.waitForSelector('#stage[data-ready="1"]');
    await poke(page);
    await page.waitForTimeout(400);
    expect(await stageHasInk(page), `${id} drew nothing`).toBe(true);
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: 700, height: 500 });
    await page.waitForTimeout(150);
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    expect(await stageHasInk(page), `${id} blank after resize`).toBe(true);
    await page.click('[data-act="home"]');
    await expect(page.locator('.tile').first()).toBeVisible();
  }
  expect(errs).toEqual([]);
});

test('shuffle storm does not break anything', async ({ page }) => {
  const errs = collectErrors(page);
  const [first] = await gameIds(page);
  await page.goto(`/#/play/${first}`);
  for (let i = 0; i < 40; i++) {
    await page.click('[data-act="shuffle"]');
    await page.waitForTimeout(30);
  }
  await page.waitForSelector('#stage[data-ready="1"]');
  expect(await page.locator('#stage').count()).toBe(1);
  expect(await page.locator('#stage canvas').count()).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('works offline after the first visit', async ({ page, context }) => {
  await gameIds(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.locator('.tile').first().click();
  await page.waitForSelector('#stage[data-ready="1"]');
  expect(await stageHasInk(page)).toBe(true);
  await context.setOffline(false);
});
