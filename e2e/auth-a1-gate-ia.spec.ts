import { expect, test } from '@playwright/test';

const frames = [
  { width: 1440, height: 900 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
];

for (const frame of frames) {
  for (const theme of ['dark', 'light'] as const) {
    test(`${frame.width}px ${theme}: invitation and Guest Lounge IA`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => {
        localStorage.removeItem('lunartide_data');
        sessionStorage.removeItem('lunartide_session');
        sessionStorage.removeItem('lunartide_auth_unlocked');
      });
      await page.setViewportSize(frame);
      await page.goto('/login');
      await expect(page.locator('#pre-splash')).toHaveCount(0);
      const gate = page.getByTestId('rune-login-gate');
      await expect(gate).toBeVisible();
      if (theme === 'light') await page.getByTestId('rune-login-theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const invitation = page.getByTestId('rune-invitation-input');
      const continueButton = page.getByTestId('rune-continue');
      const loungeButton = page.getByTestId('guest-lounge-trigger');
      await expect(page.getByRole('heading', { name: 'Master.' })).toBeVisible();
      await expect(invitation).toHaveAccessibleName('邀請碼');
      await expect(invitation).toHaveAttribute('aria-describedby', 'rune-gate-feedback');
      await expect(gate).toHaveAttribute('data-invitation-state', 'idle');
      await expect(loungeButton).toHaveText('進入待客廳');
      await expect(gate).not.toContainText(/生成邀請碼|建立密鑰|API Key|Secret Key|Invitation Center|申請存取/);
      const cta = await continueButton.boundingBox();
      const entry = await loungeButton.boundingBox();
      expect(cta && entry).toBeTruthy();
      expect(entry!.y).toBeGreaterThanOrEqual(cta!.y + cta!.height);
      expect(entry!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await invitation.focus();
      await expect(gate).toHaveAttribute('data-invitation-state', 'focused');
      await invitation.fill('wrong');
      await invitation.press('Enter');
      await expect(gate).toHaveAttribute('data-invitation-state', 'invalid');
      await expect(invitation).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toContainText('邀請碼不正確，請重新確認。');
      await expect(invitation).toBeFocused();
      await invitation.fill('LUNARIDE');
      await invitation.press('Enter');
      await expect(gate).toHaveAttribute('data-invitation-state', 'accepted');
      await expect(page.getByTestId('rune-access-string')).toBeVisible();

      await loungeButton.click();
      const panel = page.getByTestId('guest-lounge-panel');
      await expect(panel).toHaveAttribute('data-guest-status', 'unavailable');
      await panel.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
      await expect(panel).toContainText('門還沒有打開。');
      await expect(panel).toContainText('訪客對話目前暫停。');
      await expect(panel).not.toContainText('但你可以先在這裡坐一會。');
      await expect(panel).not.toContainText('此刻無法傳送訊息');
      await expect(page.getByTestId('guest-lounge-input')).toHaveCount(0);
      const close = panel.getByRole('button', { name: '關閉待客廳' });
      const back = panel.getByRole('button', { name: '返回登入' });
      expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const box = await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(frame.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(frame.height);
      await back.focus();
      await back.press('Enter');
      await expect(panel).toHaveCount(0);
      await expect(page.getByTestId('rune-enter')).toBeFocused();
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 430]) {
  test(`${width}px keyboard-height keeps invitation and action visible`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 500 : 560 });
    await page.goto('/login');
    await expect(page.locator('#pre-splash')).toHaveCount(0);
    const input = page.getByTestId('rune-invitation-input');
    await input.focus();
    const button = page.getByTestId('rune-continue');
    const inputBox = await input.boundingBox();
    const buttonBox = await button.boundingBox();
    expect(inputBox!.y).toBeGreaterThanOrEqual(0);
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
}
