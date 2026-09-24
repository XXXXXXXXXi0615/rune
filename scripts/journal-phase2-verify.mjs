import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4199';
const OUT = 'e2e-screenshots/journal-phase2';
mkdirSync(OUT, { recursive: true });

const errors = { console: [], page: [], rejection: [] };

function wire(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.console.push(msg.text());
  });
  page.on('pageerror', (err) => errors.page.push(String(err)));
  page.on('console', (msg) => {
    if (msg.text().includes('[unhandledrejection]')) errors.rejection.push(msg.text());
  });
}

async function overflow(page, label) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      docOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      bodyOverflow: Math.max(0, document.body.scrollWidth - doc.clientWidth),
    };
  });
  console.log(`[overflow] ${label}: doc=${result.docOverflow}px body=${result.bodyOverflow}px`);
  return result;
}

const seedIdentities = () => {
  const now = Date.now();
  const mk = (id, name, bio) => ({
    id, kind: 'ai', displayName: name, avatarVariants: [], defaultAvatarVariantId: '',
    bio, personaPrompt: '', mentionAliases: [id], allowManualSpeaking: true,
    archived: false, createdAt: now, updatedAt: now,
  });
  localStorage.setItem('lunartide-identities', JSON.stringify({
    state: { identities: [mk('lunaris', 'LUNARIS', '你的潮汐伴侶'), mk('clawd', 'CLAWD', '潮汐守護者')] },
    version: 0,
  }));
};

const seedEntries = () => {
  const dayMs = 86400000;
  const iso = (offset) => new Date(Date.now() - offset).toISOString();
  const mk = (patch, offset = 0) => ({
    id: crypto.randomUUID(),
    kind: 'diary', author: 'user', visibility: 'normal',
    content: '', createdAt: iso(offset), updatedAt: iso(offset),
    tags: [], attachments: [], favorite: false, pinned: false, archived: false,
    aiAccess: 'private', lifecycle: 'active', source: 'manual',
    ...patch,
  });

  const e1 = mk({
    content: '傍晚散步時看到潮水退得很遠，露出一整片濕亮的沙灘。撿了一顆有洞的石頭。',
    tags: ['散步', '海邊'], favorite: true, captureMode: 'fragment', moodId: 'calm',
  }, 3600000);
  const e2 = mk({
    content: '今天實在太累了，會議一個接一個，什麼都不想說。',
    captureMode: 'vent', moodId: 'gloomy',
  }, dayMs);
  const e3 = mk({
    title: '雨夜的想法',
    content: '一直在想搬家的事，想找人聊聊，又不知道從何說起。',
    tags: ['搬家'], captureMode: 'dialogue',
  }, dayMs * 3);
  const e4 = mk({
    kind: 'memory', title: '外婆的桂花糕配方',
    content: '兩杯米粉、半杯糖、一小把乾桂花，蒸二十分鐘。',
    tags: ['家'], aiAccess: 'reference',
  }, dayMs * 12);

  const raw = JSON.parse(localStorage.getItem('lunartide_data') || '{"state":{},"version":0}');
  raw.state.journalWorkspaceEntries = [e1, e2, e3, e4];
  raw.state.journalSchemaVersion = 1;
  localStorage.setItem('lunartide_data', JSON.stringify(raw));
  return { id1: e1.id, id2: e2.id, id3: e3.id, id4: e4.id };
};

const seedEchoThread = (entryId) => {
  const now = new Date().toISOString();
  localStorage.setItem('lunartide-journal-ai-v1', JSON.stringify({
    state: {
      threads: [{
        id: 'thread-demo', journalEntryId: entryId, friendId: 'lunaris', mode: 'listen',
        entryShared: true,
        messages: [
          { id: 'm1', role: 'assistant', content: '聽起來那片退潮後的沙灘讓你安靜了下來。撿到的石頭，就像今天替你留下的一個小小的紀念。', mode: 'listen', createdAt: now, status: 'done' },
        ],
        createdAt: now, updatedAt: now,
      }],
    },
    version: 0,
  }));
};

// tiny red-ish PNG
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'base64',
);

const run = async () => {
  const browser = await chromium.launch();

  const authBypass = () => {
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
    if (!localStorage.getItem('lunartide_data')) {
      localStorage.setItem('lunartide_data', JSON.stringify({
        state: { auth: { authEnabled: false, username: '', passwordHash: '', isUnlocked: false } },
        version: 0,
      }));
    }
  };

  /* ═════ Desktop 1440x900 ═════ */
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktop.route('https://fonts.googleapis.com/*', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await desktop.route('https://fonts.gstatic.com/*', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await desktop.addInitScript(authBypass);
  const page = await desktop.newPage();
  page.setDefaultTimeout(120000);
  wire(page);

  // 8. Empty state (before seeding)
  await page.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-bento', { timeout: 120000 }); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/08-empty-state.png` });

  // Seed identities + entries
  await page.evaluate(seedIdentities);
  const ids = await page.evaluate(seedEntries);
  await page.evaluate(seedEchoThread, ids.id1);

  // Photo via quick capture upload
  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('.jp2-quick-input');
  await page.waitForTimeout(400);
  await page.setInputFiles('.jp2-quick-foot input[type=file]', {
    name: 'tide.png', mimeType: 'image/png', buffer: PNG_BUFFER,
  });
  await page.waitForSelector('.jp2-quick-image img');
  await page.fill('.jp2-quick-input', '沙灘上撿到的石頭，拍了一張。');
  await page.waitForTimeout(900);
  await page.click('.jp2-quick-save');
  await page.waitForTimeout(400);

  // 1. Desktop Bento Overview
  await page.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-bento');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-desktop-bento.png` });
  await overflow(page, 'desktop /journal');

  // 10. Draft save status
  await page.fill('.jp2-quick-input', '這是一段還沒收進手記的快速草稿…');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/10-draft-save-status.png` });
  const statusText = await page.textContent('.jp2-draft-status').catch(() => null);
  console.log('[draft-status]', statusText);
  // route switch + back: draft survives
  await page.goto(`${BASE}/journal/fragments`, { waitUntil: 'commit' });
  await page.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-quick-input');
  await page.waitForTimeout(400);
  const restored = await page.inputValue('.jp2-quick-input');
  console.log('[draft-restored]', restored.includes('快速草稿') ? 'yes' : 'NO');
  await page.evaluate(() => localStorage.removeItem('lunartide-journal-draft-v1'));

  // 2. Desktop split view
  await page.goto(`${BASE}/journal/fragments`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-list-item');
  await page.waitForTimeout(400);
  await page.click('.jp2-list-item');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/02-desktop-split.png` });
  await overflow(page, 'desktop /journal/fragments');

  // 9. Fragment with photo (select the photo entry)
  await page.click(`.jp2-list-item:has-text("沙灘上撿到的石頭")`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/09-photo-fragment.png` });

  // 3. Desktop AI echo open
  await page.click('button:has-text("讓朋友回我")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-desktop-ai-open.png` });
  await overflow(page, 'desktop AI panel open');

  // 7. Dark mode overview
  await page.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await page.waitForSelector('.jp2-bento');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/07-dark-overview.png` });
  await page.close();

  /* ═════ Mobile 390x844 (same context, shares seeded storage) ═════ */
  const mpage = await desktop.newPage();
  mpage.setDefaultTimeout(120000);
  await mpage.setViewportSize({ width: 390, height: 844 });
  wire(mpage);

  // 4. Mobile bento
  await mpage.goto(`${BASE}/journal`, { waitUntil: 'commit' });
  await mpage.waitForSelector('.jp2-bento');
  await mpage.waitForTimeout(600);
  await mpage.screenshot({ path: `${OUT}/04-mobile-bento.png` });
  await overflow(mpage, 'mobile /journal');
  const captureVisible = await mpage.isVisible('.jp2-quick-input');
  console.log('[mobile quick-capture first screen]', captureVisible ? 'visible' : 'NOT VISIBLE');

  // 5. Mobile entry
  await mpage.goto(`${BASE}/journal/fragments`, { waitUntil: 'commit' });
  await mpage.waitForSelector('.jp2-list-item');
  await mpage.waitForTimeout(400);
  await overflow(mpage, 'mobile /journal/fragments');
  const threePane = await mpage.isVisible('.jp2-split');
  console.log('[mobile renders compressed 3-pane]', threePane ? 'YES (bad)' : 'no (good)');
  await mpage.click('.jp2-list-item');
  await mpage.waitForTimeout(500);
  await mpage.screenshot({ path: `${OUT}/05-mobile-entry.png` });
  await overflow(mpage, 'mobile entry');

  // 6. Mobile AI bottom sheet
  await mpage.click('.jp2-entry-bottom-bar button:has-text("讓朋友回我")');
  await mpage.waitForTimeout(500);
  await mpage.screenshot({ path: `${OUT}/06-mobile-ai-sheet.png` });
  await overflow(mpage, 'mobile AI sheet');

  await desktop.close();
  await browser.close();

  console.log('---');
  console.log('console.error count:', errors.console.length);
  errors.console.forEach((e) => console.log('  [console.error]', e.slice(0, 200)));
  console.log('pageerror count:', errors.page.length);
  errors.page.forEach((e) => console.log('  [pageerror]', e.slice(0, 200)));
  console.log('unhandledrejection count:', errors.rejection.length);
};

run().catch((err) => { console.error(err); process.exit(1); });
