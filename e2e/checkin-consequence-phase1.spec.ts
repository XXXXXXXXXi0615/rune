import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

/**
 * Check-in Consequence Phase 1 — missed-day reconcile + consequence acceptance.
 *
 * The canonical owner is `useCheckInStore`; the live panel is the consolidated
 * 報備 window (`DailyTideFloatingWindow`). All fixtures use a fixed local clock
 * (2026-09-20 09:00) so day maths is deterministic.
 */

const EVIDENCE = 'docs/reports/evidence/checkin-consequence-phase1';
const NOW = new Date(2026, 8, 20, 9, 0, 0); // 2026-09-20 09:00 local

type Status = 'completed' | 'late' | 'makeup_required';

function record(date: string, status: Status = 'completed') {
  return {
    id: `seed-${date}-${status}`, date, kind: 'clock_in', status,
    clockInAt: status === 'makeup_required' ? null : `${date}T01:00:00.000Z`,
    clockOutAt: null, isLate: status === 'late', graceMinutesUsed: 0, report: null, makeupReason: null,
    moonDewAwarded: 0, ticketNumber: `T-${date}`, createdAt: `${date}T01:00:00.000Z`, updatedAt: `${date}T01:00:00.000Z`,
  };
}

function persisted(records: unknown[]) {
  return {
    version: 1,
    state: {
      records, corrections: [], settlements: [], milestoneRewards: [], dismissedTodayDate: null, acknowledgedMissedDate: null,
      policy: { mode: 'simple', clockInDeadline: '23:59', clockOutDeadline: '23:59', graceMinutes: 30, makeupHours: 48, consequenceLevel: 'standard', requireReport: false },
    },
  };
}

function checkInState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('lunartide-check-in') || '{}').state);
}

function missedDates(records: Array<{ date: string; status: string }>): string[] {
  return records.filter((row) => row.status === 'makeup_required').map((row) => row.date);
}

async function boot(page: Page, records: unknown[], options: { width?: number; height?: number; time?: Date } = {}) {
  const errors = collectErrors(page);
  await page.clock.install({ time: options.time ?? NOW });
  await unlockWithDefaults(page);
  await page.addInitScript((seed) => {
    if (!sessionStorage.getItem('checkin-consequence-seeded')) {
      localStorage.setItem('lunartide-check-in', JSON.stringify(seed));
      sessionStorage.setItem('checkin-consequence-seeded', '1');
    }
  }, persisted(records));
  await page.setViewportSize({ width: options.width ?? 1440, height: options.height ?? 900 });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 15_000 });
  await prepareInteractiveApp(page);
  return errors;
}

/** Island → 報備 → consolidated check-in window. */
async function openReportWindow(page: Page) {
  await page.getByTestId('top-utility-main').click();
  await page.locator('.usage-ctrl-checkin button').first().click();
  await expect(page.getByTestId('report-stats')).toBeVisible({ timeout: 15_000 });
}

async function closeReportWindow(page: Page) {
  await page.locator('.dt-dock-close').click();
  await expect(page.locator('.dt-window, .dt-sheet')).toHaveCount(0);
}

test.beforeAll(async () => { await mkdir(EVIDENCE, { recursive: true }); });

test('A — completed yesterday keeps the streak and shows no consequence', async ({ page, browserName }) => {
  const errors = await boot(page, ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'].map((date) => record(date)));
  await openReportWindow(page);

  const state = await checkInState(page);
  expect(missedDates(state.records)).toEqual([]);
  await expect(page.getByTestId('report-streak')).toHaveText('5');
  await expect(page.getByTestId('checkin-consequence')).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCE}/A-clean-${browserName}.png`, fullPage: true });
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('B — missed yesterday breaks the streak with zero tide progress', async ({ page, browserName }) => {
  const errors = await boot(page, [record('2026-09-18')]);
  await openReportWindow(page);

  const state = await checkInState(page);
  expect(missedDates(state.records)).toEqual(['2026-09-19']);
  await expect(page.getByTestId('report-streak')).toHaveText('0');
  await expect(page.locator('[data-date-key="2026-09-19"]')).toHaveClass(/dt-calendar-cell--missed/);
  // Tide progress (潮階) is ledger-owned: no negative, no rollback, no new grant.
  const ledger = await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide_data') || '{}').state?.moonDewLedger ?? []);
  expect(ledger.filter((entry: { source: string }) => entry.source === 'check_in')).toHaveLength(0);
  await expect(page.getByTestId('report-progression')).toContainText('潮階 · Lv1 初潮');
  await expect(page.getByTestId('report-progression')).toContainText('0 / 50');
  await page.screenshot({ path: `${EVIDENCE}/B-missed-state-${browserName}.png`, fullPage: true });
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('C — first panel entry presents the canonical consequence once', async ({ page, browserName }) => {
  const errors = await boot(page, [record('2026-09-18')]);
  await openReportWindow(page);

  const consequence = page.getByTestId('checkin-consequence');
  await expect(consequence).toBeVisible();
  await expect(consequence).toContainText('昨日漏簽');
  expect(await consequence.locator('.dt-consequence__voice').evaluate((element) => element.textContent))
    .toBe('「昨天沒來。\n『忘了』不是我接受的理由。\n現在，把今天該做的補上。」');
  await expect(consequence).toContainText('今天完成報備前，潮階不會前進。');
  expect((await checkInState(page)).acknowledgedMissedDate).toBe('2026-09-19');
  await page.screenshot({ path: `${EVIDENCE}/C-consequence-light-${browserName}.png`, fullPage: true });

  await page.locator('html').evaluate((element) => element.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: `${EVIDENCE}/C-consequence-dark-${browserName}.png`, fullPage: true });

  // Re-entering the panel in the same session does not replay it.
  await closeReportWindow(page);
  await openReportWindow(page);
  await expect(page.getByTestId('checkin-consequence')).toHaveCount(0);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('D — reload neither duplicates the missed entry nor replays the consequence', async ({ page }) => {
  const errors = await boot(page, [record('2026-09-18')]);
  await openReportWindow(page);
  await expect(page.getByTestId('checkin-consequence')).toBeVisible();
  await closeReportWindow(page);

  await page.reload({ waitUntil: 'commit' });
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 15_000 });
  await prepareInteractiveApp(page);
  await openReportWindow(page);

  const state = await checkInState(page);
  expect(missedDates(state.records)).toEqual(['2026-09-19']);
  expect(state.acknowledgedMissedDate).toBe('2026-09-19');
  await expect(page.getByTestId('checkin-consequence')).toHaveCount(0);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('E — completing today retires the consequence', async ({ page }) => {
  const errors = await boot(page, [record('2026-09-18')]);
  await openReportWindow(page);
  await expect(page.getByTestId('checkin-consequence')).toBeVisible();

  await page.getByTestId('report-action').click();
  await expect(page.getByTestId('report-today-result')).toBeVisible();
  await expect(page.getByTestId('checkin-consequence')).toHaveCount(0);

  const state = await checkInState(page);
  expect(state.records.some((row: { date: string; status: string }) => row.date === '2026-09-20' && row.status === 'completed')).toBe(true);
  expect(missedDates(state.records)).toEqual(['2026-09-19']);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('F — two consecutive missed days are marked once each and map to the missed calendar state', async ({ page, browserName }) => {
  const errors = await boot(page, [record('2026-09-17')]);
  await openReportWindow(page);

  let state = await checkInState(page);
  expect(missedDates(state.records)).toEqual(['2026-09-18', '2026-09-19']);
  await expect(page.locator('[data-date-key="2026-09-18"]')).toHaveClass(/dt-calendar-cell--missed/);
  await expect(page.locator('[data-date-key="2026-09-19"]')).toHaveClass(/dt-calendar-cell--missed/);
  await expect(page.locator('[data-date-key="2026-09-18"]')).toHaveAttribute('data-date-state', 'missed');
  await page.locator('.dt-calendar-grid').screenshot({ path: `${EVIDENCE}/F-two-misses-calendar-${browserName}.png` });

  await closeReportWindow(page);
  await page.reload({ waitUntil: 'commit' });
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 15_000 });
  await prepareInteractiveApp(page);
  await openReportWindow(page);
  state = await checkInState(page);
  expect(missedDates(state.records)).toEqual(['2026-09-18', '2026-09-19']);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('H — 23:59 → 00:00 rollover reconciles the previous day exactly once', async ({ page }) => {
  const errors = await boot(page, [record('2026-09-18')], { time: new Date(2026, 8, 19, 23, 59, 0) });
  await openReportWindow(page);
  expect(missedDates((await checkInState(page)).records)).toEqual([]);
  await closeReportWindow(page);

  await page.clock.fastForward(120_000); // 00:01 next local day — the day watcher reconciles
  await expect.poll(async () => missedDates((await checkInState(page)).records)).toEqual(['2026-09-19']);

  await page.clock.fastForward(60_000); // another watcher tick must not duplicate the entry
  expect(missedDates((await checkInState(page)).records)).toEqual(['2026-09-19']);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

for (const width of [390, 430] as const) {
  test(`I — ${width}px consequence stays inside the sheet and the CTA is reachable`, async ({ page, browserName }) => {
    const errors = await boot(page, [record('2026-09-18')], { width, height: width === 390 ? 844 : 932 });
    await openReportWindow(page);

    const consequence = page.getByTestId('checkin-consequence');
    await expect(consequence).toBeVisible();
    const geometry = await page.evaluate(() => {
      const cta = document.querySelector<HTMLElement>('[data-testid="report-action"]')!;
      const close = document.querySelector<HTMLElement>('[data-testid="checkin-consequence-close"]')!;
      const box = cta.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ctaVisible: box.width > 0 && box.height > 0,
        ctaReachable: hit === cta || cta.contains(hit),
        closeReachable: (() => {
          const closeBox = close.getBoundingClientRect();
          const closeHit = document.elementFromPoint(closeBox.left + closeBox.width / 2, closeBox.top + closeBox.height / 2);
          return closeHit === close || close.contains(closeHit);
        })(),
      };
    });
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    expect(geometry.ctaVisible).toBe(true);
    expect(geometry.ctaReachable).toBe(true);
    expect(geometry.closeReachable).toBe(true);
    await page.screenshot({ path: `${EVIDENCE}/I-${width}-${browserName}.png`, fullPage: true });
    expectClean(errors.pageErrors, errors.consoleErrors);
  });
}
