import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

/**
 * Rune Daily Status Window Resize Phase 1 — Desktop Resizable Float.
 *
 * Contract under test:
 *  - desktop TodayStatusFloat gets ONE bottom-right resize handle (width + max-height cap),
 *    mobile keeps the frozen sheet with no handle and no desktop size leaking in;
 *  - geometry stays in the single canonical owner (component state +
 *    `lunartide-daily-tide-window-position`, payload `{ x, y, width?, maxHeight? }`);
 *  - clamps: width 360–720 (≤ viewport − 32), height cap 300 – min(72dvh, viewport − y − 12);
 *  - shell keeps `height: auto` + `.dt-dock-body` internal scroll;
 *  - resize never starts a window drag, never blocks a control, Escape cancels (does not close).
 */

const EVIDENCE = 'docs/reports/evidence/rune-daily-status-window-resize-phase1';
const POS_KEY = 'lunartide-daily-tide-window-position';

const TODAY = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
})();

async function boot(
  page: Page,
  options: { width?: number; height?: number; geometry?: string | null; lockEnabled?: boolean } = {},
) {
  const errors = collectErrors(page);
  await unlockWithDefaults(page);
  await page.addInitScript(({ geometry, lockEnabled, today }) => {
    if (!localStorage.getItem('lunartide-check-in')) {
      localStorage.setItem('lunartide-check-in', JSON.stringify({
        version: 1,
        state: {
          records: [{
            id: 'resize-1', date: today, kind: 'clock_in', status: 'completed',
            clockInAt: `${today}T08:00:00.000Z`, clockOutAt: null, isLate: false, graceMinutesUsed: 0,
            report: null, makeupReason: null, moonDewAwarded: 10, ticketNumber: `RSZ-${today}`,
            createdAt: `${today}T08:00:00.000Z`, updatedAt: `${today}T08:00:00.000Z`,
          }],
          corrections: [], settlements: [],
          policy: { mode: 'simple', clockInDeadline: '23:59', clockOutDeadline: '23:59', graceMinutes: 30, makeupHours: 48, consequenceLevel: 'standard', requireReport: false },
          milestoneRewards: [3, 7, 14, 30, 60, 100].map((day) => ({ day, claimed: false, claimedAt: null, rewardType: 'stamp' })),
          dismissedTodayDate: null,
        },
      }));
    }
    if (!localStorage.getItem('lunartide-hydration-v1')) {
      localStorage.setItem('lunartide-hydration-v1', JSON.stringify({ state: { entries: [], settings: { dailyGoalMl: 2000, quickAmounts: [100, 250, 500] } }, version: 2 }));
    }
    if (lockEnabled) {
      localStorage.setItem('lunartide-usage', JSON.stringify({ state: {
        sessions: [], dailyRecords: [],
        lockSettings: { enabled: true, dailyLimitMinutes: 120, allowTemporaryExtension: false },
        temporaryExtensionMinutes: 0, extensionExpiresAt: 0,
      }, version: 0 }));
    }
    if (geometry !== undefined) {
      if (geometry === null) localStorage.removeItem('lunartide-daily-tide-window-position');
      else localStorage.setItem('lunartide-daily-tide-window-position', geometry);
    }
  }, { geometry: options.geometry ?? null, lockEnabled: options.lockEnabled ?? false, today: TODAY });
  await page.setViewportSize({ width: options.width ?? 1440, height: options.height ?? 900 });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 20_000 });
  await prepareInteractiveApp(page);
  return errors;
}

const shell = (page: Page) => page.locator('.dt-window, .dt-sheet');
const handle = (page: Page) => page.locator('.dt-window [data-dt-resize]');

async function openFloat(page: Page) {
  await page.getByTestId('top-utility-main').click();
  await expect(shell(page)).toBeVisible({ timeout: 15_000 });
}

const storedGeometry = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), POS_KEY);

const audit = (page: Page) => page.evaluate(() => {
  const win = document.querySelector<HTMLElement>('.dt-window, .dt-sheet')!;
  const body = win.querySelector<HTMLElement>('.dt-dock-body')!;
  const rect = win.getBoundingClientRect();
  return {
    width: Math.round(rect.width * 10) / 10,
    height: Math.round(rect.height * 10) / 10,
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    maxHeight: getComputedStyle(win).maxHeight,
    bodyScrollable: body.scrollHeight > body.clientHeight + 1,
    bodyScrollHeight: body.scrollHeight,
    bodyClientHeight: body.clientHeight,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    isSheet: win.classList.contains('dt-sheet'),
  };
});

/** Poll-based geometry assertions: React commits the size asynchronously, so a
 *  raw read right after an interaction can still observe the previous frame. */
const expectWidth = (page: Page, width: number) =>
  expect.poll(async () => (await audit(page)).width, { timeout: 5000, message: `width should settle at ${width}` }).toBe(width);
const expectMaxHeightPx = (page: Page, px: number) =>
  expect.poll(async () => Number.parseFloat((await audit(page)).maxHeight), { timeout: 5000, message: `max-height should settle at ${px}px` }).toBe(px);
const expectMaxHeightText = (page: Page, value: string) =>
  expect.poll(async () => (await audit(page)).maxHeight, { timeout: 5000 }).toBe(value);

/** Drag the resize handle by a delta (mouse gesture, pointer capture path). */
async function dragHandle(page: Page, dx: number, dy: number) {
  const box = await handle(page).boundingBox();
  if (!box) throw new Error('resize handle has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test.beforeAll(async () => { await mkdir(EVIDENCE, { recursive: true }); });

/* ── A. Default geometry + handle contract ── */
test('A. desktop keeps the 640px default width and exposes one terminal resize handle', async ({ page }, testInfo) => {
  const errors = await boot(page);
  await openFloat(page);
  const before = await audit(page);
  expect(before.isSheet).toBe(false);
  expect(before.width).toBe(640);
  expect(before.maxHeight).toBe('648px');

  await expect(handle(page)).toHaveCount(1);
  const handleStyle = await handle(page).evaluate((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return { cursor: style.cursor, touchAction: style.touchAction, w: Math.round(box.width), h: Math.round(box.height), label: node.getAttribute('aria-label'), title: node.getAttribute('title') };
  });
  expect(handleStyle.cursor).toBe('nwse-resize');
  expect(handleStyle.touchAction).toBe('none');
  expect(handleStyle.w).toBeGreaterThanOrEqual(24);
  expect(handleStyle.h).toBeGreaterThanOrEqual(24);
  expect(handleStyle.label).toBe('調整視窗大小');
  expect(handleStyle.title).toBe('調整視窗大小');

  // No other resize affordance exists (single bottom-right handle, no native resize).
  expect(await page.locator('[data-dt-resize]').count()).toBe(1);
  const shellStyle = await shell(page).evaluate((node) => ({ resize: getComputedStyle(node).resize, overflow: getComputedStyle(node).overflowY, height: getComputedStyle(node).height }));
  expect(shellStyle.resize).toBe('none');
  expect(shellStyle.overflow).toBe('hidden');
  expect(shellStyle.height).not.toBe('648px');

  // A user who never resized keeps the legacy payload shape.
  const stored = await storedGeometry(page);
  expect(stored).toEqual({ x: stored.x, y: stored.y });

  // A keyboard interaction first, so programmatic focus matches :focus-visible.
  await page.keyboard.press('Tab');
  await handle(page).focus();
  const ring = await handle(page).evaluate((node) => {
    const style = getComputedStyle(node);
    return { focused: document.activeElement === node, width: style.outlineWidth, style: style.outlineStyle, offset: style.outlineOffset, color: style.outlineColor };
  });
  expect(ring.focused).toBe(true);
  expect(ring.style).toBe('solid');
  expect(ring.width).toBe('2px');
  expect(ring.offset).toBe('2px');
  expect(ring.color).toBe('rgb(169, 243, 199)');

  if (testInfo.project.name === 'chromium') await page.screenshot({ path: `${EVIDENCE}/A-default-1440.png` });
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── B. Width drag: 640 → 480 → floor → ceiling ── */
test('B. width drag moves 640 → 480, clamps at the 360 floor and the 720 ceiling, and persists', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);

  await dragHandle(page, -160, 0);
  await expectWidth(page, 480);
  expect((await storedGeometry(page)).width).toBe(480);

  await dragHandle(page, -600, 0);
  await expectWidth(page, 360);
  expect((await storedGeometry(page)).width).toBe(360);

  await dragHandle(page, 900, 0);
  await expectWidth(page, 720);
  expect((await storedGeometry(page)).width).toBe(720);

  // Shrinking again still lands on the floor, never below it.
  await dragHandle(page, -900, 0);
  await expectWidth(page, 360);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── C. Height cap: floor 300, ceiling 72dvh, hug + internal scroll preserved ── */
test('C. height is a cap: 300px floor, never above 72dvh, body stays the only scroll owner', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);

  await dragHandle(page, 0, -600);
  await expectMaxHeightText(page, '300px');
  const small = await audit(page);
  expect(small.height).toBe(300);
  expect(small.bodyScrollable).toBe(true);
  expect((await storedGeometry(page)).maxHeight).toBe(300);

  await dragHandle(page, 0, 900);
  await expectMaxHeightText(page, '648px');
  const large = await audit(page);
  expect(large.height).toBeLessThanOrEqual(648 + 1);
  // Content-hug: the shell is only as tall as its content while content < cap.
  expect(large.height).toBeLessThan(648);
  expect(large.bodyScrollable).toBe(false);
  expect((await storedGeometry(page)).maxHeight).toBe(648);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── D. Position re-clamps after a resize ── */
test('D. a resized shell stays inside the viewport (right and bottom edges included)', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);
  // Park the window near the bottom-right corner first (header drag).
  const header = page.locator('.dt-window .dt-dock-header');
  const headerBox = await header.boundingBox();
  await page.mouse.move(headerBox!.x + headerBox!.width / 2, headerBox!.y + headerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox!.x + headerBox!.width / 2 + 900, headerBox!.y + headerBox!.height / 2 + 900, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const parked = await audit(page);
  expect(parked.right).toBeLessThanOrEqual(parked.viewport.width - 11);
  expect(parked.bottom).toBeLessThanOrEqual(parked.viewport.height - 11);

  // Grow the height cap while parked low: the clamp must consider the current y.
  await dragHandle(page, 0, 400);
  const grown = await audit(page);
  expect(grown.bottom).toBeLessThanOrEqual(grown.viewport.height - 11);
  expect(grown.right).toBeLessThanOrEqual(grown.viewport.width - 11);

  // Grow the width while parked right: the x position re-clamps instead of overflowing.
  await dragHandle(page, 400, 0);
  await expect.poll(async () => (await audit(page)).width).toBeGreaterThan(600);
  const wide = await audit(page);
  expect(wide.right).toBeLessThanOrEqual(wide.viewport.width - 11);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── E. Persistence: close/reopen, legacy payload, reset ── */
test('E. size survives close/reopen, legacy { x, y } payloads stay valid, reset restores the defaults', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);
  await dragHandle(page, -160, -200);
  await expectWidth(page, 480);
  const payload = await storedGeometry(page);
  expect(payload.width).toBe(480);
  expect(payload.maxHeight).toBeLessThan(648);

  await page.locator('.dt-window .dt-dock-close').click();
  await expect(shell(page)).toHaveCount(0);
  await openFloat(page);
  await expectWidth(page, 480);
  await expectMaxHeightText(page, `${payload.maxHeight}px`);

  // Reset window → default position + 640 + the frozen 72dvh cap; label is 重設視窗.
  const reset = page.locator('.dt-window .dt-dock-reset');
  await expect(reset).toHaveAttribute('aria-label', '重設視窗');
  await expect(reset).toHaveAttribute('title', '重設視窗');
  await reset.click();
  await expectWidth(page, 640);
  await expectMaxHeightText(page, '648px');
  const resetAudit = await audit(page);
  expect(resetAudit.right).toBeLessThanOrEqual(resetAudit.viewport.width - 23);
  const afterReset = await storedGeometry(page);
  expect(afterReset.width).toBeUndefined();
  expect(afterReset.maxHeight).toBeUndefined();
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('F. a legacy { x, y } payload restores position with default size and upgrades on resize', async ({ page }) => {
  const errors = await boot(page, { geometry: JSON.stringify({ x: 64, y: 96 }) });
  await openFloat(page);
  await expectWidth(page, 640);
  await expectMaxHeightText(page, '648px');
  const restored = await audit(page);
  expect(restored.x).toBe(64);
  expect(restored.y).toBe(96);
  expect(await storedGeometry(page)).toEqual({ x: 64, y: 96 });

  await dragHandle(page, -100, 0);
  await expectWidth(page, 540);
  expect((await storedGeometry(page)).width).toBe(540);
  expect((await storedGeometry(page)).x).toBe(64);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── G. Pointer contract: no window drag, no blocked controls ── */
test('G. resizing never moves the window and never blocks tabs, calendar or hydration controls', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);
  const before = await audit(page);
  await dragHandle(page, -260, -120);
  const after = await audit(page);
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);

  // Narrow (360) where the Phase 0 probe found the corner over `hyd-settings__toggle`.
  await dragHandle(page, -400, 0);
  await expectWidth(page, 360);

  await page.locator('.dt-window .dt-dock-tab[aria-label="飲水"]').click();
  const panel = page.locator('.dt-window');
  await expect(panel.getByTestId('hydration-tab')).toBeVisible();
  // Scroll the entry to the very bottom of the only scroll owner: that is the
  // position where the corner handle used to overlap it (Phase 0 probe).
  await panel.locator('.dt-dock-body').evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await page.waitForTimeout(120);
  const toggleReachable = await panel.getByTestId('hyd-settings-toggle').evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { reachable: hit === node || node.contains(hit), hitClass: hit?.className?.toString?.() ?? '' };
  });
  expect(toggleReachable.reachable, `hyd-settings-toggle hit test (${toggleReachable.hitClass})`).toBe(true);
  const handleHit = await handle(page).evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === node || node.contains(hit);
  });
  expect(handleHit).toBe(true);
  await panel.getByTestId('hyd-settings-toggle').click();
  await expect(panel.getByTestId('hyd-settings-view')).toBeVisible();
  await panel.getByTestId('hyd-settings-back').click();

  // Tabs + calendar still clickable at the resized geometry.
  await panel.locator('.dt-dock-tab[aria-label="使用"]').click();
  await expect(panel.getByText('最近 7 天')).toBeVisible();
  await panel.locator('.dt-dock-tab[aria-label="報備"]').click();
  await expect(panel.getByTestId('report-calendar')).toBeVisible();
  await panel.locator(`[data-date-key="${TODAY}"]`).click();
  await expect(panel.getByTestId('report-selected-date')).toBeVisible();
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── H. Escape + pointercancel ── */
test('H. Escape during a resize cancels it (and does not close); Escape outside a resize still closes', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);
  await dragHandle(page, -160, 0);
  await expectWidth(page, 480);
  const settled = await audit(page);

  // Start a resize, move, then Escape → geometry restored, window still open.
  const box = await handle(page).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 - 120, box!.y + box!.height / 2 + 60, { steps: 6 });
  await page.keyboard.press('Escape');
  await expect(shell(page)).toBeVisible();
  await expectWidth(page, 480);
  await expectMaxHeightText(page, settled.maxHeight);
  await page.mouse.up();
  await expectWidth(page, 480);

  // pointercancel restores the drag-start geometry too.
  const box2 = await handle(page).boundingBox();
  await page.mouse.move(box2!.x + box2!.width / 2, box2!.y + box2!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2!.x + box2!.width / 2 - 80, box2!.y + box2!.height / 2, { steps: 6 });
  await expect.poll(async () => (await audit(page)).width).toBeLessThan(480);
  await handle(page).evaluate((node) => node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })));
  await page.mouse.up();
  await expectWidth(page, 480);

  // No active gesture → Escape closes as before.
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveCount(0);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── I. Keyboard resize ── */
test('I. the handle is keyboard operable with the documented steps and clamps', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);
  await handle(page).focus();
  const start = await audit(page);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expectWidth(page, start.width + 16);
  await page.keyboard.press('ArrowLeft');
  await expectWidth(page, start.width + 8);
  await page.keyboard.press('Shift+ArrowRight');
  await expectWidth(page, start.width + 40);

  const capStart = parseFloat((await audit(page)).maxHeight);
  await page.keyboard.press('ArrowUp');
  await expectMaxHeightPx(page, capStart - 8);
  // Large step, then the frozen 72dvh ceiling stops it.
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowUp');
  await expectMaxHeightPx(page, capStart - 40);
  await page.keyboard.press('Shift+ArrowDown');
  await expectMaxHeightPx(page, capStart - 8);
  await page.keyboard.press('Shift+ArrowDown');
  await expectMaxHeightPx(page, capStart);

  // Clamps still apply from the keyboard.
  for (let i = 0; i < 40; i += 1) await page.keyboard.press('ArrowLeft');
  await expectWidth(page, 360);
  for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowUp');
  await expectMaxHeightPx(page, 300);
  const stored = await storedGeometry(page);
  expect(stored.width).toBe(360);
  expect(stored.maxHeight).toBe(300);
  const ring = await handle(page).evaluate((node) => getComputedStyle(node).outlineWidth);
  expect(ring).toBe('2px');
  expectClean(errors.pageErrors, errors.consoleErrors);
});

/* ── J. Mobile keeps the frozen sheet and ignores the desktop size ── */
for (const width of [360, 390, 430] as const) {
  test(`J. ${width}px keeps the mobile sheet, no handle, no desktop size leak`, async ({ page }) => {
    const errors = await boot(page, { width, height: width === 430 ? 932 : 844, geometry: JSON.stringify({ x: 700, y: 60, width: 480, maxHeight: 400 }) });
    await openFloat(page);
    const auditResult = await audit(page);
    expect(auditResult.isSheet).toBe(true);
    expect(auditResult.width).toBeLessThanOrEqual(430);
    expect(parseFloat(auditResult.maxHeight)).toBeGreaterThan(600);
    expect(await page.locator('[data-dt-resize]').count()).toBe(0);
    expect(await page.locator('.dt-sheet').count()).toBe(1);
    expect(await page.locator('.dt-window').count()).toBe(0);
    // Body is the only scroll owner; the sheet itself never overflows horizontally.
    const overflow = await page.locator('.dt-sheet').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expectClean(errors.pageErrors, errors.consoleErrors);
  });
}

/* ── L. Evidence: geometry metrics + screenshots for the resize states ── */
test('L. evidence — resized geometry metrics and screenshots', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'resize evidence is captured on chromium');
  const errors = await boot(page);
  await openFloat(page);
  const states: Record<string, unknown> = {};
  const capture = async (name: string) => {
    const measured = await audit(page);
    const stored = await storedGeometry(page);
    states[name] = { measured, stored };
    await page.screenshot({ path: `${EVIDENCE}/resize-${name}-1440.png` });
  };

  await capture('default-640');
  await dragHandle(page, -160, 0);
  await capture('resized-480');
  await dragHandle(page, -600, 0);
  await capture('floor-360');
  await dragHandle(page, 900, 0);
  await capture('ceiling-720');
  await dragHandle(page, -200, -600);
  await capture('height-floor-300');
  await dragHandle(page, 0, 900);
  await capture('height-ceiling-648');

  await writeFile(`${EVIDENCE}/metrics-resize-1440.json`, `${JSON.stringify(states, null, 2)}\n`);
  expectClean(errors.pageErrors, errors.consoleErrors);
});
/* ── K. Breakpoint dance: desktop geometry survives and re-clamps ── */
test('K. desktop → mobile → desktop preserves the saved size and re-clamps it', async ({ page }) => {
  const errors = await boot(page);
  await openFloat(page);
  await dragHandle(page, -160, 0);
  await expectWidth(page, 480);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  // Still open: the shell switches to the sheet, with no handle and no desktop size.
  const mobile = await audit(page);
  expect(mobile.isSheet).toBe(true);
  expect(mobile.width).toBeLessThanOrEqual(430);
  expect(await page.locator('[data-dt-resize]').count()).toBe(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(160);
  await expectWidth(page, 480);
  const desktop = await audit(page);
  expect(desktop.isSheet).toBe(false);
  expect(desktop.right).toBeLessThanOrEqual(desktop.viewport.width - 11);
  expect((await storedGeometry(page)).width).toBe(480);
  expectClean(errors.pageErrors, errors.consoleErrors);
});
