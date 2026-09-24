/**
 * Module Preferences Store — 用戶模組顯示偏好
 *
 * 管理用戶在「功能與模塊」設置頁中調整的：
 * - 隱藏的模組 id（核心入口會被自動過濾，無法隱藏）
 * - 自定義排序
 *
 * 持久化到 localStorage，key: lunartide_module_preferences_v2
 *
 * v2 migration: diet/objects/ledger → lifeLedger（idempotent）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppModuleId, AppModulePreferences } from './types';
import { CORE_MODULE_IDS, APP_MODULES } from './appModuleRegistry';

const STORAGE_KEY = 'lunartide_module_preferences_v2';
const CURRENT_VERSION = 3;

/** Legacy module ids consolidated into lifeLedger in Phase 1C */
const LEGACY_LEDGER_IDS: readonly string[] = ['diet', 'objects', 'ledger'];

function migratePreferencesV1toV2(data: AppModulePreferences): AppModulePreferences {
  return {
    hiddenIds: mappedIds(data.hiddenIds),
    visibleOverrides: mappedIds(data.visibleOverrides),
    customOrder: mappedCustomOrder(data.customOrder),
  };
}

function mappedIds(ids: AppModuleId[]): AppModuleId[] {
  const mapped = ids.map((id) => (LEGACY_LEDGER_IDS.includes(id) ? 'lifeLedger' : id));
  const deduped: AppModuleId[] = [];
  for (const id of mapped) {
    if (!deduped.includes(id)) deduped.push(id);
  }
  return deduped;
}

function mappedCustomOrder(order: AppModuleId[]): AppModuleId[] {
  const mapped = order.map((id) => (LEGACY_LEDGER_IDS.includes(id) ? 'lifeLedger' : id));
  const seen = new Set<AppModuleId>();
  return mapped.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

interface ModulePreferencesState extends AppModulePreferences {
  /** 隱藏指定模組（showInMobileMore=true 的模組，核心入口忽略） */
  hideModule: (id: AppModuleId) => void;
  /** 顯示指定模組 */
  showModule: (id: AppModuleId) => void;
  /** 切換顯示狀態（自動區分 showInMobileMore=true→hiddenIds vs false→visibleOverrides） */
  toggleModuleVisibility: (id: AppModuleId) => void;
  /** 設定自定義排序 */
  setCustomOrder: (order: AppModuleId[]) => void;
  /** 上移模組 */
  moveUp: (id: AppModuleId) => void;
  /** 下移模組 */
  moveDown: (id: AppModuleId) => void;
  /** 重置為預設 */
  resetToDefault: () => void;
  /** 判斷模組目前對 More Sheet 是否可見 */
  isVisibleInMore: (id: AppModuleId) => boolean;
  /** 判斷模組目前對 Desktop Sidebar 是否可見 */
  isVisibleInDesktopSidebar: (id: AppModuleId) => boolean;
  isVisibleInRuneUtility: (id: AppModuleId) => boolean;
  toggleSurfaceVisibility: (surface: 'rune' | 'sidebar' | 'more', id: AppModuleId) => void;
}

const DEFAULT_STATE: Pick<ModulePreferencesState, 'hiddenIds' | 'visibleOverrides' | 'customOrder' | 'hiddenRuneUtilityIds' | 'hiddenDesktopSidebarIds' | 'hiddenMobileMoreIds'> = {
  hiddenIds: [],
  visibleOverrides: [],
  customOrder: [],
  hiddenRuneUtilityIds: [],
  hiddenDesktopSidebarIds: [],
  hiddenMobileMoreIds: [],
};

function isCore(id: AppModuleId): boolean {
  return (CORE_MODULE_IDS as readonly string[]).includes(id);
}

/** 檢查模組預設 visibility（任一 context） */
function moduleDefaultsToVisible(id: AppModuleId): boolean {
  const mod = APP_MODULES.find((m) => m.id === id);
  return mod?.showInMobileMore === true || mod?.showInDesktopSidebar === true;
}

/** 檢查模組在 Mobile More 預設可見性 */
function moduleDefaultsToVisibleInMore(id: AppModuleId): boolean {
  const mod = APP_MODULES.find((m) => m.id === id);
  return mod?.showInMobileMore === true;
}

export const useModulePreferencesStore = create<ModulePreferencesState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      hideModule: (id) => {
        if (isCore(id)) return;
        const isDefaultVisible = moduleDefaultsToVisible(id);
        set((state) => {
          if (isDefaultVisible) {
            // showInMobileMore=true → add to hiddenIds
            if (state.hiddenIds.includes(id)) return state;
            return { hiddenIds: [...state.hiddenIds, id] };
          } else {
            // showInMobileMore=false → remove from visibleOverrides
            return { visibleOverrides: state.visibleOverrides.filter((x) => x !== id) };
          }
        });
      },

      showModule: (id) => {
        const isDefaultVisible = moduleDefaultsToVisible(id);
        set((state) => {
          if (isDefaultVisible) {
            return { hiddenIds: state.hiddenIds.filter((x) => x !== id) };
          } else {
            if (state.visibleOverrides.includes(id)) return state;
            return { visibleOverrides: [...state.visibleOverrides, id] };
          }
        });
      },

      toggleModuleVisibility: (id) => {
        if (isCore(id)) return;
        // 若模組在任一 context（More 或 Desktop Sidebar）預設可見，使用 hiddenIds 控制
        if (moduleDefaultsToVisible(id)) {
          const { hiddenIds, showModule: show, hideModule: hide } = get();
          if (hiddenIds.includes(id)) {
            show(id);
          } else {
            hide(id);
          }
        } else {
          // 否則使用 visibleOverrides
          const { visibleOverrides, showModule: show, hideModule: hide } = get();
          if (visibleOverrides.includes(id)) {
            hide(id);
          } else {
            show(id);
          }
        }
      },

      setCustomOrder: (order) => {
        set({ customOrder: order });
      },

      moveUp: (id) => {
        const { customOrder } = get();
        if (customOrder.length === 0) return;
        const idx = customOrder.indexOf(id);
        if (idx <= 0) return;
        const next = [...customOrder];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        set({ customOrder: next });
      },

      moveDown: (id) => {
        const { customOrder } = get();
        if (customOrder.length === 0) return;
        const idx = customOrder.indexOf(id);
        if (idx < 0 || idx >= customOrder.length - 1) return;
        const next = [...customOrder];
        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
        set({ customOrder: next });
      },

      resetToDefault: () => {
        set({ ...DEFAULT_STATE });
      },

      isVisibleInMore: (id) => {
        if (isCore(id)) return true;
        const { hiddenIds, hiddenMobileMoreIds = [], visibleOverrides } = get();
        const mod = APP_MODULES.find((m) => m.id === id);
        // global-status-pill modules never appear in More
        if (mod?.entryMode === 'global-status-pill') return false;
        if (mod?.showInMobileMore) {
          return !hiddenIds.includes(id) && !hiddenMobileMoreIds.includes(id);
        }
        return visibleOverrides.includes(id);
      },

      isVisibleInDesktopSidebar: (id) => {
        if (isCore(id)) return true;
        const { hiddenIds, hiddenDesktopSidebarIds = [], visibleOverrides } = get();
        const mod = APP_MODULES.find((m) => m.id === id);
        if (!mod) return false;
        // primary navigation items are always visible
        if (mod.isPrimaryNavigation) return true;
        if (mod.showInDesktopSidebar) {
          return !hiddenIds.includes(id) && !hiddenDesktopSidebarIds.includes(id);
        }
        return visibleOverrides.includes(id);
      },
      isVisibleInRuneUtility: (id) => isCore(id) || !(get().hiddenRuneUtilityIds || []).includes(id),
      toggleSurfaceVisibility: (surface, id) => {
        if (isCore(id)) return;
        const key = surface === 'rune' ? 'hiddenRuneUtilityIds' : surface === 'sidebar' ? 'hiddenDesktopSidebarIds' : 'hiddenMobileMoreIds';
        set((state) => {
          const current = state[key] || [];
          return { [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: CURRENT_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const state = persistedState as AppModulePreferences;
          return { ...DEFAULT_STATE, ...migratePreferencesV1toV2(state) } as ModulePreferencesState;
        }
        return { ...DEFAULT_STATE, ...(persistedState as ModulePreferencesState) };
      },
      partialize: (state) => ({
        hiddenIds: state.hiddenIds,
        visibleOverrides: state.visibleOverrides,
        customOrder: state.customOrder,
        hiddenRuneUtilityIds: state.hiddenRuneUtilityIds || [],
        hiddenDesktopSidebarIds: state.hiddenDesktopSidebarIds || [],
        hiddenMobileMoreIds: state.hiddenMobileMoreIds || [],
      } as ModulePreferencesState),
    },
  ),
);

/** 取得當前隱藏的模組 id（非 hook 版本，供非組件使用） */
export function getHiddenModuleIds(): AppModuleId[] {
  return useModulePreferencesStore.getState().hiddenIds;
}

/** 取得當前可見性覆寫（非 hook 版本） */
export function getVisibleOverrides(): AppModuleId[] {
  return useModulePreferencesStore.getState().visibleOverrides;
}
