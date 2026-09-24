/**
 * Chat Call Phase 2A.3 — screenshot capture
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function setupAndStartCall(page, viewport, mode, convSuffix) {
  await page.setViewportSize(viewport);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const convId = await page.evaluate((suffix) => {
    let raw = localStorage.getItem('lunartide_data');
    let data = raw ? JSON.parse(raw) : { state: {} };
    data.state = data.state || {};
    data.state.auth = { authEnabled: false, isUnlocked: true, username: 'ss', passwordHash: 'x' };
    data.state.partner = data.state.partner || {};
    data.state.partner.name = 'LUNARIS';
    data.state.partner.displayName = '月潮';
    const conv = {
      id: 'ss-' + suffix + '-' + Date.now(), title: 'SS', kind: 'private', messages: [],
      participants: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    data.state.conversations = [conv];
    data.state.activeConversationId = conv.id;
    localStorage.setItem('lunartide_data', JSON.stringify(data));
    try { sessionStorage.setItem('lunartide_session', 'true'); } catch {}
    return conv.id;
  }, convSuffix);
  await page.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#chat-view', { timeout: 30000 });
  await page.waitForSelector('#pre-splash', { state: 'detached', timeout: 20000 });
  try {
    const bd = page.locator('.update-center-backdrop');
    if (await bd.isVisible({ timeout: 4000 })) {
      await page.locator('button').filter({ hasText: /知道了/ }).first().click();
      await page.waitForSelector('.update-center-backdrop', { state: 'detached', timeout: 8000 });
    }
  } catch {}
  await page.waitForTimeout(300);

  await page.evaluate(({ id, m }) => {
    const s = window.__chatCallStore;
    s.getState().initiateOutgoingCall({ conversationId: id, mode: m });
    s.getState().activateCall();
  }, { id: convId, m: mode });
  await page.waitForSelector('[data-testid="active-call-view"]', { timeout: 10000 });
  await page.waitForTimeout(800);
  return convId;
}

async function main() {
  console.log('Capturing Phase 2A.3 screenshots...\n');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop video call
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setupAndStartCall(page, { width: 1280, height: 800 }, 'video', 'vid');
    await page.screenshot({ path: 'screenshots/chat-video-call-desktop.png' });
    console.log('  ✓ chat-video-call-desktop.png');
    await ctx.close();
  }

  // 2. Mobile video call
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setupAndStartCall(page, { width: 390, height: 844 }, 'video', 'mob');
    await page.screenshot({ path: 'screenshots/chat-video-call-mobile-390.png' });
    console.log('  ✓ chat-video-call-mobile-390.png');
    await ctx.close();
  }

  // 3. Video call settings
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setupAndStartCall(page, { width: 1280, height: 800 }, 'video', 'set');
    await page.locator('[data-testid="call-settings-btn"]').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/chat-video-call-settings.png' });
    console.log('  ✓ chat-video-call-settings.png');
    await ctx.close();
  }

  // 4. End receipt
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setupAndStartCall(page, { width: 1280, height: 800 }, 'video', 'end');
    await page.locator('[data-testid="call-ctrl-end"]').click();
    await page.waitForSelector('[data-testid="call-ended-overlay"]', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'screenshots/chat-call-end-receipt.png' });
    console.log('  ✓ chat-call-end-receipt.png');
    await ctx.close();
  }

  console.log('\nAll Phase 2A.3 screenshots captured!');
  await browser.close();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
