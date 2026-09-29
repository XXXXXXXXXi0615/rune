import { expect, test } from '@playwright/test';
import { collectErrors, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

for (const width of [360, 390, 430, 1440]) {
  test(`${width}px static Rune stays on the same map ground point`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height: width === 1440 ? 900 : width === 360 ? 800 : width === 390 ? 844 : 932 });
    await unlockWithDefaults(page);
    // Phase 1A measures the spawn/anchor contract with autonomous Phase 1C time paused.
    await page.goto('/?runeActorHarness=1');
    await prepareInteractiveApp(page);
    const world = page.getByTestId('rune-pixel-world');
    await expect(world).toHaveAttribute('data-art-state', 'available');
    const actor = page.getByTestId('rune-world-actor');
    await expect(actor).toHaveCount(1);
    await expect(actor.locator('img')).toHaveJSProperty('naturalWidth', 2688);
    const geometry = await actor.evaluate((node) => {
      const viewport = document.querySelector<HTMLElement>('.rune-pixel-world__viewport')!.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const x = Number((node as HTMLElement).style.getPropertyValue('--actor-x'));
      const y = Number((node as HTMLElement).style.getPropertyValue('--actor-y'));
      const anchorX = Number.parseFloat((node as HTMLElement).style.getPropertyValue('--actor-anchor-x')) / 100;
      const anchorY = Number.parseFloat((node as HTMLElement).style.getPropertyValue('--actor-anchor-y')) / 100;
      const groundX = box.left + box.width * anchorX;
      const groundY = box.top + box.height * anchorY;
      return {
        x, y, anchorX, anchorY,
        relativeX: (groundX - viewport.left) / viewport.width,
        relativeY: (groundY - viewport.top) / viewport.height,
        widthInWorld: box.width / viewport.width * 941,
        heightInWorld: box.height / viewport.height * 1672,
        contained: box.left >= viewport.left && box.right <= viewport.right && box.top >= viewport.top && box.bottom <= viewport.bottom,
        pointerEvents: style.pointerEvents,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(geometry.x).toBeCloseTo(480 / 941, 5);
    expect(geometry.y).toBeCloseTo(1020 / 1672, 5);
    expect(Math.abs(geometry.relativeX - geometry.x)).toBeLessThan(0.002);
    expect(Math.abs(geometry.relativeY - geometry.y)).toBeLessThan(0.002);
    // The one-pixel viewport border reduces the inner map box very slightly.
    expect(Math.abs(geometry.widthInWorld - 107.52)).toBeLessThan(1);
    expect(Math.abs(geometry.heightInWorld - 122.88)).toBeLessThan(1);
    expect(geometry.contained).toBe(true);
    expect(geometry.pointerEvents).toBe('none');
    expect(geometry.overflow).toBe(0);
    await page.locator('.app-main').evaluate((node) => { node.scrollTop = node.scrollHeight; });
    const scrolled = await actor.evaluate((node) => {
      const viewport = document.querySelector<HTMLElement>('.rune-pixel-world__viewport')!.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return [(box.left + box.width * 0.488095 - viewport.left) / viewport.width,
        (box.top + box.height * 0.903646 - viewport.top) / viewport.height];
    });
    expect(Math.abs(scrolled[0] - geometry.x)).toBeLessThan(0.002);
    expect(Math.abs(scrolled[1] - geometry.y)).toBeLessThan(0.002);
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: `e2e/screenshots/rune-world-actor-phase1a-${width}-${testInfo.project.name}.png`, fullPage: true });
    }
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });
}

test('missing actor image leaves map and route hotspots working', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/actors/rune/v0.1/character-rune-idle-4dir.runtime.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: 'invalid image data' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockWithDefaults(page);
  await page.goto('/');
  await prepareInteractiveApp(page);
  const world = page.getByTestId('rune-pixel-world');
  await expect(world).toHaveAttribute('data-art-state', 'available');
  await expect(page.getByTestId('rune-world-actor')).toHaveCount(0);
  await expect(world.locator('.rune-world-hotspot')).toHaveCount(6);
  await page.locator('[data-module-id="chat"]').click();
  await expect(page).toHaveURL(/\/chat$/);
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});
