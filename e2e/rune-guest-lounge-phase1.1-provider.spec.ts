import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve('docs/reports/evidence/rune-guest-lounge-phase1.1');
const ACCESS_STRING = 'moon1234';
const ACCESS_HASH = '7a37a86203ff85b19476f7d052349e1d57e50bded313cccdea99b9601e1ace5d';
const UPDATE_SEEN = '2026.06.15';
const GUEST_KEY = 'sk-guest-availability-probe';
const CREDENTIAL_ID = 'provider:guest-avail-provider';
const PRIVATE_SENTINELS = [
  'PRIVATE_PROFILE_SENTINEL',
  'PRIVATE_MEMORY_SENTINEL',
  'PRIVATE_CHAT_SENTINEL',
  'PRIVATE_SYSTEM_PROMPT_SENTINEL',
];

interface CapturedRequest {
  model?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  tools?: unknown;
  authorization: boolean;
  carrierHasKey: boolean;
}

function providerRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest-avail-provider',
    name: 'Guest Availability Provider',
    type: 'openai',
    baseUrl: 'https://api.example.test/v1',
    apiKey: '',
    model: 'guest-availability-model',
    enabled: true,
    isDefault: true,
    streamingEnabled: true,
    thinkingUiEnabled: false,
    temperature: 0.4,
    maxTokens: 256,
    contextMessageLimit: 12,
    modelsEndpoint: '',
    chatEndpoint: '',
    connectionStatus: 'connected',
    credentialId: CREDENTIAL_ID,
    hasCredential: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

async function collectRuntimeFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    (window as Window & { __guestAvailUnhandled?: string[] }).__guestAvailUnhandled = [];
    window.addEventListener('unhandledrejection', (event) => {
      (window as Window & { __guestAvailUnhandled?: string[] }).__guestAvailUnhandled?.push(String(event.reason));
    });
  });
  return {
    consoleErrors,
    pageErrors,
    unhandled: () => page.evaluate(() => (
      window as Window & { __guestAvailUnhandled?: string[] }
    ).__guestAvailUnhandled ?? []),
  };
}

async function seedGate(
  page: Page,
  options: { providers: unknown[]; memoryCredential?: [string, string] | null },
) {
  await page.addInitScript(({ accessHash, accessString, seen, providers, memoryCredential }) => {
    if (sessionStorage.getItem('__guestAvailSeeded')) return;
    sessionStorage.setItem('__guestAvailSeeded', '1');
    sessionStorage.removeItem('lunartide_auth_unlocked');
    sessionStorage.removeItem('lunartide_session');
    if (memoryCredential) {
      (window as Window & { __lunartide_cred_memory?: Map<string, string> }).__lunartide_cred_memory =
        new Map([memoryCredential]);
    }
    const now = 1700000000000;
    const privateMessage = {
      id: 'private-message', sender: 'me', time: new Date(now).toISOString(),
      status: 'read', type: 'text', content: 'PRIVATE_CHAT_SENTINEL',
    };
    localStorage.setItem('lunartide_data', JSON.stringify({
      state: {
        auth: { authEnabled: true, onboardingComplete: true, username: 'PRIVATE_PROFILE_SENTINEL', passwordHash: accessHash, accessString, isUnlocked: false },
        providers,
        conversations: [{ id: 'private-conversation', title: 'Private conversation', messages: [privateMessage], createdAt: now, updatedAt: now }],
        activeConversationId: 'private-conversation',
        messages: [privateMessage],
        memoryEntries: [{ id: 'private-memory', content: 'PRIVATE_MEMORY_SENTINEL' }],
        aiConfig: { systemPrompt: 'PRIVATE_SYSTEM_PROMPT_SENTINEL' },
        aiPrompting: { systemPrompt: 'PRIVATE_SYSTEM_PROMPT_SENTINEL', worldBookEntries: [{ id: 'private-book', title: 'private', content: 'PRIVATE_MEMORY_SENTINEL' }] },
        todos: [], activityLogs: [], subscriptions: [], agentTools: [], chatContacts: [],
      },
      version: 3,
    }));
    localStorage.setItem('lunartide_update_seen_version_v1', seen);
  }, {
    accessHash: ACCESS_HASH,
    accessString: ACCESS_STRING,
    seen: UPDATE_SEEN,
    providers: options.providers,
    memoryCredential: options.memoryCredential ?? null,
  });
}

async function openGate(page: Page) {
  await page.goto('/login');
  await expect(page.locator('#pre-splash')).toHaveCount(0);
  await expect(page.getByTestId('rune-login-gate')).toBeVisible();
}

async function installProviderRoute(page: Page, captured: CapturedRequest[]) {
  await page.route('**/v1/chat/completions', async (route) => {
    const headers = route.request().headers();
    const payload = route.request().postDataJSON() as {
      model?: string;
      messages?: Array<{ role?: string; content?: unknown }>;
      tools?: unknown;
    };
    captured.push({
      model: payload?.model,
      messages: payload?.messages,
      tools: payload?.tools,
      authorization: Boolean(headers.authorization),
      carrierHasKey: /sk-guest-availability-probe/.test(JSON.stringify(headers)),
    });
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"我在門外，聽得見。"}}]}\n\ndata: [DONE]\n\n',
    });
  });
}

async function openLounge(page: Page) {
  await page.getByTestId('guest-lounge-trigger').click();
  await page.getByTestId('guest-lounge-panel').waitFor();
}

test('credential-store provider answers the guest through the canonical resolver', async ({ page, browserName }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await installProviderRoute(page, captured);
  await seedGate(page, { providers: [providerRecord()], memoryCredential: [CREDENTIAL_ID, GUEST_KEY] });
  await openGate(page);
  await openLounge(page);

  const input = page.getByTestId('guest-lounge-input');
  await expect(input).toBeEnabled();
  await expect(page.getByTestId('guest-lounge-unavailable')).toHaveCount(0);
  await input.fill('你好 Rune');
  await page.getByTestId('guest-lounge-send').click();

  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="rune"]')).toContainText('我在門外，聽得見');
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, `390x844-credential-reply-${browserName}.png`),
    fullPage: true,
  });

  expect(captured).toHaveLength(1);
  expect(captured[0]?.authorization).toBe(true);
  expect(captured[0]?.carrierHasKey).toBe(true);
  expect(captured[0]?.model).toBe('guest-availability-model');
  expect(captured[0]?.tools).toBeUndefined();
  expect(captured[0]?.messages?.map((message) => message.role)).toEqual(['system', 'user']);

  const payload = JSON.stringify(captured[0]);
  for (const sentinel of PRIVATE_SENTINELS) expect(payload).not.toContain(sentinel);

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide_data') ?? '{}').state);
  expect(persisted.conversations).toHaveLength(1);
  expect(persisted.messages).toHaveLength(1);
  expect(JSON.stringify(persisted)).not.toContain('你好 Rune');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /guest/i.test(key)))).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(GUEST_KEY);

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('no provider keeps the calm fallback and sends nothing', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedGate(page, { providers: [] });
  await openGate(page);
  await openLounge(page);

  await expect(page.getByTestId('guest-lounge-unavailable')).toContainText('Rune 現在暫時不能在門外應答。');
  await expect(page.getByTestId('guest-lounge-input')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-send')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-terminal-footer')).toBeVisible();
  expect(captured).toHaveLength(0);
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('disabled provider keeps the calm fallback and sends nothing', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedGate(page, { providers: [providerRecord({ enabled: false })], memoryCredential: [CREDENTIAL_ID, GUEST_KEY] });
  await openGate(page);
  await openLounge(page);

  await expect(page.getByTestId('guest-lounge-unavailable')).toContainText('Rune 現在暫時不能在門外應答。');
  await expect(page.getByTestId('guest-lounge-input')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-terminal-footer')).toBeVisible();
  expect(captured).toHaveLength(0);
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('missing credential fails safely without pretending success', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedGate(page, { providers: [providerRecord()] });
  await openGate(page);
  await openLounge(page);

  const input = page.getByTestId('guest-lounge-input');
  await expect(input).toBeEnabled();
  await input.fill('還在嗎？');
  await page.getByTestId('guest-lounge-send').click();

  await expect(page.getByTestId('guest-lounge-unavailable')).toContainText('Rune 現在暫時不能在門外應答。');
  await expect(page.getByTestId('guest-lounge-panel')).not.toContainText('請先在設定中設定 API Key');
  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="guest"]')).toContainText('還在嗎？');
  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="rune"]')).toHaveCount(0);
  await expect(input).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-terminal-footer')).toBeVisible();
  expect(captured).toHaveLength(0);
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('in-memory credential does not survive reload and the guest stays calm', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedGate(page, { providers: [providerRecord()], memoryCredential: [CREDENTIAL_ID, GUEST_KEY] });
  await openGate(page);
  await openLounge(page);
  await page.getByTestId('guest-lounge-input').fill('reload boundary');
  await page.getByTestId('guest-lounge-send').click();
  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="rune"]')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#pre-splash')).toHaveCount(0);
  await openLounge(page);
  await expect(page.getByTestId('guest-lounge-message')).toHaveCount(0);
  await expect(page.getByTestId('guest-lounge-messages')).toContainText('本次對話不會保存。');
  await expect(page.getByTestId('guest-lounge-input')).toBeEnabled();
  await page.getByTestId('guest-lounge-input').fill('after reload');
  await page.getByTestId('guest-lounge-send').click();
  await expect(page.getByTestId('guest-lounge-unavailable')).toContainText('Rune 現在暫時不能在門外應答。');
  expect(captured).toHaveLength(1);

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('unlock destroys the guest session and never migrates it', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedGate(page, { providers: [providerRecord()], memoryCredential: [CREDENTIAL_ID, GUEST_KEY] });
  await openGate(page);
  await openLounge(page);
  await page.getByTestId('guest-lounge-input').fill('TEMPORARY_GUEST_AVAIL_MESSAGE');
  await page.getByTestId('guest-lounge-send').click();
  await expect(page.locator('[data-testid="guest-lounge-message"][data-role="rune"]')).toHaveCount(1);
  await page.locator('.guest-lounge-close').click();

  await page.getByTestId('rune-access-input').fill(ACCESS_STRING);
  await page.getByTestId('rune-enter').click();
  await expect(page.getByTestId('app-shell-ready')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('guest-lounge-trigger')).toHaveCount(0);

  const afterUnlock = await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide_data') ?? '{}').state);
  expect(afterUnlock.conversations).toHaveLength(1);
  expect(afterUnlock.messages).toHaveLength(1);
  expect(JSON.stringify(afterUnlock)).not.toContain('TEMPORARY_GUEST_AVAIL_MESSAGE');

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});
