/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { getSettingsParentRoute, rememberSettingsReturnRoute } from './SettingsNavigation';
import { contrastRatio } from './SettingsAppearancePanels';

describe('settings navigation', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns root settings to the remembered safe route', () => {
    rememberSettingsReturnRoute('/calendar');
    expect(getSettingsParentRoute('/settings')).toBe('/calendar');
  });

  it('falls back to app home without history state', () => {
    expect(getSettingsParentRoute('/settings')).toBe('/');
  });

  it('returns deep links to their parent settings route', () => {
    expect(getSettingsParentRoute('/settings/appearance/colors')).toBe('/settings/appearance');
    expect(getSettingsParentRoute('/settings/companion/appearance')).toBe('/settings/companion');
    expect(getSettingsParentRoute('/settings/companion')).toBe('/settings');
    expect(getSettingsParentRoute('/settings/desktop-pet')).toBe('/settings');
  });

  it('never stores a settings route as the return destination', () => {
    rememberSettingsReturnRoute('/journal');
    rememberSettingsReturnRoute('/settings/companion');
    expect(getSettingsParentRoute('/settings')).toBe('/journal');
  });
});

describe('accent contrast guard', () => {
  it('accepts readable text and rejects low contrast text', () => {
    expect(contrastRatio('#2c2825', '#faf9f5')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#f6f5f1', '#faf9f5')).toBeLessThan(4.5);
  });
});
