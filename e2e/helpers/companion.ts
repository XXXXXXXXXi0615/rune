import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Companion interaction helpers (Companion-C1).
 *
 * Since C1 the Companion DOM box is no longer a full hit target: only the
 * painted character region (`[data-testid="companion-hit"]`) owns pointer
 * input, and the transparent remainder of the box is click-through for the page
 * behind it. Tests that grab or click the Companion must therefore aim at the
 * hit region instead of the box centre.
 */

export const COMPANION_HOST = '[data-testid="companion-pet-host"]';
export const COMPANION_PET = '.companion-pet';
export const COMPANION_HIT = '[data-testid="companion-hit"]';

/** Centre of the region that owns pointer input (the painted character). */
export async function companionHitPoint(page: Page): Promise<{ x: number; y: number }> {
  const hit = page.locator(COMPANION_HIT);
  await expect(hit).toBeAttached();
  const box = (await hit.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Click the Companion on its visible character. */
export async function clickCompanion(page: Page): Promise<void> {
  const point = await companionHitPoint(page);
  await page.mouse.click(point.x, point.y);
}

/**
 * Drag the Companion from its visible character. Uses raw mouse events so the
 * >4px drag threshold, the long-press cancel and the window-level pointer
 * pipeline are exercised exactly as a real pointer would.
 */
export async function dragCompanion(page: Page, dx: number, dy: number, options: { end?: 'up' | 'cancel'; settle?: number } = {}): Promise<void> {
  const start = await companionHitPoint(page);
  const finish = { x: start.x + dx, y: start.y + dy };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(page.locator(COMPANION_PET)).toHaveClass(/is-dragging/);
  await page.mouse.move(finish.x, finish.y, { steps: 6 });
  if (options.end === 'cancel') {
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 0, clientX: x, clientY: y,
    })), finish);
    await page.mouse.up();
  } else {
    await page.mouse.up();
  }
  await expect(page.locator(COMPANION_PET)).not.toHaveClass(/is-dragging/);
  await page.waitForTimeout(options.settle ?? 120);
}

/** Rect of the Companion DOM box (not the hit region). */
export async function companionBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return (await page.locator(COMPANION_PET).boundingBox())!;
}

/**
 * Pointer sequence over the Companion **box** rather than the painted region.
 * Only meaningful for a locked Companion, which exposes no hit region at all:
 * the pointer must reach the page behind it and move nothing.
 */
export async function pressCompanionBox(page: Page, dx: number, dy: number): Promise<void> {
  const box = await companionBox(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(320);
}

export async function companionPersistedPosition(page: Page, routeKey = '/'): Promise<{ x: number; y: number } | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem('lunartide-companion-pet-v1');
    return raw ? JSON.parse(raw)?.state?.preferences?.routePresentation?.[key] ?? null : null;
  }, routeKey);
}

/** Instrument `localStorage.setItem` and return a reader for the write log. */
export async function trackCompanionWrites(page: Page): Promise<() => Promise<Array<{ path: string; position: { x: number; y: number } | null }>>> {
  await page.addInitScript(() => {
    const probe = window as Window & { __companionC1Writes?: Array<{ path: string; position: { x: number; y: number } | null }> };
    probe.__companionC1Writes = [];
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'lunartide-companion-pet-v1') {
        let position: { x: number; y: number } | null = null;
        try {
          const routePresentation = JSON.parse(value)?.state?.preferences?.routePresentation ?? {};
          const routeKey = window.location.pathname.replace(/\/+$/, '') || '/';
          position = routePresentation[routeKey] ?? null;
        } catch { /* unparsable payload records as null */ }
        probe.__companionC1Writes?.push({ path: window.location.pathname, position });
      }
      return native.call(this, key, value);
    };
  });
  return () => page.evaluate(() => (window as Window & { __companionC1Writes?: Array<{ path: string; position: { x: number; y: number } | null }> }).__companionC1Writes ?? []);
}

export type { Locator };
