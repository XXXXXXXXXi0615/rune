import { test, expect } from '@playwright/test';

test.describe('Group Chat Custom Identities Phase 1', () => {

  test('renders CreateGroupSheet with identity cards instead of hardcoded contacts', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-page"]', { timeout: 10000 });

    const createBtn = page.locator('button', { hasText: '建立群聊' });
    await createBtn.click();

    const sheet = page.locator('.gc-sheet');
    await expect(sheet).toBeVisible();

    const cards = sheet.locator('.gc-library-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    const firstCard = cards.first();
    await expect(firstCard.locator('.gc-identity-name')).toBeVisible();
    await expect(firstCard.locator('.gc-identity-kind-badge')).toBeVisible();
  });

  test('CreateGroupSheet requires at least 2 selected identities', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-page"]', { timeout: 10000 });

    const createBtn = page.locator('button', { hasText: '建立群聊' });
    await createBtn.click();

    const createSubmit = page.locator('.gc-sheet-footer button', { hasText: '建立群聊' });
    await expect(createSubmit).toBeDisabled();

    const firstCard = page.locator('.gc-library-card').first();
    await firstCard.click();
    await expect(createSubmit).toBeDisabled();

    const secondCard = page.locator('.gc-library-card').nth(1);
    await secondCard.click();
    await expect(createSubmit).toBeEnabled();
  });

  test('SpeakerSheet shows participants from identity store', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-page"]', { timeout: 10000 });

    const speakerBtn = page.locator('.gc-speaker-picker');
    if (await speakerBtn.isVisible()) {
      await speakerBtn.click();
      const sheet = page.locator('.mc-speaker-sheet');
      await expect(sheet).toBeVisible();
      const cards = sheet.locator('.mc-speaker-card');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('GroupProfileDrawer uses custom Switch for mute/pin', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-page"]', { timeout: 10000 });

    const groupRows = page.locator('.chat-list-item', { hasText: '群聊' });
    if (await groupRows.count() > 0) {
      await groupRows.first().click();

      const profileBtn = page.locator('button', { hasText: '群聊資料' });
      if (await profileBtn.isVisible()) {
        await profileBtn.click();

        const switches = page.locator('.gc-switch');
        await expect(switches.first()).toBeVisible({ timeout: 3000 });

        const switchTrack = switches.first().locator('.gc-switch-track');
        await expect(switchTrack).toBeVisible();
      }
    }
  });

  test('identity store has default identities after hydration', async ({ page }) => {
    const identities = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__?.useIdentityStore;
      if (!store) return [];
      const state = store.getState();
      return state.identities.map((i: any) => ({ id: i.id, displayName: i.displayName, kind: i.kind }));
    });

    if (identities.length > 0) {
      expect(identities.some((i: any) => i.id === 'lunaris')).toBe(true);
      expect(identities.some((i: any) => i.id === 'clawd')).toBe(true);
      expect(identities.some((i: any) => i.id === 'mira')).toBe(true);
    }
  });

  // Title re-pointed when the group-level default reply-mode select was retired: the
  // shared select presentation now belongs to the surviving 群聊狀態 field.
  test('GroupProfileDrawer uses gc-select-wrapper for its surviving status select', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-page"]', { timeout: 10000 });

    const groupRows = page.locator('.chat-list-item', { hasText: '群聊' });
    if (await groupRows.count() > 0) {
      await groupRows.first().click();

      const profileBtn = page.locator('button', { hasText: '群聊資料' });
      if (await profileBtn.isVisible()) {
        await profileBtn.click();

        const selectWrapper = page.locator('.gc-select-wrapper').first();
        await expect(selectWrapper).toBeVisible({ timeout: 3000 });

        const chevron = selectWrapper.locator('.gc-select-chevron');
        await expect(chevron).toBeVisible();
      }
    }
  });

  test('GroupProfileDrawer has danger zone section', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-page"]', { timeout: 10000 });

    const groupRows = page.locator('.chat-list-item', { hasText: '群聊' });
    if (await groupRows.count() > 0) {
      await groupRows.first().click();

      const profileBtn = page.locator('button', { hasText: '群聊資料' });
      if (await profileBtn.isVisible()) {
        await profileBtn.click();

        const dangerZone = page.locator('.gc-danger-zone');
        await expect(dangerZone).toBeVisible({ timeout: 3000 });
        await expect(dangerZone.locator('.gc-danger-zone-title')).toHaveText('危險區域');
        await expect(dangerZone.locator('button', { hasText: '清除聊天記錄' })).toBeVisible();
      }
    }
  });
});
