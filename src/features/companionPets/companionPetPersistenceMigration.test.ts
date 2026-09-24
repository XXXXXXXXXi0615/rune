import { describe, expect, it } from 'vitest';
import {
  COMPANION_DEFAULT_POSITIONS,
  migrateCompanionPetPersisted,
  type CompanionPetPersistedV5,
} from '@/store/useCompanionPetStore';

const v5Fixture = (): CompanionPetPersistedV5 => ({
  preferences: {
    version: 5,
    selectedPetPackId: 'clawd',
    selectedVisualByPack: { clawd: 'clawd-sleeping', logos: 'logos-idle' },
    enabled: true,
    manuallyHidden: false,
    expressionMode: 'manual',
    manualExpression: 'idle',
    bubbleEnabled: true,
    pinned: true,
    scale: 1.25,
    position: {
      desktop: { x: 0.42, y: 0.61 },
      tablet: { x: 0.5, y: 0.5 },
      mobile: { x: 0.18, y: 0.27 },
    },
    presentationMode: { desktop: 'free', tablet: 'free', mobile: 'free' },
    miniOffset: { desktop: 0, tablet: 0, mobile: 0 },
    placement: { desktop: { mode: 'free' }, tablet: { mode: 'free' }, mobile: { mode: 'free' } },
  },
});

describe('companion persistence: v5 → v6 migration', () => {
  it('A. preserves visual, scale and breakpoint positions; initialises routePresentation', () => {
    const result = migrateCompanionPetPersisted(v5Fixture(), 5);
    expect(result.preferences.version).toBe(6);
    expect(result.preferences.selectedPetPackId).toBe('clawd');
    expect(result.preferences.selectedVisualByPack.clawd).toBe('clawd-sleeping');
    expect(result.preferences.scale).toBe(1.25);
    expect(result.preferences.pinned).toBe(true);
    expect(result.preferences.position.desktop).toEqual({ x: 0.42, y: 0.61 });
    expect(result.preferences.position.mobile).toEqual({ x: 0.18, y: 0.27 });
    expect(result.preferences.routePresentation).toEqual({});
  });

  it('B. survives partial legacy payloads without throwing', () => {
    for (const payload of [undefined, null, {}, { preferences: null }, { preferences: {} }, { preferences: { version: 5, scale: 0.9 } }]) {
      const result = migrateCompanionPetPersisted(payload, 5);
      expect(result.preferences.version).toBe(6);
      expect(result.preferences.routePresentation).toEqual({});
      expect(result.preferences.position.desktop).toEqual(COMPANION_DEFAULT_POSITIONS.desktop);
    }
    const partial = migrateCompanionPetPersisted({ preferences: { version: 5, scale: 0.9 } }, 5);
    expect(partial.preferences.scale).toBe(0.9);
  });

  it('C. leaves an already-v6 payload unchanged (no destructive transformation)', () => {
    const v6 = {
      preferences: {
        ...v5Fixture().preferences!,
        version: 6,
        routePresentation: { '/chat': { x: 0.3, y: 0.4, scale: 1.1, hidden: false } },
      },
    };
    const result = migrateCompanionPetPersisted(v6, 6);
    expect(result.preferences).toEqual(v6.preferences);
    expect(result.preferences.routePresentation['/chat']).toEqual({ x: 0.3, y: 0.4, scale: 1.1, hidden: false });
    expect(result.preferences.scale).toBe(1.25);
  });

  it('D. is idempotent: migrating the migrated result is a no-op', () => {
    const once = migrateCompanionPetPersisted(v5Fixture(), 5);
    const twice = migrateCompanionPetPersisted(once, 6);
    expect(twice).toEqual(once);
    const thrice = migrateCompanionPetPersisted(twice, 6);
    expect(thrice).toEqual(once);
  });

  it('E. keeps the manual-only persistence contract (preferences only, no runtime fields)', () => {
    const result = migrateCompanionPetPersisted(v5Fixture(), 5);
    expect(Object.keys(result)).toEqual(['preferences']);
    expect(Object.keys(result.preferences)).not.toContain('transientHidden');
    expect(Object.keys(result.preferences)).not.toContain('suppressionReasons');
    expect(result.preferences.expressionMode).toBe('manual');
  });
});
