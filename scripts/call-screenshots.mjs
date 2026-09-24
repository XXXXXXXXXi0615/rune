/**
 * Chat Call Phase 2A.1B — screenshot capture
 *
 * Produces 3 acceptance screenshots:
 *  - chat-call-phase2a1-compact-desktop.png        (compact panel, ~600-680px)
 *  - chat-call-phase2a1-text-composer-focused.png   (composer open, text typed, focus ring, send enabled)
 *  - chat-call-phase2a1-mobile-text-composer.png    (mobile 390, composer open)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function setup(page, viewport) {
  await page.setViewportSize(viewport);

  // 1. Seed localStorage
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const convId = await page.evaluate(() => {
    let raw = localStorage.getItem('lunartide_data');
    let data = raw ? JSON.parse(raw) : { state: {} };
    data.state = data.state || {};
    data.state.auth = { authEnabled: false, isUnlocked: true, username: 'ss_user', passwordHash: 'x' };
    data.state.profile = data.state.profile || {};
    data.state.profile.displayName = '测试用户';
    data.state.partner = data.state.partner || {};
    data.state.partner.name = 'LUNARIS';
    data.state.partner.displayName = '月潮';
    const conv = {
      id: 'ss-' + Date.now(),
      title: '测试对话',
      kind: 'private',
      messages: [],
      participants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.state.conversations = [conv];
    data.state.activeConversationId = conv.id;
    localStorage.setItem('lunartide_data', JSON.stringify(data));
    try { sessionStorage.setItem('lunartide_session', 'true'); } catch {}
    return conv.id;
  });

  // 2. Navigate to /chat and wait for boot splash to be fully removed
  await page.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#chat-view', { timeout: 30000 });
  await page.waitForSelector('#pre-splash', { state: 'detached', timeout: 20000 });

  // 3. Dismiss Update Center if visible
  try {
    const backdrop = page.locator('.update-center-backdrop');
    if (await backdrop.isVisible({ timeout: 4000 })) {
      const btn = page.locator('button').filter({ hasText: /知道了/ }).first();
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
        await page.waitForSelector('.update-center-backdrop', { state: 'detached', timeout: 8000 });
      }
    }
  } catch {}
  await page.waitForTimeout(500);

  // 4. Wait for store to be exposed, then drive into an active call
  await page.waitForFunction(() => !!(window).__chatCallStore, { timeout: 10000 });
  await page.evaluate((id) => {
    const cs = (window).__chatCallStore;
    cs.getState().initiateOutgoingCall({ conversationId: id, mode: 'voice' });
    cs.getState().activateCall();
  }, convId);
  await page.waitForSelector('[data-testid="active-call-view"]', { timeout: 10000 });

  // 5. Seed some transcript so the surface doesn't look empty
  await page.evaluate(() => {
    const cs = (window).__chatCallStore;
    cs.getState().appendTranscript({ speaker: 'lunaris', text: '喂，能听清吗？', isStreaming: false });
    cs.getState().appendTranscript({ speaker: 'user', text: '挺清楚的。', isStreaming: false });
    cs.getState().appendTranscript({ speaker: 'lunaris', text: '那就好。', isStreaming: false });
  });
  await page.waitForTimeout(800);

  return convId;
}

async function captureCompactDesktop(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await setup(page, viewport);
    await page.screenshot({ path: 'screenshots/chat-call-phase2a1-compact-desktop.png' });
    console.log('  ✓ chat-call-phase2a1-compact-desktop.png');
  } finally {
    await ctx.close();
  }
}

async function captureTextComposerFocused(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await setup(page, viewport);

    // Open text composer via real click
    await page.locator('[data-testid="call-ctrl-text"]').click();
    await page.waitForSelector('[data-testid="call-text-composer"]', { timeout: 5000 });

    // Type text to show focus state and enabled send button
    const ta = page.locator('[data-testid="call-text-composer"] textarea');
    await ta.fill('今晚慢慢聊');
    await page.waitForTimeout(400);

    await page.screenshot({ path: 'screenshots/chat-call-phase2a1-text-composer-focused.png' });
    console.log('  ✓ chat-call-phase2a1-text-composer-focused.png');
  } finally {
    await ctx.close();
  }
}

async function captureMobileTextComposer(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await setup(page, viewport);

    // Open text composer
    await page.locator('[data-testid="call-ctrl-text"]').click();
    await page.waitForSelector('[data-testid="call-text-composer"]', { timeout: 5000 });

    // Type some text
    const ta = page.locator('[data-testid="call-text-composer"] textarea');
    await ta.fill('在吗');
    await page.waitForTimeout(400);

    await page.screenshot({ path: 'screenshots/chat-call-phase2a1-mobile-text-composer.png' });
    console.log('  ✓ chat-call-phase2a1-mobile-text-composer.png');
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log('Capturing Phase 2A.1B screenshots...\n');

  const browser = await chromium.launch({ headless: true });

  try {
    await captureCompactDesktop(browser, { width: 1280, height: 800 });
    await captureTextComposerFocused(browser, { width: 1280, height: 800 });
    await captureMobileTextComposer(browser, { width: 390, height: 844 });
    console.log('\nAll Phase 2A.1B screenshots captured!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
