/**
 * Shared E2E test helpers — unlock auth gate & collect errors.
 *
 * Usage per spec:
 *   import { unlockWithDefaults, collectErrors } from '../helpers/unlock';
 *   const { consoleErrors, pageErrors } = collectErrors(page);
 *   await unlockWithDefaults(page);
 */

import { expect, type Page, type TestInfo } from '@playwright/test';

export interface ProductOverlayDiagnostic {
  currentUrl: string;
  fixtureState: {
    updateSeenVersion: string | null;
    shellReady: string | null;
    globalOverlaysReady: string | null;
  };
  overlays: Array<{ name: 'Boot Splash' | 'Update Center'; visible: boolean; reason: string }>;
  consoleErrors: string[];
  pageErrors: string[];
}

/** 插入 init script，繞過認證網關並建立最小可用的 localStorage state */
export async function unlockWithDefaults(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('lunartide_auth_unlocked', 'true');
    if (!localStorage.getItem('lunartide_data')) {
      localStorage.setItem('lunartide_data', JSON.stringify({
        state: {
          auth: { authEnabled: false },
          memoryEntries: [], activityLogs: [], subscriptions: [], agentTools: [],
          chatContacts: [], providers: [], conversations: [], messages: [],
          activeConversationId: null,
          aiPrompting: { worldBookEntries: [] },
          checkInData: { lastCheckIn: new Date().toISOString().split('T')[0], streak: 1, monthlyDays: [] },
        },
        version: 0,
      }));
    }
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
    // Clear module preferences for a clean test baseline
    localStorage.removeItem('lunartide_module_preferences_v2');
  });
}

/** 不覆蓋已有的 module preferences（用於測試 persist 行為） */
export async function unlockPreservingModules(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('lunartide_auth_unlocked', 'true');
    if (!localStorage.getItem('lunartide_data')) {
      localStorage.setItem('lunartide_data', JSON.stringify({
        state: {
          auth: { authEnabled: false },
          memoryEntries: [], activityLogs: [], subscriptions: [], agentTools: [],
          chatContacts: [], providers: [], conversations: [], messages: [],
          activeConversationId: null,
          aiPrompting: { worldBookEntries: [] },
          checkInData: { lastCheckIn: new Date().toISOString().split('T')[0], streak: 1, monthlyDays: [] },
        },
        version: 0,
      }));
    }
    localStorage.setItem('lunartide_update_seen_version_v1', '2026.06.15');
  });
}

/**
 * Environmental noise from the shared Vite dev server. Two known, non-product
 * families:
 *  - in-flight asset/module aborts during navigation or reload
 *    (`ERR_FAILED` / `ERR_CONNECTION_CLOSED` / `ERR_RESET` / `ERR_REFUSED`), and
 *  - WebKit reporting an aborted lazy module load as
 *    `Importing a module script failed.` (the page has already painted and the
 *    functional assertions pass; only the aborted chunk import rejects).
 *
 * Product errors must never be filtered here.
 */
export function isEnvironmentalNoise(text: string): boolean {
  return /ERR_(FAILED|CONNECTION_CLOSED|RESET|REFUSED)/.test(text)
    || /Importing a module script failed/.test(text);
}

/** 收集 console.error 與 pageerror */
export function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (isEnvironmentalNoise(message.text())) return;
    consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    if (isEnvironmentalNoise(error.message)) return;
    pageErrors.push(error.message);
  });
  return { consoleErrors, pageErrors };
}

/** 驗證無錯誤的最終斷言。
 *  注意：此 helper 在被 test 檔 import 的模組作用域中執行，
 *  Playwright 的 `expect` 全域在此處不一定可用，因此改為直接 throw，
 *  由 test runner 將其標記為失敗。 */
export function expectClean(pageErrors: string[], consoleErrors: string[]) {
  if (pageErrors.length > 0) {
    throw new Error(`pageerror(s) detected:\n${pageErrors.join('\n')}`);
  }
  if (consoleErrors.length > 0) {
    throw new Error(`console.error(s) detected:\n${consoleErrors.join('\n')}`);
  }
}

/** 等待正常開機完成，並以產品提供的按鈕關閉更新公告。 */
export async function prepareInteractiveApp(
  page: Page,
  options: {
    evidenceName?: string;
    testInfo?: TestInfo;
    consoleErrors?: string[];
    pageErrors?: string[];
  } = {},
): Promise<ProductOverlayDiagnostic> {
  const splash = page.locator('#pre-splash');
  const updateBackdrop = page.locator('.update-center-backdrop');
  const splashVisible = await splash.isVisible().catch(() => false);
  const overlays: ProductOverlayDiagnostic['overlays'] = [{
    name: 'Boot Splash',
    visible: splashVisible,
    reason: splashVisible ? 'React 啟動與全域 Overlay 尚未完成交接' : '已完成正常 Boot 流程',
  }];

  if (splashVisible && options.evidenceName) {
    await page.screenshot({ path: `e2e/screenshots/${options.evidenceName}-boot.png`, fullPage: true });
  }
  await expect(splash).toHaveCount(0, { timeout: 15_000 });

  const updateVisible = await updateBackdrop.isVisible().catch(() => false);
  const updateSeenVersion = await page.evaluate(() => localStorage.getItem('lunartide_update_seen_version_v1'));
  overlays.push({
    name: 'Update Center',
    visible: updateVisible,
    reason: updateVisible ? 'fixture 的已讀版本與目前 release 不一致' : '已讀版本與目前 release 一致或公告已關閉',
  });
  if (updateVisible) {
    if (options.evidenceName) {
      await page.screenshot({ path: `e2e/screenshots/${options.evidenceName}-update.png`, fullPage: true });
    }
    await page.getByRole('button', { name: '關閉更新公告' }).click();
    await expect(updateBackdrop).toHaveCount(0);
  }

  const readiness = await page.evaluate(() => ({
    shellReady: document.documentElement.dataset.shellReady ?? null,
    globalOverlaysReady: document.documentElement.dataset.globalOverlaysReady ?? null,
  }));
  const diagnostic: ProductOverlayDiagnostic = {
    currentUrl: page.url(),
    fixtureState: { updateSeenVersion, ...readiness },
    overlays,
    consoleErrors: [...(options.consoleErrors ?? [])],
    pageErrors: [...(options.pageErrors ?? [])],
  };
  if (options.testInfo) {
    await options.testInfo.attach(`${options.evidenceName ?? 'overlay'}-diagnostic`, {
      body: Buffer.from(JSON.stringify(diagnostic, null, 2)),
      contentType: 'application/json',
    });
  }
  return diagnostic;
}
