import { describe, expect, it } from 'vitest';
import { getDesktopSecondaryModules, getMobileMoreModules, getModuleById, getRuneUtilityModules } from './appModuleRegistry';

describe('Navigation registry closure', () => {
  it('keeps legacy Item Archive routable but out of consolidated navigation surfaces', () => {
    const desktop = getDesktopSecondaryModules([], ['objects']);
    const mobile = getMobileMoreModules();
    expect(desktop.some(module => module.id === 'objects')).toBe(false);
    expect(desktop.some(module => module.id === 'focus')).toBe(false);
    expect(mobile.some(module => module.id === 'focus')).toBe(false);
    expect(mobile.some(module => module.id === 'objects')).toBe(false);
    expect(getModuleById('objects')).toMatchObject({ route: '/objects', showInMobileMore: true, showInDesktopSidebar: false });
  });

  it('derives the direct Rune launcher from the canonical registry', () => {
    const modules = getRuneUtilityModules(['lifeLedger']);
    expect(modules.some((module) => module.id === 'chat')).toBe(true);
    expect(modules.some((module) => module.id === 'calendar')).toBe(true);
    expect(modules.some((module) => module.id === 'settings')).toBe(true);
    expect(getModuleById('diet' as never)).toBeUndefined();
    expect(modules.some((module) => module.id === 'about')).toBe(false);
  });

  it('registers MoonLex once for desktop, Mobile More and module preferences', () => {
    const moonlex = getModuleById('moonlex');
    expect(moonlex).toMatchObject({
      label: 'Lexicon',
      secondaryLabel: 'MoonLex',
      route: '/moonlex',
      icon: 'moonlex',
      showInMobileMore: true,
      showInDesktopSidebar: true,
      showInModuleSettings: true,
    });
    expect(getDesktopSecondaryModules().filter((module) => module.id === 'moonlex')).toHaveLength(1);
    expect(getMobileMoreModules().filter((module) => module.id === 'moonlex')).toHaveLength(1);
  });
});
