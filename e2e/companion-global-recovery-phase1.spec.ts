import { expect, test, type Page } from '@playwright/test';
import { dragCompanion } from './helpers/companion';
import { prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

const KEY = 'lunartide-companion-pet-v1';
const HOME_POSITION = { x: 0.966834531651671, y: 0.7049753982636547, scale: 1.35, hidden: true };
// The real 390px placement is reused verbatim. At the other viewports, use
// positions already accepted by the existing safe-region resolver so the
// recovery action can be tested without an unrelated relocation on reveal.
const homePositionFor = (width: number) => width === 1440
  ? { ...HOME_POSITION, x: 0.9614395886889462, y: 0.5772230889235569 }
  : width === 360 ? { ...HOME_POSITION, x: 0.956140350877193, y: 0.7960358056265985 }
    : HOME_POSITION;
const sizes = [
  { width: 1440, height: 900 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

async function boot(page: Page, size: { width: number; height: number }, preferences: Record<string, unknown>, path = '/') {
  await page.setViewportSize(size);
  await unlockWithDefaults(page);
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ state: { preferences: seed }, version: 6 }));
  }, { key: KEY, seed: { version: 6, enabled: true, manuallyHidden: false, pinned: false, scale: 1, selectedPetPackId: 'clawd', routePresentation: {}, ...preferences } });
  await page.goto(path);
  await prepareInteractiveApp(page);
}

const persisted = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state.preferences, KEY);

async function openRecovery(page: Page) {
  const launcher = page.getByTestId('route-status-island');
  await launcher.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'Rune 快捷工具' }).getByRole('menuitem')).toHaveCount(7);
  await page.getByRole('button', { name: '找回桌寵', exact: true }).click();
  await expect(page.getByTestId('companion-recovery-panel')).toBeVisible();
  const geometry = await page.getByTestId('companion-recovery-panel').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
}

async function closeRecovery(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('companion-recovery-panel')).toHaveCount(0);
  await expect(page.getByTestId('route-status-island')).toBeFocused();
}

for (const size of sizes) {
  test(`Home hidden recovery preserves placement at ${size.width}`, async ({ page }) => {
    const homePosition = homePositionFor(size.width);
    await boot(page, size, { routePresentation: { '/': homePosition } });
    await expect(page.getByTestId('companion-pet-host')).toHaveCount(0);
    await openRecovery(page);
    await expect(page.getByTestId('companion-recovery-panel')).toContainText('桌寵目前在此頁隱藏');
    await page.getByRole('button', { name: '在目前頁面顯示' }).click();
    expect((await persisted(page)).routePresentation['/']).toEqual({ ...homePosition, hidden: false });
    await closeRecovery(page);
    await expect(page.getByTestId('companion-pet-host')).toBeVisible();
    await page.reload();
    await prepareInteractiveApp(page);
    await expect(page.getByTestId('companion-pet-host')).toBeVisible();
    expect((await persisted(page)).routePresentation['/']).toEqual({ ...homePosition, hidden: false });
  });

  for (const [label, flags] of [
    ['enabled=false', { enabled: false }],
    ['manuallyHidden=true', { manuallyHidden: true }],
  ] as const) {
    test(`${label} recovers through Launcher at ${size.width}`, async ({ page }) => {
      await boot(page, size, flags, '/stash');
      await expect(page.getByTestId('companion-pet-host')).toHaveCount(0);
      await openRecovery(page);
      await page.getByRole('button', { name: '顯示桌寵', exact: true }).click();
      const next = await persisted(page);
      expect(next.enabled).toBe(true);
      expect(next.manuallyHidden).toBe(false);
      await closeRecovery(page);
      await expect(page.getByTestId('companion-pet-host')).toBeVisible();
    });
  }

  test(`pinned recovery permits drag and reload at ${size.width}`, async ({ page }) => {
    await boot(page, size, { pinned: true }, '/stash');
    await expect(page.locator('.companion-pet')).toBeDisabled();
    await expect(page.getByTestId('companion-hit')).toHaveCount(0);
    await openRecovery(page);
    await page.getByRole('button', { name: '解除鎖定' }).click();
    expect((await persisted(page)).pinned).toBe(false);
    await closeRecovery(page);
    await expect(page.getByTestId('companion-hit')).toBeAttached();
    const before = (await persisted(page)).routePresentation['/stash'];
    await dragCompanion(page, -75, -105, { settle: 1200 });
    const after = (await persisted(page)).routePresentation['/stash'];
    expect(after).toBeTruthy();
    expect(Math.abs(after.x - (before?.x ?? 0.86)) + Math.abs(after.y - (before?.y ?? 0.68))).toBeGreaterThan(0.02);
    await page.reload();
    await prepareInteractiveApp(page);
    await expect(page.getByTestId('companion-pet-host')).toBeVisible();
    expect((await persisted(page)).routePresentation['/stash']).toEqual(after);
  });

  test(`excluded routes give truthful recovery status at ${size.width}`, async ({ page }) => {
    await boot(page, size, { enabled: false }, '/calendar');
    for (const [path, text] of [
      ['/calendar', '桌寵目前不在此頁顯示'],
      ['/moonlex', '桌寵目前不在此頁顯示'],
      ['/music', '此頁目前不載入桌寵'],
      ['/tidewatch', '此頁目前不載入桌寵'],
      ['/settings', '桌寵目前不在設定頁顯示'],
    ]) {
      if (page.url().endsWith(path) === false) { await page.goto(path); await prepareInteractiveApp(page); }
      await openRecovery(page);
      await expect(page.getByTestId('companion-recovery-panel')).toContainText(text);
      await page.getByRole('button', { name: '顯示桌寵', exact: true }).click();
      await expect(page.getByTestId('companion-recovery-panel')).toContainText(text);
      await closeRecovery(page);
      await expect(page.getByTestId('companion-pet-host')).toHaveCount(path === '/calendar' || path === '/moonlex' ? 1 : 0);
    }
    expect((await persisted(page)).enabled).toBe(true);
  });

  test(`recovery footer is keyboard reachable at ${size.width}`, async ({ page }) => {
    await boot(page, size, { routePresentation: { '/': homePositionFor(size.width) } });
    const launcher = page.getByTestId('route-status-island');
    await launcher.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menu', { name: 'Rune 快捷工具' }).getByRole('menuitem').last().focus();
    await page.keyboard.press('Tab');
    const entry = page.getByRole('button', { name: '找回桌寵', exact: true });
    await expect(entry).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('companion-recovery-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: '顯示桌寵', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(launcher).toBeFocused();
  });
}

test('route reset is explicit and uses the canonical route reset action', async ({ page }) => {
  await boot(page, { width: 390, height: 844 }, { routePresentation: { '/': HOME_POSITION } });
  await openRecovery(page);
  expect((await persisted(page)).routePresentation['/']).toEqual(HOME_POSITION);
  await page.getByRole('button', { name: '重設目前頁面位置' }).click();
  expect((await persisted(page)).routePresentation['/']).toBeUndefined();
  await closeRecovery(page);
  await expect(page.getByTestId('companion-pet-host')).toBeVisible();
});
