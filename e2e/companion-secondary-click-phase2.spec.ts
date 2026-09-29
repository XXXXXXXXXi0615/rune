import { expect, test, type Page } from '@playwright/test';
import { clickCompanion, companionHitPoint, dragCompanion } from './helpers/companion';
import { prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

const KEY = 'lunartide-companion-pet-v1';
const pet = (page: Page) => page.locator('.companion-pet');
const menu = (page: Page) => page.getByTestId('companion-menu');
const state = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state.preferences, KEY);

async function boot(page: Page, routePresentation: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await unlockWithDefaults(page);
  await page.addInitScript(({ key, route }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ state: { preferences: {
      version: 6, enabled: true, manuallyHidden: false, pinned: false, scale: 1,
      selectedPetPackId: 'clawd', routePresentation: route,
    } }, version: 6 }));
  }, { key: KEY, route: routePresentation });
  await page.goto('/stash');
  await prepareInteractiveApp(page);
  await expect(pet(page)).toBeVisible();
}

async function rightClick(page: Page) {
  const { x, y } = await companionHitPoint(page);
  await page.mouse.click(x, y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
}

test.describe('Companion secondary click', () => {

    test('right click opens, does not drag, Escape and outside click restore focus', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', (error) => errors.push(String(error)));
      await boot(page);
      const before = await state(page);
      await rightClick(page);
      await expect(pet(page)).not.toHaveClass(/is-dragging/);
      expect((await state(page)).routePresentation).toEqual(before.routePresentation);
      await page.keyboard.press('Escape');
      await expect(menu(page)).toHaveCount(0);
      await expect(pet(page)).toBeFocused();
      await rightClick(page);
      await page.mouse.click(12, 300);
      await expect(menu(page)).toHaveCount(0);
      await expect(pet(page)).toBeFocused();
      await clickCompanion(page);
      await expect(menu(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await dragCompanion(page, -35, -30, { settle: 320 });
      expect((await state(page)).routePresentation['/stash']).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      expect(errors).toEqual([]);
    });

    test('route scale, reset, lock, hide and Launcher recovery retain canonical boundaries', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', (error) => errors.push(String(error)));
      await boot(page, { '/stash': { x: .7, y: .5, scale: 1.1 }, '/': { hidden: true, x: .3 } });
      await rightClick(page);
      await page.getByRole('button', { name: '放大此頁桌寵' }).click();
      expect((await state(page)).routePresentation['/stash'].scale).toBeCloseTo(1.15);
      expect((await state(page)).scale).toBe(1);
      await page.getByRole('button', { name: '重設此頁位置' }).click();
      expect((await state(page)).routePresentation['/stash']).toBeUndefined();
      expect((await state(page)).routePresentation['/']).toEqual({ hidden: true, x: .3 });
      await rightClick(page);
      await page.getByTestId('companion-lock-toggle').click();
      await expect(pet(page)).toBeDisabled();
      expect((await state(page)).pinned).toBe(true);
      await page.keyboard.press('Escape');
      await expect(menu(page)).toHaveCount(0);
      const launcher = page.getByTestId('route-status-island');
      await launcher.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '找回桌寵', exact: true }).click();
      await page.getByRole('button', { name: '解除鎖定' }).click();
      await page.keyboard.press('Escape');
      await expect(pet(page)).toBeEnabled();
      await rightClick(page);
      const beforeHide = await state(page);
      await page.getByTestId('companion-hide-route').click();
      await expect(pet(page)).toHaveCount(0);
      const hidden = await state(page);
      expect(hidden.routePresentation['/stash']).toEqual({ ...beforeHide.routePresentation['/stash'], hidden: true });
      expect(hidden.enabled).toBe(beforeHide.enabled);
      expect(hidden.manuallyHidden).toBe(beforeHide.manuallyHidden);
      expect(hidden.routePresentation['/']).toEqual(beforeHide.routePresentation['/']);
      await launcher.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '找回桌寵', exact: true }).click();
      await page.getByRole('button', { name: '在目前頁面顯示' }).click();
      await page.keyboard.press('Escape');
      await expect(pet(page)).toBeVisible();
      expect((await state(page)).routePresentation['/stash'].hidden).toBe(false);
      expect(errors).toEqual([]);
    });

    test('desktop context menu stays within viewport at each edge', async ({ page }) => {
      await boot(page);
      for (const [x, y] of [[1, 1], [1439, 1], [1, 899], [1439, 899]]) {
        await pet(page).evaluate((node, point) => node.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 2,
        })), { x, y });
        await expect(menu(page)).toBeVisible();
        const rect = await menu(page).boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(1440);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(900);
        await page.keyboard.press('Escape');
      }
    });
});
