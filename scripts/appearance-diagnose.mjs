// Diagnostic: reproduce the mixed-theme bug and dump computed styles.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

function dump(page, label) {
  return page.evaluate((lbl) => {
    const root = document.documentElement;
    const csVar = (el, name) => el ? getComputedStyle(el).getPropertyValue(name).trim() : null;
    const pick = (sel) => document.querySelector(sel);
    const info = (sel) => {
      const el = pick(sel);
      if (!el) return { sel, found: false };
      const cs = getComputedStyle(el);
      return {
        sel, found: true,
        bg: cs.background,
        color: cs.color,
        opacity: cs.opacity,
        '--bg': csVar(el, '--bg'),
        '--surface': csVar(el, '--surface'),
        '--surface-3': csVar(el, '--surface-3'),
        '--text': csVar(el, '--text'),
      };
    };
    return {
      label: lbl,
      html: {
        theme: root.getAttribute('data-theme'),
        preset: root.getAttribute('data-theme-preset'),
        '--bg': csVar(root, '--bg'),
        '--surface': csVar(root, '--surface'),
        '--surface-3': csVar(root, '--surface-3'),
      },
      body: info('body'),
      root: info('#root'),
      appShell: info('.app-shell'),
      appMain: info('.app-main, .app-main--settings'),
      sidebar: info('aside.desktop-sidebar'),
      sidebarFooter: info('.desktop-sidebar-footer'),
      sidebarNav: info('.desktop-nav'),
      moduleGrid: info('.desktop-module-grid'),
      settingsDetail: info('.settings-detail, .ios-detail-scroll'),
      settingsCard: info('.glass-card, .settings-card, .theme-preset-option'),
      dialog: info('[role="dialog"], .theme-preset-sheet'),
    };
  }, label);
}

function log(...a) { console.log('[diag]', ...a); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();

await page.addInitScript(() => {
  sessionStorage.setItem('lunartide_auth_unlocked', 'true');
  if (!localStorage.getItem('lunartide_data')) {
    localStorage.setItem('lunartide_data', JSON.stringify({ state: { auth: { authEnabled: false } }, version: 0 }));
  }
  localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
});

const safe = async (name, fn) => {
  try { await fn(); } catch (e) { log(`step ${name} failed:`, e.message); }
};

const ensureAccordionOpen = async (name) => {
  const el = page.locator('.settings-accordion-header', { hasText: name }).first();
  if (await el.count() === 0) return;
  const expanded = await el.getAttribute('aria-expanded').catch(() => 'false');
  if (expanded !== 'true') await el.click({ timeout: 5000 });
};
const openPreset = async () => {
  await ensureAccordionOpen('外觀');
  await safe('preset', () => page.locator('.glass-row, .settings-standard-row', { hasText: '外觀預設' }).first().click({ timeout: 5000 }));
};
const selectOpt = (name) => safe('select', () => page.locator('.theme-preset-option', { hasText: name }).first().click({ timeout: 5000 }));
const clickBtn = (name) => safe('btn', () => page.locator('.theme-preset-sheet button', { hasText: name }).first().click({ timeout: 5000 }));

try {
  await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  log('A (initial, system-dark):', JSON.stringify(await dump(page, 'A'), null, 2));

  await openPreset();
  await page.waitForSelector('.theme-preset-sheet', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  log('B (dialog open):', JSON.stringify(await dump(page, 'B'), null, 2));

  await selectOpt('Lunartide');
  await page.waitForTimeout(300);
  log('C (preview Lunartide):', JSON.stringify(await dump(page, 'C'), null, 2));

  await clickBtn('套用');
  await page.waitForTimeout(400);
  log('D (applied Lunartide):', JSON.stringify(await dump(page, 'D'), null, 2));

  await openPreset();
  await page.waitForSelector('.theme-preset-sheet', { timeout: 5000 }).catch(() => {});
  await selectOpt('Island Breeze');
  await page.waitForTimeout(300);
  log('E (preview Island Breeze):', JSON.stringify(await dump(page, 'E'), null, 2));

  await clickBtn('套用');
  await page.waitForTimeout(400);
  log('F (applied Island Breeze, system-dark):', JSON.stringify(await dump(page, 'F'), null, 2));

  await openPreset();
  await page.waitForSelector('.theme-preset-sheet', { timeout: 5000 }).catch(() => {});
  await selectOpt('Lunartide');
  await page.waitForTimeout(200);
  await clickBtn('取消');
  await page.waitForTimeout(400);
  log('G (after cancel -> should stay Island Breeze):', JSON.stringify(await dump(page, 'G'), null, 2));
} catch (err) {
  log('ERROR', err && err.message ? err.message : err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
