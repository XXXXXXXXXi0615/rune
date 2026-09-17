import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve('docs/reports/evidence/ai-credential-runtime-closure');
const CREDENTIAL_ID = 'provider:cred-runtime-provider';
const SECRET = 'sk-cred-runtime-secret';
const REPLY_TEXT = '憑證已通過驗證。';

interface CapturedRequest {
  model?: string;
  authorization: boolean;
  carrierHasKey: boolean;
  url: string;
}

function providerRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cred-runtime-provider',
    name: 'Credential Runtime Provider',
    type: 'openai',
    baseUrl: 'https://api.example.test/v1',
    apiKey: '',
    model: 'cred-runtime-model',
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
    (window as Window & { __credRuntimeUnhandled?: string[] }).__credRuntimeUnhandled = [];
    window.addEventListener('unhandledrejection', (event) => {
      (window as Window & { __credRuntimeUnhandled?: string[] }).__credRuntimeUnhandled?.push(String(event.reason));
    });
  });
  return {
    consoleErrors,
    pageErrors,
    unhandled: () => page.evaluate(() => (
      window as Window & { __credRuntimeUnhandled?: string[] }
    ).__credRuntimeUnhandled ?? []),
  };
}

async function seedChat(
  page: Page,
  options: { provider: Record<string, unknown>; memoryCredential?: [string, string] | null },
) {
  await page.addInitScript(({ provider, memoryCredential }) => {
    if (sessionStorage.getItem('__credRuntimeSeeded')) return;
    sessionStorage.setItem('__credRuntimeSeeded', '1');
    const now = 1700000000000;
    if (memoryCredential) {
      (window as Window & { __lunartide_cred_memory?: Map<string, string> }).__lunartide_cred_memory =
        new Map([memoryCredential as [string, string]]);
    }
    localStorage.setItem('lunartide_data', JSON.stringify({ state: {
      auth: { authEnabled: false, username: '', passwordHash: '', isUnlocked: false },
      theme: 'dark', language: 'zh-TW', userName: 'Runtime QA',
      profile: { displayName: 'Runtime QA', status: '', bio: '', avatarInitial: 'R', avatarColor: 'user' },
      partner: { name: 'LUNARIS' },
      conversations: [{ id: 'cred-runtime-chat', title: 'LUNARIS', messages: [], createdAt: now, updatedAt: now }],
      activeConversationId: 'cred-runtime-chat',
      messages: [], chatContacts: [],
      providers: [provider],
      aiRoles: {}, mcpConnections: [],
      aiConfig: { enabled: true, memoryContextEnabled: false, systemPrompt: '' },
      memoryEntries: [], activityLogs: [], subscriptions: [], agentTools: [], aiPrompting: { worldBookEntries: [] },
    }, version: 3 }));
    sessionStorage.setItem('lunartide_auth_unlocked', 'true');
    sessionStorage.setItem('lunartide_session', 'true');
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
  }, {
    provider: options.provider,
    memoryCredential: options.memoryCredential ?? null,
  });
}

async function installProviderRoute(page: Page, captured: CapturedRequest[]) {
  await page.route('**/chat/completions', async (route) => {
    const headers = route.request().headers();
    captured.push({
      url: route.request().url(),
      model: (route.request().postDataJSON() as { model?: string })?.model,
      authorization: Boolean(headers.authorization),
      carrierHasKey: /sk-cred-runtime-secret/.test(JSON.stringify(headers)),
    });
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `data: {"choices":[{"delta":{"content":"${REPLY_TEXT}"}}]}\n\ndata: [DONE]\n\n`,
    });
  });
}

async function waitShellReady(page: Page) {
  // While #pre-splash exists #root carries [inert], which silently blocks input events.
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 20000 });
  const updateCenter = page.locator('.update-center-backdrop');
  if (await updateCenter.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '關閉更新公告' }).click().catch(() => {});
    await expect(updateCenter).not.toBeVisible({ timeout: 8000 }).catch(() => {});
  }
}

async function openChat(page: Page) {
  await page.goto('/chat/cred-runtime-chat');
  await waitShellReady(page);
  await expect(page.locator('.chat-composer-shell')).toBeVisible({ timeout: 15000 });
}

async function sendChat(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: '輸入訊息' });
  await input.fill(text);
  await input.press('Enter');
}

test('stored credential authenticates the outbound chat request', async ({ page, browserName }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await page.setViewportSize({ width: 1280, height: 800 });
  await installProviderRoute(page, captured);
  await seedChat(page, { provider: providerRecord(), memoryCredential: [CREDENTIAL_ID, SECRET] });
  await openChat(page);
  await sendChat(page, 'runtime credential probe');

  await expect(page.locator('.message-row.friend .message-bubble').last()).toContainText(REPLY_TEXT, { timeout: 15000 });
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, `authenticated-credential-reply-${browserName}.png`),
    fullPage: false,
  });

  expect(captured).toHaveLength(1);
  expect(captured[0]?.authorization).toBe(true);
  expect(captured[0]?.carrierHasKey).toBe(true);
  expect(captured[0]?.model).toBe('cred-runtime-model');
  expect(captured[0]?.url).toBe('https://api.example.test/v1/chat/completions');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lunartide_data') ?? '{}').state);
  expect(persisted.providers[0].apiKey).toBe('');
  expect(persisted.providers[0].hasCredential).toBe(true);
  expect(persisted.providers[0].credentialId).toBe(CREDENTIAL_ID);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(SECRET);

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('missing credential shows the credential-required state and sends nothing', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedChat(page, { provider: providerRecord() });
  await openChat(page);
  await sendChat(page, 'no credential probe');

  await expect(page.locator('.toast')).toContainText('請先在設定中設定 API Key', { timeout: 15000 });
  await expect(page.locator('.message-row.friend .message-bubble')).toHaveCount(0);
  expect(captured).toHaveLength(0);

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('keyless provider still sends without an Authorization header', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedChat(page, {
    provider: providerRecord({
      id: 'cred-runtime-ollama',
      name: 'Local Ollama',
      type: 'ollama',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama3',
      credentialId: undefined,
      hasCredential: false,
    }),
  });
  await openChat(page);
  await sendChat(page, 'keyless probe');

  await expect(page.locator('.message-row.friend .message-bubble').last()).toContainText(REPLY_TEXT, { timeout: 15000 });
  expect(captured).toHaveLength(1);
  expect(captured[0]?.authorization).toBe(false);
  expect(captured[0]?.url).toBe('http://127.0.0.1:11434/v1/chat/completions');

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});

test('reload drops the in-memory credential and the chat fails safely', async ({ page }) => {
  const failures = await collectRuntimeFailures(page);
  const captured: CapturedRequest[] = [];
  await installProviderRoute(page, captured);
  await seedChat(page, { provider: providerRecord(), memoryCredential: [CREDENTIAL_ID, SECRET] });
  await openChat(page);
  await page.reload();
  await waitShellReady(page);
  await expect(page.locator('.chat-composer-shell')).toBeVisible({ timeout: 15000 });
  await sendChat(page, 'after reload probe');

  await expect(page.locator('.toast')).toContainText('請先在設定中設定 API Key', { timeout: 15000 });
  expect(captured).toHaveLength(0);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(SECRET);

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
  expect(await failures.unhandled()).toEqual([]);
});
