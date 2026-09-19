import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

async function open(page: Page, route: string, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await unlockWithDefaults(page);
  await page.goto(route);
  await prepareInteractiveApp(page);
}

test('provider editor is a centered full-screen mobile route surface', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '/settings/advanced/providers');
  await page.getByRole('button', { name: /新增提供者/ }).first().click();
  const dialog = page.getByRole('dialog', { name: '新增提供者' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(388);
  expect(box!.height).toBeGreaterThanOrEqual(840);
  await dialog.getByRole('button', { name: '進階選項' }).click();
  await expect(dialog.getByText('上下文保留訊息數')).toBeVisible();
  await expect(dialog.getByText('思考動畫')).toHaveCount(0);
  await expect(dialog.locator('.pcw-type-grid, .pcw-type-btn')).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Provider' })).toBeVisible();
  await expect(dialog.getByLabel('Model ID')).toBeVisible();
  await expect(page.locator('#app')).toHaveClass(/app--mobile-overlay-open/);
  await dialog.getByRole('button', { name: '關閉' }).click();
  await expect(page.locator('#app')).not.toHaveClass(/app--mobile-overlay-open/);
  expectClean(errors.pageErrors, errors.consoleErrors);
});
