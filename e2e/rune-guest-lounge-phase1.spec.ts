import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve('docs/reports/evidence/rune-guest-lounge-phase1');
const ACCESS_STRING = 'moon1234';
const ACCESS_HASH = '7a37a86203ff85b19476f7d052349e1d57e50bded313cccdea99b9601e1ace5d';
const UPDATE_SEEN = '2026.06.15';
const PRIVATE_SENTINELS = [
  'PRIVATE_PROFILE_SENTINEL',
  'PRIVATE_MEMORY_SENTINEL',
  'PRIVATE_CHAT_SENTINEL',
  'PRIVATE_SYSTEM_PROMPT_SENTINEL',
];

interface CapturedGuestRequest {
  model?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  tools?: unknown;
}

async function collectRuntimeFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    (window as Window & { __guestUnhandled?: string[] }).__guestUnhandled = [];
    window.addEventListener('unhandledrejection', (event) => {
      (window as Window & { __guestUnhandled?: string[] }).__guestUnhandled?.push(String(event.reason));
    });
  });
  return {
    consoleErrors,
    pageErrors,
    unhandled: () => page.evaluate(() => (
      window as Window & { __guestUnhandled?: string[] }
    ).__guestUnhandled ?? []),
  };
}

async function seedGuestGate(page: Page, withProvider = true) {
  await page.addInitScript(({ accessHash, accessString, seen, withProvider: includeProvider }) => {
    if (sessionStorage.getItem('__runeGuestSeeded')) return;
    sessionStorage.setItem('__runeGuestSeeded', '1');
    sessionStorage.removeItem('lunartide_auth_unlocked');
    sessionStorage.removeItem('lunartide_session');
    const now = Date.now();
    const privateMessage = {
      id: 'private-message',
      sender: 'me',
      time: new Date(now).toISOString(),
      status: 'read',
      type: 'text',
      content: 'PRIVATE_CHAT_SENTINEL',
    };
    const providers = includeProvider ? [{
      id: 'guest-test-provider',
      name: 'Canonical Guest Test Provider',
      type: 'ollama',
      baseUrl: 'http://127.0.0.1:5173/__guest-ai',
      apiKey: '',
      model: 'guest-test-model',
      enabled: true,
      isDefault: true,
      streamingEnabled: true,
      thinkingUiEnabled: false,
      temperature: 0.4,
      maxTokens: 256,
      contextMessageLimit: 12,
      modelsEndpoint: '/models',
      chatEndpoint: '/chat/completions',
      connectionStatus: 'connected',
      createdAt: now,
      updatedAt: now,
    }] : [];

    localStorage.setItem('lunartide_data', JSON.stringify({
      state: {
        auth: {
          authEnabled: true,
          onboardingComplete: true,
          username: 'PRIVATE_PROFILE_SENTINEL',
          passwordHash: accessHash,
          accessString,
          isUnlocked: false,
        },
        providers,
        conversations: [{
          id: 'private-conversation',
          title: 'Private conversation',
          messages: [privateMessage],
          createdAt: now,
          updatedAt: now,
        }],
        activeConversationId: 'private-conversation',
        messages: [privateMessage],
        memoryEntries: [{ id: 'private-memory', content: 'PRIVATE_MEMORY_SENTINEL' }],
        aiConfig: { systemPrompt: 'PRIVATE_SYSTEM_PROMPT_SENTINEL' },
        aiPrompting: {
          systemPrompt: 'PRIVATE_SYSTEM_PROMPT_SENTINEL',
          worldBookEntries: [{ id: 'private-book', title: 'private', content: 'PRIVATE_MEMORY_SENTINEL' }],
        },
        todos: [], activityLogs: [], subscriptions: [], agentTools: [], chatContacts: [],
      },
      version: 3,
    }));
    localStorage.setItem('lunartide_update_seen_version_v1', seen);
  }, { accessHash: ACCESS_HASH, accessString: ACCESS_STRING, seen: UPDATE_SEEN, withProvider });
}

async function openGate(page: Page) {
  await page.goto('/login');
  await expect(page.locator('#pre-splash')).toHaveCount(0);
  await expect(page.getByTestId('rune-login-gate')).toBeVisible();
}

async function ensureTheme(page: Page, theme: 'light' | 'dark') {
  if (await page.locator('html').getAttribute('data-theme') !== theme) {
    await page.getByTestId('rune-login-theme-toggle').click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function installGuestProviderRoute(page: Page, captured: CapturedGuestRequest[]) {
  await page.route('**/__guest-ai/chat/completions', async (route) => {
    captured.push(route.request().postDataJSON() as CapturedGuestRequest);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"choices":[{"delta":{"content":"我在門外。這段話只留在此刻。"}}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
    });
  });
}

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

type Box = { x: number; y: number; width: number; height: number };

/** Sub-pixel browser rounding can differ between renders; the contract is that the box does not move. */
function expectSameBox(actual: Box | null, expected: Box | null) {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  const a = actual as Box;
  const b = expected as Box;
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(0.5);
}

for (const frame of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1440, height: 900 },
]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${frame.width}×${frame.height} ${theme}: trigger and lounge preserve frozen gate geometry`, async ({ page, browserName }) => {
      const failures = await collectRuntimeFailures(page);
      await page.setViewportSize(frame);
      await seedGuestGate(page);
      await openGate(page);
      await ensureTheme(page, theme);

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator('.rlg-panel');
      // Compare settled geometry; WebKit can expose the gate's 320ms entrance transform.
      await card.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      const cta = page.getByTestId('rune-enter');
      const trigger = page.getByTestId('guest-lounge-trigger');
      const [beforeCard, ctaBox, triggerBox] = await Promise.all([
        card.boundingBox(),
        cta.boundingBox(),
        trigger.boundingBox(),
      ]);
      expect(beforeCard).not.toBeNull();
      expect(ctaBox).not.toBeNull();
      expect(triggerBox).not.toBeNull();
      expect(boxesOverlap(ctaBox!, triggerBox!)).toBe(false);
      if (theme === 'dark' && (frame.width === 390 || frame.width === 1440)) {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${frame.width}x${frame.height}-dark-trigger-${browserName}.png`),
          fullPage: true,
        });
      }

      await trigger.click();
      const panel = page.getByTestId('guest-lounge-panel');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('Rune · 待客廳');
      await expect(panel).toContainText('本次對話不會保存。');
      await panel.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      const [afterCard, panelBox] = await Promise.all([card.boundingBox(), panel.boundingBox()]);
      expectSameBox(afterCard, beforeCard);
      expect(panelBox).not.toBeNull();
      expect(panelBox!.x).toBeGreaterThanOrEqual(8);
      expect(panelBox!.y).toBeGreaterThanOrEqual(8);
      expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(frame.width - 8);
      expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(frame.height - 8);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${frame.width}x${frame.height}-${theme}-${browserName}.png`),
        fullPage: true,
      });
      await panel.getByRole('button', { name: '關閉待客廳' }).click();
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(async () => {
        expectSameBox(await card.boundingBox(), beforeCard);
      }).toPass({ timeout: 2000 });
      expect(failures.consoleErrors).toEqual([]);
      expect(failures.pageErrors).toEqual([]);
      expect(await failures.unhandled()).toEqual([]);
    });
  }
}

test('ephemeral transport sends only guest session context and reload clears it', async ({ page, browserName }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedGuestRequest[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await installGuestProviderRoute(page, captured);
  await seedGuestGate(page);
  await openGate(page);

  await page.getByTestId('guest-lounge-trigger').click();
  const input = page.getByTestId('guest-lounge-input');
  await input.fill('你好 Rune');
  await input.press('Shift+Enter');
  await input.type('只是暫坐。');
  await expect(input).toHaveValue('你好 Rune\n只是暫坐。');
  await input.press('Enter');
  await expect(page.getByTestId('guest-lounge-replying')).toBeVisible();
  await expect(page.getByTestId('guest-lounge-message')).toHaveCount(2);
  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="rune"]')).toContainText('只留在此刻');
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, `390x844-ephemeral-reply-${browserName}.png`),
    fullPage: true,
  });

  expect(captured).toHaveLength(1);
  expect(captured[0]?.model).toBe('guest-test-model');
  expect(captured[0]?.tools).toBeUndefined();
  const payload = JSON.stringify(captured[0]);
  expect(payload).toContain('你好 Rune\\n只是暫坐。');
  for (const sentinel of PRIVATE_SENTINELS) expect(payload).not.toContain(sentinel);
  expect(captured[0]?.messages?.map((message) => message.role)).toEqual(['system', 'user']);

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide_data') ?? '{}').state);
  expect(persisted.conversations).toHaveLength(1);
  expect(persisted.messages).toHaveLength(1);
  expect(JSON.stringify(persisted)).not.toContain('你好 Rune');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /guest/i.test(key)))).toEqual([]);
  const usageDbNames = await page.evaluate(async () => {
    if (typeof indexedDB.databases !== 'function') return null;
    return (await indexedDB.databases()).map((database) => database.name);
  });
  if (usageDbNames) expect(usageDbNames).not.toContain('lunartide-provider-usage');

  await page.locator('.guest-lounge-close').click();
  await page.getByTestId('guest-lounge-trigger').click();
  await expect(page.getByTestId('guest-lounge-message')).toHaveCount(2);

  await page.reload();
  await expect(page.locator('#pre-splash')).toHaveCount(0);
  await page.getByTestId('guest-lounge-trigger').click();
  await expect(page.getByTestId('guest-lounge-message')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-messages')).toContainText('本次對話不會保存。');

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
  expect(['chromium', 'webkit']).toContain(browserName);
});

test('successful unlock destroys the guest session without migrating it to Chat', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedGuestRequest[] = [];
  await installGuestProviderRoute(page, captured);
  await seedGuestGate(page);
  await openGate(page);

  await page.getByTestId('guest-lounge-trigger').click();
  await page.getByTestId('guest-lounge-input').fill('TEMPORARY_GUEST_MESSAGE');
  await page.getByTestId('guest-lounge-send').click();
  await expect(page.getByTestId('guest-lounge-message')).toHaveCount(2);
  await page.locator('.guest-lounge-close').click();
  await expect(page.getByTestId('guest-lounge-trigger')).toBeFocused();

  await page.getByTestId('rune-access-input').fill(ACCESS_STRING);
  await page.getByTestId('rune-enter').click();
  await expect(page.getByTestId('app-shell-ready')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('guest-lounge-trigger')).toHaveCount(0);
  const afterUnlock = await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide_data') ?? '{}').state);
  expect(afterUnlock.conversations).toHaveLength(1);
  expect(afterUnlock.messages).toHaveLength(1);
  expect(JSON.stringify(afterUnlock)).not.toContain('TEMPORARY_GUEST_MESSAGE');

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('unconfigured provider stays calm and returns focus to Login Gate', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  await seedGuestGate(page, false);
  await openGate(page);
  await page.getByTestId('guest-lounge-trigger').click();
  await expect(page.getByTestId('guest-lounge-unavailable')).toContainText('Rune 現在暫時不能在門外應答。');
  await expect(page.getByTestId('guest-lounge-input')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-send')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-terminal-footer')).toContainText('此刻無法傳送訊息');
  await page.getByRole('button', { name: '返回登入' }).click();
  await expect(page.getByTestId('guest-lounge-panel')).toHaveCount(0);
  await expect(page.getByTestId('rune-access-input')).toBeFocused();
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('provider failure keeps the ephemeral session and never exposes a raw error', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  await page.route('**/__guest-ai/chat/completions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: [DONE]\n\n' });
  });
  await seedGuestGate(page);
  await openGate(page);
  await page.getByTestId('guest-lounge-trigger').click();
  await page.getByTestId('guest-lounge-input').fill('還在嗎？');
  await page.getByTestId('guest-lounge-send').click();
  await expect(page.getByTestId('guest-lounge-unavailable')).toContainText('Rune 現在暫時不能在門外應答。');
  await expect(page.getByTestId('guest-lounge-panel')).not.toContainText('Guest transport returned no text');
  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="guest"]')).toContainText('還在嗎？');
  await expect(page.getByTestId('guest-lounge-input')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-terminal-footer')).toBeVisible();
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});
