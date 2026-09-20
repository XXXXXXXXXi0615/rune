import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

/**
 * Hydration Settings Consolidation Phase 1 — acceptance.
 *
 * Main view keeps the record surface only (no target list); 每日目標 and
 * 快捷補水設定 live in the secondary settings subview of the same Daily Tide
 * window, reusing the existing `useHydrationStore` owners exclusively.
 */

const EVIDENCE = 'docs/reports/evidence/hydration-settings-consolidation-phase1';

async function openHydrationTab(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await unlockWithDefaults(page);
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 15_000 });
  await prepareInteractiveApp(page);
  await page.getByTestId('top-utility-main').click();
  await page.locator('.usage-ctrl-checkin button').first().click();
  await expect(page.locator('.dt-window, .dt-sheet')).toBeVisible();
  await page.getByRole('button', { name: '今日飲水' }).click();
  const panel = page.getByTestId('hydration-tab');
  await expect(panel).toBeVisible();
  return panel;
}

async function openSettings(page: Page) {
  const panel = page.getByTestId('hydration-tab');
  await panel.getByTestId('hyd-settings-toggle').click();
  await expect(panel.getByTestId('hyd-settings-view')).toBeVisible();
  return panel;
}

async function backToMain(page: Page) {
  const panel = page.getByTestId('hydration-tab');
  await panel.getByTestId('hyd-settings-back').click();
  await expect(panel.getByTestId('hyd-summary')).toBeVisible();
  return panel;
}

test.beforeAll(async () => { await mkdir(EVIDENCE, { recursive: true }); });

test('main view keeps the record surface only — no target radio list', async ({ page, browserName }) => {
  const errors = collectErrors(page);
  const panel = await openHydrationTab(page);

  expect(await panel.evaluate((node) => node.getAttribute('data-hyd-view'))).toBe('main');
  await expect(panel.getByTestId('hyd-summary')).toContainText('/ 2000 ml');
  await expect(panel.locator('.hyd-milestones')).toHaveCount(0);
  for (const milestone of [25, 50, 75, 100]) {
    await expect(panel.getByTestId(`hyd-milestone-${milestone}`)).toHaveCount(0);
  }
  await expect(panel.getByTestId('hyd-progress')).toBeVisible();
  await expect(panel.getByTestId('hyd-quick-row')).toBeVisible();
  await expect(panel.getByTestId('hyd-settings-toggle')).toBeVisible();
  await expect(page.getByTestId('hyd-autosave-note')).toHaveText('設定已同步');
  await page.screenshot({ path: `${EVIDENCE}/main-light-${browserName}.png`, fullPage: true });

  await page.locator('html').evaluate((element) => element.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: `${EVIDENCE}/main-dark-${browserName}.png`, fullPage: true });
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('settings subview changes the target and the main view updates on return', async ({ page, browserName }) => {
  const errors = collectErrors(page);
  await openHydrationTab(page);
  const panel = await openSettings(page);

  // Single subview: settings replaces the main view inside the same window.
  await expect(panel.getByTestId('hyd-summary')).toHaveCount(0);
  await expect(page.locator('.dt-window, .dt-sheet')).toHaveCount(1);
  await expect(page.getByTestId('hyd-settings-toggle')).toHaveCount(0);

  const option2500 = panel.getByTestId('hyd-goal-option-2500');
  await expect(option2500).toHaveAttribute('aria-checked', 'false');
  await panel.getByTestId('hyd-goal-option-2000').click();
  await expect(panel.getByTestId('hyd-goal-option-2000')).toHaveAttribute('aria-checked', 'true');
  await option2500.click();
  await expect(option2500).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${EVIDENCE}/settings-light-${browserName}.png`, fullPage: true });

  await page.locator('html').evaluate((element) => element.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: `${EVIDENCE}/settings-dark-${browserName}.png`, fullPage: true });

  await backToMain(page);
  await expect(panel.getByTestId('hyd-summary')).toContainText('/ 2500 ml');
  await expect(panel.getByTestId('hyd-remaining')).toHaveText('還差 2500 ml');
  await panel.getByTestId('hyd-quick-500').click();
  await expect(panel.getByTestId('hyd-pct')).toHaveText('20%');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide-hydration-v1') || '{}').state?.settings?.dailyGoalMl)).toBe(2500);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('custom target persists across reload; quick and custom refill stay unchanged', async ({ page }) => {
  const errors = collectErrors(page);
  await openHydrationTab(page);
  await openSettings(page);
  const panel = page.getByTestId('hydration-tab');

  await panel.getByTestId('hyd-goal-option-custom').click();
  const goalInput = panel.getByTestId('hyd-goal-input');
  await expect(goalInput).toBeVisible();
  await goalInput.fill('3200');
  await panel.getByTestId('hyd-goal-save').click();
  await expect(panel.getByTestId('hyd-goal-option-custom')).toHaveAttribute('aria-checked', 'true');
  await backToMain(page);
  await expect(panel.getByTestId('hyd-summary')).toContainText('/ 3200 ml');

  await page.reload({ waitUntil: 'commit' });
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 15_000 });
  await prepareInteractiveApp(page);
  await page.getByTestId('top-utility-main').click();
  await page.locator('.usage-ctrl-checkin button').first().click();
  await expect(page.locator('.dt-window, .dt-sheet')).toBeVisible();
  await page.getByRole('button', { name: '今日飲水' }).click();
  await expect(page.getByTestId('hydration-tab')).toBeVisible();
  await expect(page.getByTestId('hydration-tab').getByTestId('hyd-summary')).toContainText('/ 3200 ml');

  // Quick refill unchanged.
  await page.getByTestId('hydration-tab').getByTestId('hyd-quick-500').click();
  await expect(page.getByTestId('hyd-total')).toHaveText('500');
  // Custom refill unchanged.
  await page.getByTestId('hyd-custom-toggle').click();
  await page.getByTestId('hyd-custom-input').fill('300');
  await page.getByTestId('hyd-custom-add').click();
  await expect(page.getByTestId('hyd-total')).toHaveText('800');
  await expect(page.getByTestId('hyd-entry-row').first()).toContainText('300 ml');
  await expect(page.getByTestId('hyd-entry-row').first()).toContainText('自訂');
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('quick refill presets stay owner-backed and editable from settings', async ({ page }) => {
  const errors = collectErrors(page);
  await openHydrationTab(page);
  const panel = await openSettings(page);

  // Fresh install: the legacy cup bootstrap (200 ml) leads the canonical quick set.
  await expect(panel.getByTestId('hyd-quick-summary')).toHaveText('目前 +200 · +100 · +250 · +500 ml');
  await panel.getByTestId('hyd-quick-edit-toggle').click();
  // The quick editor stays a draft → 儲存 / 取消 flow; the footer only reports sync state.
  await expect(page.getByTestId('hyd-autosave-note')).toHaveText('設定已同步');
  await expect(panel.getByTestId('hyd-quick-save')).toHaveText('儲存');
  await expect(panel.getByRole('button', { name: '取消' })).toBeVisible();
  await panel.getByTestId('hyd-quick-input').fill('100, 200');
  await panel.getByTestId('hyd-quick-save').click();
  await expect(panel.getByTestId('hyd-quick-summary')).toHaveText('目前 +100 · +200 ml');
  await backToMain(page);
  await expect(panel.getByTestId('hyd-quick-row')).toContainText('+100');
  await expect(panel.getByTestId('hyd-quick-row')).toContainText('+200');
  await expect(panel.getByTestId('hyd-quick-row')).not.toContainText('+500');
  await panel.getByTestId('hyd-quick-200').click();
  await expect(panel.getByTestId('hyd-total')).toHaveText('200');
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('records and undo stay unchanged on the main view', async ({ page }) => {
  const errors = collectErrors(page);
  const panel = await openHydrationTab(page);

  await panel.getByTestId('hyd-quick-100').click();
  await panel.getByTestId('hyd-quick-250').click();
  const rows = panel.getByTestId('hyd-entry-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('250 ml');
  await expect(rows.first()).toContainText('快捷');
  await expect(panel.getByTestId('hyd-undo')).toBeVisible();
  await panel.getByTestId('hyd-undo').click();
  await expect(rows).toHaveCount(1);
  await expect(panel.getByTestId('hyd-total')).toHaveText('100');
  await rows.first().locator('button[aria-label*="刪除"]').click();
  await expect(panel.getByTestId('hyd-empty')).toBeVisible();
  expectClean(errors.pageErrors, errors.consoleErrors);
});

for (const width of [390, 430] as const) {
  test(`${width}px mobile — no overflow, touch-safe target controls, stable footer`, async ({ page, browserName }) => {
    const errors = collectErrors(page);
    const panel = await openHydrationTab(page, width, width === 390 ? 844 : 932);
    await panel.getByTestId('hyd-quick-500').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${EVIDENCE}/main-${width}-${browserName}.png`, fullPage: true });

    await openSettings(page);
    const geometry = await page.evaluate(() => {
      const options = [...document.querySelectorAll<HTMLElement>('.hyd-goal-option')];
      return options.map((option) => {
        const box = option.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { width: box.width, height: box.height, reachable: hit === option || option.contains(hit) };
      });
    });
    expect(geometry).toHaveLength(4);
    expect(geometry.every((box) => box.width >= 44 && box.height >= 44 && box.reachable)).toBe(true);

    // Footer CTA stays visible and hit-testable; only the body scrolls.
    const shell = await page.evaluate(() => {
      const win = document.querySelector<HTMLElement>('.dt-sheet, .dt-window')!;
      const body = win.querySelector<HTMLElement>('.dt-dock-body')!;
      const footer = win.querySelector<HTMLElement>('.dt-dock-footer')!;
      const cta = footer.querySelector<HTMLElement>('button')!;
      const ctaBox = cta.getBoundingClientRect();
      const hit = document.elementFromPoint(ctaBox.left + ctaBox.width / 2, ctaBox.top + ctaBox.height / 2);
      const before = { bodyTop: body.getBoundingClientRect().top, footerTop: footer.getBoundingClientRect().top };
      body.scrollTop = body.scrollHeight;
      const after = { bodyTop: body.getBoundingClientRect().top, footerTop: footer.getBoundingClientRect().top };
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ctaReachable: hit === cta || cta.contains(hit),
        bodyScrolls: body.scrollHeight >= body.clientHeight,
        footerStable: Math.abs(before.footerTop - after.footerTop) < 1,
        bodyStable: Math.abs(before.bodyTop - after.bodyTop) < 1,
      };
    });
    expect(shell.overflow).toBeLessThanOrEqual(0);
    expect(shell.ctaReachable).toBe(true);
    expect(shell.footerStable).toBe(true);
    expect(shell.bodyStable).toBe(true);
    await page.screenshot({ path: `${EVIDENCE}/settings-${width}-${browserName}.png`, fullPage: true });

    await backToMain(page);
    await expect(panel.getByTestId('hyd-summary')).toContainText('/ 2000 ml');
    expectClean(errors.pageErrors, errors.consoleErrors);
  });
}
