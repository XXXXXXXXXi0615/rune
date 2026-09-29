import { expect, test, type Page } from '@playwright/test';
import { unlockWithDefaults } from './helpers/unlock';

function collectRuntimeFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  void page.addInitScript(() => window.addEventListener('unhandledrejection', (event) => {
    const runtime = window as typeof window & { __settingsUnhandled?: string[] };
    (runtime.__settingsUnhandled ??= []).push(String(event.reason));
  }));
  return { consoleErrors, pageErrors };
}

async function expectClean(page: Page, failures: ReturnType<typeof collectRuntimeFailures>) {
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await page.evaluate(() => (window as typeof window & { __settingsUnhandled?: string[] }).__settingsUnhandled ?? [])).toEqual([]);
}

async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

test('Desktop settings removes status and identity entries while preserving permissions', async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await unlockWithDefaults(page); await gotoReady(page, '/settings');
  await expect(page.getByText('陪伴狀態', { exact: true })).toHaveCount(0);
  await expect(page.getByText('LUNARIS 狀態、連線與設定', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^LUNARIS/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^智能體/ })).toHaveCount(0);
  await expect(page.getByText('身份與頭像', { exact: true })).toHaveCount(0);
  await gotoReady(page, '/settings'); await page.locator('[data-settings-row="memory-worldbook"]').click(); await expect(page).toHaveURL(/\/settings\/lunaris\/memory$/);
  await expect(page.getByRole('heading', { name: '記憶與世界書' })).toBeVisible();
  await gotoReady(page, '/settings'); await expect(page.locator('#settings-view')).toBeVisible(); await page.screenshot({ path: 'e2e/screenshots/settings-companion-removed-desktop.png', fullPage: true });
  await expectClean(page, failures);
});

test('removed routes use replace redirect and Back does not loop', async ({ page }) => {
  const failures = collectRuntimeFailures(page); await unlockWithDefaults(page); await gotoReady(page, '/');
  await page.evaluate(() => { history.pushState({}, '', '/settings/lunaris/companion'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page).toHaveURL(/\/settings$/); await expect(page.getByText('陪伴狀態', { exact: true })).toHaveCount(0);
  await page.goBack(); await expect(page).not.toHaveURL(/\/settings\/lunaris\/(?:companion|status)$/);
  await page.evaluate(() => { history.pushState({}, '', '/settings/lunaris/status'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page).toHaveURL(/\/settings$/);
  await expectClean(page, failures);
});

test('removal leaves persisted memory, world-book, reading, music, focus and provider domains untouched', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('settings-removal-data-sentinel', JSON.stringify({ memory: 'memory-kept', worldBook: 'world-kept', reading: 'reading-kept', music: 'music-kept', focus: 'focus-kept', provider: 'provider-kept', persona: 'persona-kept' }));
  });
  await unlockWithDefaults(page); await gotoReady(page, '/settings/agent');
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('memory-kept');
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('world-kept');
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('reading-kept');
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('music-kept');
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('focus-kept');
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('provider-kept');
  expect(await page.evaluate(() => localStorage.getItem('settings-removal-data-sentinel'))).toContain('persona-kept');
});

test('390px settings has no orphan group or horizontal overflow', async ({ page }) => {
  const failures = collectRuntimeFailures(page); await page.setViewportSize({ width: 390, height: 844 }); await unlockWithDefaults(page); await gotoReady(page, '/settings'); await expect(page.locator('#settings-view')).toBeVisible();
  await expect(page.getByText('陪伴狀態', { exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: /^LUNARIS/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'e2e/screenshots/settings-companion-removed-390.png', fullPage: true });
  await expectClean(page, failures);
});
