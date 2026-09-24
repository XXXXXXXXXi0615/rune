import { describe, expect, it } from 'vitest';
import {
  APP_MODULES,
  getHomeLauncherModules,
  getModuleById,
} from './appModuleRegistry';
import type { AppModuleId, AppModulePreferences } from './types';

const LEGACY_DIET = 'diet' as AppModuleId;
const RETAINED_LEGACY_IDS: AppModuleId[] = ['objects'];

describe('Phase 1C — lifeLedger launcher consolidation', () => {
  it('registers lifeLedger with showInLauncher=true and route /life-ledger', () => {
    const mod = getModuleById('lifeLedger');
    expect(mod).toBeDefined();
    expect(mod).toMatchObject({
      id: 'lifeLedger',
      route: '/life-ledger',
      showInLauncher: true,
      group: 'life',
      enabled: true,
      showInMobileMore: true,
      showInModuleSettings: true,
    });
  });

  it('removes Diet, keeps objects routable and retires the Tide Ledger module', () => {
    expect(getModuleById(LEGACY_DIET)).toBeUndefined();
    for (const id of RETAINED_LEGACY_IDS) {
      const mod = getModuleById(id);
      expect(mod).toBeDefined();
      expect(mod!.showInLauncher, `${id} showInLauncher`).toBe(false);
      expect(mod!.enabled, `${id} enabled`).toBe(true);
    }
    // Phase D: the Tide Ledger product is retired — the module has no registry entry
    // (the AppModuleId union member survives only for legacy preference remapping).
    expect(getModuleById('ledger')).toBeUndefined();
  });

  it('home launcher includes exactly one lifeLedger and excludes legacy 3', () => {
    const launcher = getHomeLauncherModules();
    const ids = launcher.map((m) => m.id);
    expect(ids).toContain('lifeLedger');
    expect(ids).not.toContain('chat');
    expect(ids).not.toContain(LEGACY_DIET);
    for (const id of RETAINED_LEGACY_IDS) {
      expect(ids).not.toContain(id);
    }
  });

  it('keeps Chat in the Dock while removing its duplicate Home launcher tile', () => {
    expect(getModuleById('chat')).toMatchObject({
      route: '/chat',
      showInLauncher: false,
      showInDock: true,
    });
  });

  it('no duplicate module definitions exist', () => {
    const ids = APP_MODULES.map((m) => m.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it('lifeLedger has no duplicate in APP_MODULES', () => {
    const matches = APP_MODULES.filter((m) => m.id === 'lifeLedger');
    expect(matches).toHaveLength(1);
  });
});

describe('Phase 1C — module preference migration v1→v2', () => {
  function migrate(data: AppModulePreferences): AppModulePreferences {
    const LEGACY = [LEGACY_DIET, 'objects', 'ledger'] as AppModuleId[];
    const remap = (ids: AppModuleId[]) => {
      const mapped = ids.map((id) => (LEGACY.includes(id) ? ('lifeLedger' as AppModuleId) : id));
      const deduped: AppModuleId[] = [];
      for (const id of mapped) {
        if (!deduped.includes(id)) deduped.push(id);
      }
      return deduped;
    };
    const remapOrder = (order: AppModuleId[]) => {
      const mapped = order.map((id) => (LEGACY.includes(id) ? ('lifeLedger' as AppModuleId) : id));
      const seen = new Set<AppModuleId>();
      return mapped.filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    };
    return {
      hiddenIds: remap(data.hiddenIds),
      visibleOverrides: remap(data.visibleOverrides),
      customOrder: remapOrder(data.customOrder),
    };
  }

  it('migrates diet→lifeLedger in hiddenIds', () => {
    const result = migrate({ hiddenIds: [LEGACY_DIET], visibleOverrides: [], customOrder: [] });
    expect(result.hiddenIds).toEqual(['lifeLedger']);
  });

  it('migrates objects→lifeLedger in visibleOverrides', () => {
    const result = migrate({ hiddenIds: [], visibleOverrides: ['objects'], customOrder: [] });
    expect(result.visibleOverrides).toEqual(['lifeLedger']);
  });

  it('migrates ledger→lifeLedger in customOrder', () => {
    const result = migrate({ hiddenIds: [], visibleOverrides: [], customOrder: ['ledger'] });
    expect(result.customOrder).toEqual(['lifeLedger']);
  });

  it('deduplicates when all three legacy ids are present', () => {
    const result = migrate({
      hiddenIds: [LEGACY_DIET, 'objects', 'ledger'],
      visibleOverrides: [],
      customOrder: [LEGACY_DIET, 'objects', 'ledger'],
    });
    expect(result.hiddenIds).toEqual(['lifeLedger']);
    expect(result.customOrder).toEqual(['lifeLedger']);
  });

  it('preserves non-legacy ids unchanged', () => {
    const result = migrate({
      hiddenIds: [LEGACY_DIET, 'works'],
      visibleOverrides: ['objects'],
      customOrder: ['ledger', 'works', LEGACY_DIET],
    });
    expect(result.hiddenIds).toEqual(['lifeLedger', 'works']);
    expect(result.visibleOverrides).toEqual(['lifeLedger']);
    expect(result.customOrder).toEqual(['lifeLedger', 'works']);
  });

  it('is idempotent — running twice produces same result', () => {
    const input: AppModulePreferences = {
      hiddenIds: [LEGACY_DIET, 'objects'],
      visibleOverrides: ['ledger'],
      customOrder: [LEGACY_DIET, 'objects', 'ledger'],
    };
    const once = migrate(input);
    const twice = migrate(once);
    expect(twice).toEqual(once);
  });
});
