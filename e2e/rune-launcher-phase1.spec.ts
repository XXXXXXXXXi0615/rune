import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

const ACTIONS = [
  ['Chat', '/chat'], ['Music', '/music'], ['素材庫', '/stash'], ['Calendar', '/calendar'],
  ['設定', '/settings'], ['Lexicon', '/moonlex'], ['觀測站', '/tidewatch'],
] as const;

async function boot(page: Page, width = 1440, height = 900, route = '/') {
  await page.setViewportSize({ width, height });
  await unlockWithDefaults(page);
  await page.goto(route);
  await prepareInteractiveApp(page);
}

const avatar = (page: Page) => page.getByTestId('route-status-island');
const menu = (page: Page) => page.getByRole('menu', { name: 'Rune 快捷工具' });

for (const width of [1440, 360, 390, 430]) {
  test(`launcher seven actions and focus contract at ${width}px`, async ({ page }) => {
    const errors = collectErrors(page);
    await boot(page, width);
    await expect(page.locator('.rune-orb')).toHaveCount(0);
    await expect(avatar(page)).toBeVisible();
    await expect(avatar(page)).toHaveAttribute('aria-label', '開啟 Rune 功能選單');
    await avatar(page).focus();
    await expect.poll(() => avatar(page).evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeVisible();
    if (width === 1440 || width === 390) await page.screenshot({ path: `test-results/rune-launcher-${width}-${test.info().project.name}.png`, fullPage: false });
    await expect(avatar(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(menu(page).getByRole('menuitem')).toHaveCount(7);
    const geometry = await page.evaluate(() => {
      const header = document.querySelector('.system-top-bar')!.getBoundingClientRect();
      const actions = [...document.querySelectorAll<HTMLElement>('.rune-launcher-action')].map((node) => node.getBoundingClientRect());
      return { headerBottom: header.bottom, actions: actions.map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })), vw: innerWidth, doc: document.documentElement.scrollWidth };
    });
    for (const rect of geometry.actions) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);
      if (width > 600) expect(rect.top).toBeGreaterThanOrEqual(geometry.headerBottom);
    }
    for (let index = 0; index < ACTIONS.length; index++) {
      await expect(menu(page).getByRole('menuitem').nth(index)).toHaveAttribute('aria-label', `打開${ACTIONS[index][0]}`);
    }
    if (width <= 600) await expect(menu(page).getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(menu(page).getByRole('menuitem').nth(width <= 600 ? 1 : 0)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(avatar(page)).toBeFocused();
    if (width <= 600) {
      await avatar(page).click();
      await page.getByRole('dialog', { name: 'Rune 快捷工具' }).getByRole('button', { name: '關閉' }).click();
      await expect(avatar(page)).toBeFocused();
    }
    await avatar(page).click();
    await expect(menu(page)).toBeVisible();
    if (width > 600) await page.mouse.click(1000, 500);
    else await page.locator('.rune-utility-sheet-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(menu(page)).toHaveCount(0);
    await expect(avatar(page)).toBeFocused();
    expect(geometry.doc).toBeLessThanOrEqual(geometry.vw);
    expectClean(errors.pageErrors, errors.consoleErrors);
  });
}

test('all seven actions preserve canonical routes', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page);
  for (const [label, path] of ACTIONS) {
    await avatar(page).click();
    await menu(page).getByRole('menuitem', { name: `打開${label}` }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
    await prepareInteractiveApp(page);
    await expect(avatar(page)).toHaveAttribute('aria-expanded', 'false');
  }
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('focus timer has its own trigger and returns focus after TIDEBOUND closes', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page, 390, 844);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tidebound:open-quick', { detail: { task: 'Launcher migration' } })));
  const panel = page.getByTestId('tidebound-quick-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '開始這一輪' }).click();
  await panel.getByRole('button', { name: '關閉 TIDEBOUND 快捷面板' }).click();
  const status = page.getByTestId('route-focus-status');
  await expect(status).toBeVisible();
  await avatar(page).click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await status.click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '關閉 TIDEBOUND 快捷面板' }).click();
  await expect(status).toBeFocused();
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('immersive routes exclude both launcher and legacy orb', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page);
  for (const path of ['/gacha', '/call']) {
    await page.goto(path);
    await prepareInteractiveApp(page);
    if (new URL(page.url()).pathname !== path) {
      expect(path).toBe('/call');
      continue; // /call without an active call follows its existing chat exit contract.
    }
    await expect(avatar(page)).toHaveCount(0);
    await expect(page.locator('.rune-orb, .rune-launcher-popover, .rune-utility-sheet')).toHaveCount(0);
  }
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('Daily Status default position releases the retired 88px rail', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.removeItem('lunartide-daily-tide-window-position'));
  await boot(page);
  await page.getByTestId('top-utility-main').click();
  const win = page.locator('.dt-window');
  await expect(win).toBeVisible();
  const data = await page.evaluate(() => {
    const rect = document.querySelector<HTMLElement>('.dt-window')!.getBoundingClientRect();
    const frame = document.querySelector<HTMLElement>('#app')!.getBoundingClientRect();
    const beforeRailLeft = frame.right - 88;
    return { actualX: rect.left, width: rect.width, viewport: innerWidth, oldX: beforeRailLeft - rect.width, expectedX: innerWidth - rect.width - 24 };
  });
  expect(data.actualX).toBeCloseTo(data.expectedX, 0);
  expect(data.actualX - data.oldX).toBeGreaterThan(88);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('launcher recedes Companion and preserves legacy orb position bytes', async ({ page }) => {
  const errors = collectErrors(page);
  const legacy = '{"edge":"left","normalizedY":0.37}';
  await page.addInitScript((value) => {
    const key = 'lunartide-rune-orb-position-v1';
    localStorage.setItem(key, value);
    const audit = { reads: 0, writes: 0, deletes: 0 };
    (window as typeof window & { __legacyOrbAccess?: typeof audit }).__legacyOrbAccess = audit;
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.getItem = function (name) { if (this === localStorage && name === key) audit.reads++; return getItem.call(this, name); };
    Storage.prototype.setItem = function (name, next) { if (this === localStorage && name === key) audit.writes++; return setItem.call(this, name, next); };
    Storage.prototype.removeItem = function (name) { if (this === localStorage && name === key) audit.deletes++; return removeItem.call(this, name); };
  }, legacy);
  await boot(page);
  await avatar(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/pet-recede/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/pet-recede/);
  expect(await page.evaluate(() => (window as typeof window & { __legacyOrbAccess: { reads: number; writes: number; deletes: number } }).__legacyOrbAccess)).toEqual({ reads: 0, writes: 0, deletes: 0 });
  expect(await page.evaluate(() => localStorage.getItem('lunartide-rune-orb-position-v1'))).toBe(legacy);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('paused focus keeps launcher and TIDEBOUND as separate controls', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page, 390, 844);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tidebound:open-quick', { detail: { task: 'Paused launcher' } })));
  const panel = page.getByTestId('tidebound-quick-panel');
  await panel.getByRole('button', { name: '開始這一輪' }).click();
  await panel.getByRole('button', { name: '暫停' }).click();
  await panel.getByRole('button', { name: '關閉 TIDEBOUND 快捷面板' }).click();
  await expect(page.locator('.route-status-group')).toHaveAttribute('data-mode', 'focus-paused');
  await avatar(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('route-focus-status').click();
  await expect(panel).toBeVisible();
  expectClean(errors.pageErrors, errors.consoleErrors);
});
