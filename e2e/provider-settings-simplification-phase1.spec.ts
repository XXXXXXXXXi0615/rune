import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean } from './helpers/unlock';

const reportDir = 'docs/reports/provider-settings-dynamic-closure';

function provider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'provider-existing', name: 'Existing Provider', type: 'openai',
    baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'persisted-model-id',
    enabled: true, isDefault: true, streamingEnabled: true, thinkingUiEnabled: true,
    temperature: 0.7, maxTokens: 4096, contextMessageLimit: 20,
    modelsEndpoint: '', chatEndpoint: '', connectionStatus: 'untested',
    createdAt: 1, updatedAt: 1, ...overrides,
  };
}

async function seed(page: Page, providers: unknown[] = []) {
  await page.addInitScript((seedProviders) => {
    sessionStorage.setItem('lunartide_auth_unlocked', 'true');
    sessionStorage.setItem('lunartide_session', 'true');
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
    if (!localStorage.getItem('lunartide_data')) {
      localStorage.setItem('lunartide_data', JSON.stringify({
        state: {
          auth: { authEnabled: false }, profile: { displayName: 'Hibiki' },
          partner: { name: '智能體', avatarInitial: '智' }, conversations: [], activeConversationId: '',
          providers: seedProviders, aiRoles: {}, chatContacts: [], aiConfig: { enabled: false },
          memoryEntries: [], activityLogs: [], subscriptions: [], agentTools: [],
        }, version: 1,
      }));
    }
  }, providers);
}

async function openNew(page: Page) {
  await page.goto('/settings/advanced/providers');
  await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: '新增提供者' }).click();
  const dialog = page.getByRole('dialog', { name: '新增提供者' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectProvider(dialog: ReturnType<Page['getByRole']>, providerId: string) {
  await dialog.getByRole('combobox', { name: 'Provider' }).click();
  await dialog.locator(`.pcw-provider-option[data-provider-id="${providerId}"]`).click();
}

test.describe('Provider Settings Dynamic Model Closure', () => {
  test('A-C scopes dynamic discovery by Provider and always permits manual Model ID', async ({ page }) => {
    const errors = collectErrors(page);
    await page.route('https://api.openai.com/v1/models', (route) => route.fulfill({
      json: { data: [{ id: 'openai-runtime-alpha' }, { id: 'openai-runtime-beta' }] },
    }));
    await page.route('https://generativelanguage.googleapis.com/v1beta/models', (route) => route.fulfill({
      json: { models: [{ name: 'models/gemini-runtime-gamma', displayName: 'Gemini Runtime Gamma' }] },
    }));
    await page.route('https://api.deepseek.com/v1/models', (route) => route.fulfill({
      json: { data: [{ id: 'deepseek-runtime-delta' }] },
    }));
    await seed(page);
    const dialog = await openNew(page);

    await expect(dialog.locator('.pcw-type-grid, .pcw-type-btn')).toHaveCount(0);
    await expect(dialog.getByText('選擇提供者')).toHaveCount(0);
    await dialog.getByLabel('API Key').fill('runtime-key');
    await expect(dialog.locator('datalist option[value="openai-runtime-alpha"]')).toHaveCount(1);
    await dialog.getByLabel('Model ID').fill('manual-openai-future-id');
    await expect(dialog.getByLabel('Model ID')).toHaveValue('manual-openai-future-id');
    await expect(dialog.getByLabel('Model ID').locator('xpath=../..')).toHaveAttribute('data-source-id', 'openai:manual-openai-future-id');

    await selectProvider(dialog, 'gemini');
    await expect(dialog.locator('.pcw-header__title')).toHaveText('Gemini');
    await expect(dialog.locator('datalist option[value="openai-runtime-alpha"]')).toHaveCount(0);
    await dialog.getByLabel('API Key').fill('gemini-runtime-key');
    await expect(dialog.locator('datalist option[value="gemini-runtime-gamma"]')).toHaveCount(1);
    await expect(dialog.locator('datalist option[value="openai-runtime-alpha"]')).toHaveCount(0);

    await selectProvider(dialog, 'deepseek');
    await dialog.getByLabel('API Key').fill('deepseek-runtime-key');
    await expect(dialog.locator('datalist option[value="deepseek-runtime-delta"]')).toHaveCount(1);
    await dialog.getByLabel('Model ID').fill('deepseek-manual-next');
    await expect(dialog.getByLabel('Model ID').locator('xpath=../..')).toHaveAttribute('data-source-id', 'deepseek:deepseek-manual-next');
    expectClean(errors.pageErrors, errors.consoleErrors);
  });

  test('D-F saves arbitrary OpenRouter IDs and restores unknown persisted IDs', async ({ page }) => {
    await seed(page, [provider({
      type: 'groq', model: 'unknown-persisted-model', baseUrl: 'https://api.groq.com/openai/v1',
    })]);
    await page.goto('/settings/advanced/providers');
    await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 20_000 });
    await page.getByRole('button', { name: '管理' }).click();
    let dialog = page.getByRole('dialog', { name: '設定 Groq' });
    await expect(dialog.getByLabel('Model ID')).toHaveValue('unknown-persisted-model');
    await expect(dialog.getByLabel('Model ID').locator('xpath=../..')).toHaveAttribute('data-source-id', 'groq:unknown-persisted-model');
    await expect(dialog.getByText('目前設定 · 未出現在最近取得的模型列表')).toBeVisible();

    await selectProvider(dialog, 'openrouter');
    dialog = page.getByRole('dialog', { name: '設定 OpenRouter' });
    await dialog.getByLabel('Model ID').fill('vendor/future-model-2027');
    await dialog.getByRole('button', { name: '儲存變更' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
      const persisted = JSON.parse(localStorage.getItem('lunartide_data') || '{}');
      const saved = persisted.state?.providers?.find((entry: { id?: string }) => entry.id === 'provider-existing');
      return saved ? `${saved.type}:${saved.model}` : '';
    })).toBe('openrouter:vendor/future-model-2027');
    await page.reload();
    await expect(page.locator('#pre-splash')).toHaveCount(0, { timeout: 20_000 });
    await page.getByRole('button', { name: '管理' }).click();
    dialog = page.getByRole('dialog', { name: '設定 OpenRouter' });
    await expect(dialog.getByLabel('Model ID')).toHaveValue('vendor/future-model-2027');
    await expect(dialog.getByLabel('Model ID').locator('xpath=../..')).toHaveAttribute('data-source-id', 'openrouter:vendor/future-model-2027');
  });

  test('G dynamic discovery failure leaves manual Model ID usable', async ({ page }) => {
    await page.route('https://api.openai.com/v1/models', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
    await seed(page);
    const dialog = await openNew(page);
    await dialog.getByLabel('API Key').fill('failing-runtime-key');
    await expect(dialog.getByText('無法取得模型，可直接輸入 Model ID。')).toBeVisible();
    await dialog.getByLabel('Model ID').fill('manual-during-outage');
    await expect(dialog.getByLabel('Model ID')).toHaveValue('manual-during-outage');
    await expect(dialog.getByRole('button', { name: '重新取得 OpenAI 模型' })).toBeVisible();
  });

  test('H Custom preserves manual model and endpoint without a second schema', async ({ page }) => {
    await seed(page);
    const dialog = await openNew(page);
    await selectProvider(dialog, 'custom');
    await expect(dialog.locator('.pcw-header__title')).toHaveText('自訂');
    await dialog.getByLabel('Model ID').fill('private/manual-model');
    await dialog.getByLabel('Endpoint').fill('https://private.example/v1');
    await expect(dialog.getByLabel('Model ID').locator('xpath=../..')).toHaveAttribute('data-source-id', 'custom:private/manual-model');
    await dialog.getByRole('button', { name: '進階選項' }).click();
    await expect(dialog.getByText('由上方 Endpoint 設定')).toBeVisible();
    await expect(dialog.getByLabel('Base URL')).toHaveCount(0);
  });

  test('I-K compact responsive flow has no fixed catalog, grid, overflow, or footer obstruction', async ({ page, browserName }) => {
    await seed(page);
    for (const width of [360, 390, 430, 1440]) {
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: width < 1000 ? 844 : 900 });
        const dialog = await openNew(page);
        await page.evaluate((nextTheme) => document.documentElement.setAttribute('data-theme', nextTheme), theme);
        await expect(dialog.locator('.pcw-type-grid, .pcw-type-btn, .pcw-model-source-menu')).toHaveCount(0);
        await expect(dialog.getByText(/GPT-4o|Gemini 2\.0|Claude 3\.5|DeepSeek V3/)).toHaveCount(0);
        const providerInput = dialog.getByRole('combobox', { name: 'Provider' });
        await providerInput.click();
        await expect(dialog.locator('.pcw-provider-menu')).toBeVisible();
        await expect(dialog.locator('.pcw-provider-option')).toHaveCount(12);
        await expect(dialog.getByRole('button', { name: '重新取得 OpenAI 模型' })).toBeVisible();
        await expect(dialog.getByRole('button', { name: '進階選項' })).toHaveAttribute('aria-expanded', 'false');
        const geometry = await dialog.evaluate((node) => {
          const shell = node as HTMLElement;
          const footer = shell.querySelector<HTMLElement>('.pcw-footer')!;
          const body = shell.querySelector<HTMLElement>('.pcw-body')!;
          const modelInput = shell.querySelector<HTMLInputElement>('.pcw-model-id-row input')!;
          const menu = shell.querySelector<HTMLElement>('.pcw-provider-menu')!;
          return {
            overflow: shell.scrollWidth - shell.clientWidth,
            bodyOverflow: body.scrollWidth - body.clientWidth,
            offenders: Array.from(body.querySelectorAll<HTMLElement>('*')).map((element) => ({
              className: element.className,
              right: Math.round(element.getBoundingClientRect().right),
            })).filter((entry) => entry.right > Math.round(body.getBoundingClientRect().right) + 1),
            modelRight: modelInput.getBoundingClientRect().right,
            menuRight: menu.getBoundingClientRect().right,
            footerBottom: footer.getBoundingClientRect().bottom,
          };
        });
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.bodyOverflow, JSON.stringify(geometry.offenders)).toBeLessThanOrEqual(1);
        expect(geometry.modelRight).toBeLessThanOrEqual(width + 1);
        expect(geometry.menuRight).toBeLessThanOrEqual(width + 1);
        expect(geometry.footerBottom).toBeLessThanOrEqual((width < 1000 ? 844 : 900) + 1);
        if (browserName === 'chromium') {
          await page.screenshot({ path: `${reportDir}/${width}-${theme}.png`, fullPage: true });
        }
        await providerInput.press('Escape');
        await dialog.getByRole('button', { name: '關閉' }).click();
      }
    }
  });
});
