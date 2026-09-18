import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const EVIDENCE_DIR = path.resolve('docs/reports/evidence/rune-guest-lounge-phase1.2-final');
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

async function settleGate(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.rlg-panel').evaluate(async (node) => {
    await Promise.all(node.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
  });
}

for (const frame of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1440, height: 900 }]) {
  for (const theme of ['dark', 'light'] as const) {
    test(`${frame.width} ${theme}: six exchanges, adaptive height and inline states`, async ({ page, browserName }) => {
      const failures = await collectRuntimeFailures(page);
      const captured: CapturedGuestRequest[] = [];
      let release: (() => void) | undefined;
      let fail = false;
      await page.route('**/__guest-ai/chat/completions', async route => {
        captured.push(route.request().postDataJSON());
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: fail ? 'data: [DONE]\n\n' : `data: ${JSON.stringify({ choices: [{ delta: { content: '可以，先在這裡坐一會。窗外的月光很安靜，我聽著，你可以慢慢說。' } }] })}\n\ndata: [DONE]\n\n` });
      });
      await page.setViewportSize(frame);
      await seedGuestGate(page);
      await openGate(page);
      await ensureTheme(page, theme);
      await settleGate(page);
      const gateBefore = await page.locator('.rlg-panel').boundingBox();
      await page.getByTestId('guest-lounge-trigger').click();
      const panel = page.getByTestId('guest-lounge-panel');
      await panel.evaluate(async node => { await Promise.all(node.getAnimations().map(a => a.finished)); });
      await mkdir(EVIDENCE_DIR, { recursive: true });
      const snapshot = async (name: string) => page.screenshot({ path: path.join(EVIDENCE_DIR, name) });
      const geometry = async () => {
        const result = await panel.evaluate(node => {
          const box = node.getBoundingClientRect();
          const messages = node.querySelector('.guest-lounge-messages')!;
          const composer = node.querySelector('.guest-lounge-composer');
          const control = composer ?? node.querySelector('.guest-lounge-terminal-footer')!;
          const c = control.getBoundingClientRect();
          const m = messages.getBoundingClientRect();
          return { height: box.height, bottom: box.bottom, controlBottom: c.bottom, controlTop: c.top, messageBottom: m.bottom, scrollHeight: messages.scrollHeight, clientHeight: messages.clientHeight, panelOverflow: node.scrollHeight - node.clientHeight, overflow: document.documentElement.scrollWidth - innerWidth, composerPresent: Boolean(composer) };
        });
        expect(result.overflow).toBeLessThanOrEqual(1);
        expect(result.panelOverflow).toBeLessThanOrEqual(1);
        expect(result.controlBottom).toBeLessThanOrEqual(result.bottom);
        expect(result.bottom).toBeLessThan(frame.height);
        expect(result.messageBottom).toBeLessThanOrEqual(result.controlTop + 1);
        expect(result.height).toBeLessThanOrEqual(frame.width < 760 ? frame.height * .72 + 1 : 721);
        return result;
      };
      const measurements: Record<string, unknown> = {};
      const initial = await geometry();
      measurements.initial = initial;
      expect(initial.height).toBeGreaterThanOrEqual(frame.width < 760 ? frame.height * .54 : 500);
      expect(initial.height).toBeLessThanOrEqual(frame.width < 760 ? frame.height * .62 : 580);
      if (browserName === 'chromium' && frame.width === 1440 && theme === 'dark') await snapshot('A-desktop-empty.png');
      const input = page.getByTestId('guest-lounge-input');
      for (let turn = 1; turn <= 6; turn++) {
        await input.fill(`第 ${turn} 次：我想在門外聊一會，今天有些事情想慢慢說。`);
        await input.press('Enter');
        await expect(page.getByTestId('guest-lounge-replying')).toBeVisible();
        await expect(input).toBeDisabled();
        await expect.poll(() => Boolean(release)).toBe(true);
        await geometry();
        release!(); release = undefined;
        await expect(page.locator('[data-testid="guest-lounge-message"][data-role="rune"]')).toHaveCount(turn);
        const g = await geometry();
        measurements[`turn-${turn}`] = g;
        if ([1, 3, 6].includes(turn)) {
          await test.info().attach(`geometry-${turn}`, { body: JSON.stringify(g), contentType: 'application/json' });
        }
        if (turn === 1) expect(g.height).toBeLessThanOrEqual(initial.height + 100);
      }
      const full = await geometry();
      expect(full.height).toBeGreaterThan(initial.height);
      expect(full.scrollHeight).toBeGreaterThan(full.clientHeight);
      expect(full.composerPresent).toBe(true);
      if (browserName === 'chromium' && theme === 'dark' && frame.width === 1440) await snapshot('B-desktop-long-conversation.png');
      if (browserName === 'chromium' && theme === 'dark' && frame.width === 390) await snapshot('E-390-mobile-conversation.png');
      const list = page.getByTestId('guest-lounge-messages');
      await list.evaluate(node => { node.scrollTop = 0; });
      await expect(page.locator('.guest-lounge-intro')).toBeInViewport();
      await expect(input).toBeInViewport();
      fail = true;
      await input.fill('還在嗎？');
      await input.press('Enter');
      await expect.poll(() => Boolean(release)).toBe(true);
      release!(); release = undefined;
      await expect(page.getByTestId('guest-lounge-unavailable')).toBeVisible();
      await expect(page.getByTestId('guest-lounge-input')).toHaveCount(0);
      await expect(page.getByTestId('guest-lounge-terminal-footer')).toBeVisible();
      const errorGeometry = await geometry();
      measurements.error = errorGeometry;
      expect(errorGeometry.composerPresent).toBe(false);
      expect(errorGeometry.height).toBeLessThan(full.height - 80);
      const returnAction = page.getByRole('button', { name: '← 返回登入' });
      await expect(returnAction).toBeVisible();
      const returnBox = await returnAction.boundingBox();
      expect(returnBox?.height).toBeGreaterThanOrEqual(36);
      expect(returnBox?.height).toBeLessThanOrEqual(40);
      if (browserName === 'chromium' && theme === 'dark' && frame.width === 1440) await snapshot('C-desktop-error.png');
      if (browserName === 'chromium' && theme === 'dark' && frame.width === 390) await snapshot('D-390-mobile-error.png');
      expect(captured).toHaveLength(7);
      for (const request of captured) {
        expect(request.tools).toBeUndefined();
        for (const sentinel of PRIVATE_SENTINELS) expect(JSON.stringify(request)).not.toContain(sentinel);
        expect(JSON.stringify(request)).not.toContain('門還沒有打開');
      }
      expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('第 6 次');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('guest-lounge-trigger')).toBeFocused();
      const after = await page.locator('.rlg-panel').boundingBox();
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after![key] - gateBefore![key]), JSON.stringify({ key, after, gateBefore })).toBeLessThanOrEqual(.5);
      await mkdir(EVIDENCE_DIR, { recursive: true });
      await writeFile(path.join(EVIDENCE_DIR, `${frame.width}-${theme}-${browserName}.json`), JSON.stringify(measurements, null, 2));
      expect(failures.consoleErrors).toEqual([]);
      expect(failures.pageErrors).toEqual([]);
      expect(await failures.unhandled()).toEqual([]);
    });
  }
}

test('short viewport and reduced motion keep composer and keyboard controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedGuestGate(page);
  await openGate(page);
  await page.getByTestId('guest-lounge-trigger').click();
  await expect(page.getByTestId('guest-lounge-input')).toBeInViewport();
  await expect(page.getByTestId('guest-lounge-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.guest-lounge-close')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('guest-lounge-input')).toBeFocused();
  const animation = await page.getByTestId('guest-lounge-panel').evaluate(node => getComputedStyle(node).animationDuration);
  expect(animation).toBe('0.001s');
});
