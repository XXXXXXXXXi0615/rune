// Acceptance screenshot + computed-font evidence for the Typography Runtime Hotfix.
// Run from project root: node scripts/typography-acceptance-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts/typography';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || 'http://localhost:4173';

function log(...a) { console.log('[shots]', ...a); }

async function ready(page) {
  await page.waitForSelector('.typography-settings', { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !document.documentElement.classList.contains('boot-lock'), undefined, { timeout: 20000 }).catch(() => {});
}

async function gotoPage(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('boot-lock'), undefined, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
}

function readFonts(page) {
  return page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el).fontFamily : null);
    const root = document.documentElement;
    const btn = document.querySelector('button:not([disabled])');
    const sidebar = document.querySelector('nav, .app-sidebar, .desktop-sidebar, aside');
    return {
      fontDisplay: getComputedStyle(root).getPropertyValue('--font-display').trim(),
      fontBody: getComputedStyle(root).getPropertyValue('--font-body').trim(),
      bodyFont: cs(document.body),
      sidebarFont: cs(sidebar),
      buttonFont: cs(btn),
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  sessionStorage.setItem('lunartide_auth_unlocked', 'true');
  if (!localStorage.getItem('lunartide_data')) {
    localStorage.setItem('lunartide_data', JSON.stringify({ state: { auth: { authEnabled: false } }, version: 0 }));
  }
  localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
});
await page.route('**://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('**://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));

try {
  // 1) Before selecting a different font combo
  await gotoPage(page, '/settings/appearance/fonts');
  await ready(page);
  await page.screenshot({ path: `${OUT}/01-combos-default.png`, fullPage: false });
  log('shot 1: combos default');

  // 2) Draft preview — select a different combo (月潮書頁 / Noto Serif TC)
  await page.locator('.typo-combo-card', { hasText: '月潮書頁' }).first().click().catch(async () => {
    await page.locator('.typo-combo-card').nth(1).click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-draft-preview.png`, fullPage: false });
  log('shot 2: draft preview (combo selected)');

  // 3) Apply → Home (verify global font propagated)
  await page.locator('[data-testid="typo-apply"]').click();
  await page.waitForTimeout(400);
  await gotoPage(page, '/');
  const homeFonts = await readFonts(page);
  log('home fonts after apply:', JSON.stringify(homeFonts));
  await page.screenshot({ path: `${OUT}/03-home-after-apply.png`, fullPage: false });
  log('shot 3: home after apply');

  // 4) Sidebar computed font-family
  await gotoPage(page, '/settings/appearance/fonts');
  await ready(page);
  const settingsFonts = await readFonts(page);
  log('settings fonts after apply:', JSON.stringify(settingsFonts));
  await page.screenshot({ path: `${OUT}/04-sidebar-fonts.png`, fullPage: false });
  log('shot 4: sidebar/fonts in settings');

  // 5) Chat page
  await gotoPage(page, '/chat');
  const chatFonts = await readFonts(page);
  log('chat fonts:', JSON.stringify(chatFonts));
  await page.screenshot({ path: `${OUT}/05-chat.png`, fullPage: false });
  log('shot 5: chat page');

  // 6) MoonRead page
  await gotoPage(page, '/moonread');
  const moonFonts = await readFonts(page);
  log('moonread fonts:', JSON.stringify(moonFonts));
  await page.screenshot({ path: `${OUT}/06-moonread.png`, fullPage: false });
  log('shot 6: moonread page');

  // 7) Modal / Popover — open reset confirmation dialog
  await gotoPage(page, '/settings/appearance/fonts');
  await ready(page);
  await page.locator('button:has-text("恢復月潮默認")').click();
  await page.waitForSelector('text=確認恢復月潮預設字體設定', { timeout: 3000 });
  await page.screenshot({ path: `${OUT}/07-modal.png`, fullPage: false });
  await page.locator('button:has-text("取消"):not([disabled])').first().click();
  log('shot 7: modal/popover');

  // 8) After refresh — token should persist
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const reloadFonts = await readFonts(page);
  log('fonts after refresh:', JSON.stringify(reloadFonts));
  await page.screenshot({ path: `${OUT}/08-after-refresh.png`, fullPage: false });
  log('shot 8: after refresh (persisted)');

  // 9) Last card fully above footer — scroll to bottom of the scroll area
  await page.locator('text=標題字體').click();
  await page.waitForSelector('.typo-font-grid', { timeout: 5000 });
  await page.evaluate(() => {
    const sa = document.querySelector('.typo-scroll-area');
    if (sa) sa.scrollTop = sa.scrollHeight;
  });
  await page.waitForTimeout(300);
  const footerGeo = await page.evaluate(() => {
    const sa = document.querySelector('.typo-scroll-area');
    const footer = document.querySelector('.typo-actions');
    if (!sa || !footer) return null;
    const cards = sa.querySelectorAll('.typo-font-card');
    const fr = footer.getBoundingClientRect();
    let lastBottom = 0;
    cards.forEach((c) => { const b = c.getBoundingClientRect().bottom; if (b < fr.top + 4 && b > lastBottom) lastBottom = b; });
    return { footerTop: fr.top, lastCardBottom: lastBottom, gap: fr.top - lastBottom };
  });
  log('footer geometry (last card above footer):', JSON.stringify(footerGeo));
  await page.screenshot({ path: `${OUT}/09-last-card-above-footer.png`, fullPage: false });
  log('shot 9: last card above footer');

  // 10) 390px viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoPage(page, '/settings/appearance/fonts');
  await ready(page);
  await page.locator('text=標題字體').click();
  await page.waitForSelector('.typo-font-grid', { timeout: 5000 });
  await page.evaluate(() => { const sa = document.querySelector('.typo-scroll-area'); if (sa) sa.scrollTop = sa.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/10-390px.png`, fullPage: false });
  log('shot 10: 390px viewport');
} catch (err) {
  log('ERROR', err && err.message ? err.message : err);
  process.exitCode = 1;
} finally {
  await browser.close();
  log('done');
}
