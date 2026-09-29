import { expect, test, type Page } from '@playwright/test';

function seed(page: Page) {
  return page.addInitScript(() => {
    if (sessionStorage.getItem('chat-local-seeded')) return;
    const now = Date.now();
    localStorage.setItem('lunartide_data', JSON.stringify({ state: {
      auth: { authEnabled: false, username: '', passwordHash: '', isUnlocked: false }, theme: 'light', language: 'zh-TW', userName: '測試',
      profile: { displayName: '測試', status: '', bio: '', avatarInitial: '測', avatarColor: 'user' },
      partner: { name: 'LUNARIS' }, conversations: [{ id: 'local-chat', title: 'LUNARIS', messages: [], createdAt: now, updatedAt: now }],
      activeConversationId: 'local-chat', messages: [], chatContacts: [], providers: [], aiRoles: {}, mcpConnections: [],
      aiConfig: { enabled: false, mode: 'proxy', provider: 'openai', model: '', apiKey: '', baseUrl: '', proxyUrl: '', temperature: .7, maxTokens: 2048, topP: 1, reasoningEffort: 'medium', reasoningSummary: 'off', systemPrompt: '', memoryContextEnabled: false, devMockEnabled: false },
      aiConnection: { enabled: false, provider: 'openai', compatibilityMode: 'openai-compatible', baseUrl: '', apiKey: '', model: '', availableModels: [], status: 'not_configured', streamingEnabled: true, thinkingUiEnabled: false, temperature: .7, contextMessageLimit: 20, modelsEndpoint: '', chatEndpoint: '' },
      memoryEntries: [], activityLogs: [], subscriptions: [], agentTools: [], aiPrompting: { worldBookEntries: [] },
    }, version: 0 }));
    sessionStorage.setItem('lunartide_auth_unlocked', 'true');
    sessionStorage.setItem('lunartide_session', 'true');
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
    sessionStorage.setItem('chat-local-seeded', 'true');
  });
}

async function open(page: Page) {
  await seed(page);
  await page.goto('/chat/local-chat');
  // While #pre-splash exists #root carries [inert], which silently blocks input events.
  await page.waitForSelector('#pre-splash', { state: 'detached', timeout: 20000 });
  await expect(page.locator('.chat-composer-shell')).toBeVisible();
  const conversation = page.getByRole('button', { name: /私聊 LUNARIS/ }).first();
  if (await conversation.isVisible().catch(() => false)) await conversation.click();
}

test('local text sending, trailing action, keyboard and IME work without a provider', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await open(page);
  const input = page.getByRole('textbox', { name: '輸入訊息' });
  await expect(page.getByTestId('composer-utility-trigger')).toBeVisible();
  await expect(page.getByTestId('composer-send')).toBeDisabled();
  await input.fill('本機保存測試');
  await expect(page.getByTestId('composer-send')).toBeEnabled();
  await input.fill('');
  await expect(page.getByTestId('composer-send')).toBeDisabled();
  await input.fill('第一行');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('第一行\n');
  await input.fill('組字不送出');
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(page.locator('.message-bubble', { hasText: '組字不送出' })).toHaveCount(0);
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect(page.locator('.message-bubble', { hasText: '組字不送出' })).toBeVisible();
  await expect(page.getByText('訊息已保存；連接模型後可要求 智能體 回覆。')).toBeVisible();
  await expect(page.locator('.message-row.assistant .message-bubble')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lunartide_data')?.includes('組字不送出'))).toBe(true);
  await page.reload();
  await expect(page.locator('.message-bubble', { hasText: '組字不送出' })).toBeVisible();
  expect(errors).toEqual([]);
});
