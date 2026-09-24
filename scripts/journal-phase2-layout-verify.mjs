import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4199';

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('https://fonts.googleapis.com/*', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://fonts.gstatic.com/*', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => {
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
    if (!localStorage.getItem('lunartide_data')) {
      localStorage.setItem('lunartide_data', JSON.stringify({
        state: { auth: { authEnabled: false, username: '', passwordHash: '', isUnlocked: false } },
        version: 0,
      }));
    }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  await page.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-bento');

  // Bento card sizes must differ
  const sizes = await page.evaluate(() => {
    const out = {};
    for (const cls of ['capture', 'recent', 'echo', 'keep', 'week', 'photos']) {
      const el = document.querySelector(`.jp2-bento-${cls}`);
      if (el) {
        const r = el.getBoundingClientRect();
        out[cls] = `${Math.round(r.width)}x${Math.round(r.height)}`;
      }
    }
    return out;
  });
  console.log('[bento sizes]', JSON.stringify(sizes));

  // Quick capture is the only "large" card
  const captureArea = await page.evaluate(() => {
    const r = document.querySelector('.jp2-bento-capture').getBoundingClientRect();
    return r.width * r.height;
  });
  const others = await page.evaluate(() => {
    return ['recent', 'echo', 'keep', 'week', 'photos'].map((c) => {
      const r = document.querySelector(`.jp2-bento-${c}`).getBoundingClientRect();
      return { c, area: r.width * r.height };
    });
  });
  console.log('[capture largest]', others.every((o) => captureArea > o.area) ? 'yes' : 'NO');

  // Split view pane widths + drag
  await page.goto(`${BASE}/journal/fragments`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-split');
  const paneWidths = await page.evaluate(() => ({
    nav: Math.round(document.querySelector('.jp2-nav-pane')?.getBoundingClientRect().width || 0),
    list: Math.round(document.querySelector('.jp2-list-pane')?.getBoundingClientRect().width || 0),
    workspace: Math.round(document.querySelector('.jp2-workspace')?.getBoundingClientRect().width || 0),
    resizers: document.querySelectorAll('.jp2-resizer').length,
  }));
  console.log('[split panes]', JSON.stringify(paneWidths));

  // Drag list resizer +60px
  const resizer = page.locator('.jp2-resizer').nth(1);
  const box = await resizer.boundingBox();
  await page.mouse.move(box.x + 3, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 63, box.y + 200, { steps: 5 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() =>
    Math.round(document.querySelector('.jp2-list-pane').getBoundingClientRect().width));
  console.log('[drag list pane]', paneWidths.list, '->', afterDrag, afterDrag > paneWidths.list ? '(drag works)' : '(DRAG FAILED)');

  // Width persisted
  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('.jp2-split');
  const persisted = await page.evaluate(() =>
    Math.round(document.querySelector('.jp2-list-pane').getBoundingClientRect().width));
  console.log('[width persisted]', persisted === afterDrag ? 'yes' : `NO (${persisted})`);

  // Keyboard resize
  await page.focus('.jp2-resizer >> nth=1');
  await page.keyboard.press('ArrowLeft');
  const afterKey = await page.evaluate(() =>
    Math.round(document.querySelector('.jp2-list-pane').getBoundingClientRect().width));
  console.log('[keyboard resize]', afterKey === persisted - 16 ? 'yes' : `NO (${afterKey} vs ${persisted})`);

  // No nested double scrollbars at page level
  const doubleScroll = await page.evaluate(() => {
    const doc = document.documentElement;
    return { pageScrollable: doc.scrollHeight - doc.clientHeight };
  });
  console.log('[page vertical scroll on split]', doubleScroll.pageScrollable, 'px');

  // Tablet 1000px: nav pane hidden, drawer button present
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  const tablet = await page.evaluate(() => ({
    navPane: Boolean(document.querySelector('.jp2-split > .jp2-nav-pane')),
    navBtn: Boolean(document.querySelector('.jp2-list-nav-btn')),
    listPane: Boolean(document.querySelector('.jp2-list-pane')),
    workspace: Boolean(document.querySelector('.jp2-workspace')),
  }));
  console.log('[tablet 1000px]', JSON.stringify(tablet));

  // Dark mode variables applied
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-bento');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const darkBg = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.jp2-card')).backgroundColor);
  console.log('[dark card bg]', darkBg);

  await browser.close();
};

run().catch((e) => { console.error(e); process.exit(1); });
