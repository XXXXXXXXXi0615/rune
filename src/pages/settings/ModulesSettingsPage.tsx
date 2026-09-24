/**
 * ModulesSettingsPage — 設定 → 功能與模塊
 *
 * 從 App Module Registry 讀取所有可管理的模組，
 * 讓用戶控制哪些模組顯示在 Mobile More / Desktop Sidebar，
 * 並可調整排列順序。
 *
 * 核心入口（首頁、聊天、設定）不可完全隱藏。
 *
 * 此組件作為 SettingsPage 的 detail panel 渲染，
 * header 由 SettingsPage 的 SettingsPageHeader 統一提供。
 */

import { useMemo } from 'react';
import {
  APP_MODULE_GROUPS,
  getModuleSettingsList,
} from '@/features/navigation/appModuleRegistry';
import { useModulePreferencesStore } from '@/features/navigation/modulePreferences';
import { useToastStore } from '@/store/useToastStore';
import type { AppModuleDefinition, ModuleIconName } from '@/features/navigation/types';
import '@/styles/settings-modules.css';

/* ── 圖示（與 DockMoreSheet 共用樣式，這裡獨立渲染以避免循環依賴） ── */
function ModuleIcon({ name }: { name: ModuleIconName }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'journal':
      return (<svg {...common}><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /><path d="M8 7h8M8 11h6" /></svg>);
    case 'objects':
      return (<svg {...common}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>);
    case 'clawd':
      return (<svg {...common}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
    case 'ledger':
      return (<svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><circle cx="7" cy="12.5" r="1.2" fill="currentColor" stroke="none" /><line x1="11" y1="12.5" x2="18" y2="12.5" /></svg>);
    case 'storage':
      return (<svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>);
    case 'stash':
      return (<svg {...common}><rect x="4" y="6" width="14" height="12" rx="2" /><path d="M7 3h13v12M8 10h6M8 14h4" /><path d="m17.5 3 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" /></svg>);
    case 'works':
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
    case 'inspiration':
      return (<svg {...common}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /></svg>);
    case 'profile':
      return (<svg {...common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
    case 'settings':
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>);
    case 'about':
      return (<svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>);
    default:
      return (<svg {...common}><circle cx="12" cy="12" r="9" /></svg>);
  }
}

/* ── 單一模組列 ── */
function ModuleRow({ mod }: { mod: AppModuleDefinition }) {
  useModulePreferencesStore((s) => s.hiddenRuneUtilityIds);
  useModulePreferencesStore((s) => s.hiddenDesktopSidebarIds);
  useModulePreferencesStore((s) => s.hiddenMobileMoreIds);
  useModulePreferencesStore((s) => s.hiddenIds);
  useModulePreferencesStore((s) => s.visibleOverrides);
  const isVisibleInMore = useModulePreferencesStore((s) => s.isVisibleInMore);
  const isVisibleInDesktopSidebar = useModulePreferencesStore((s) => s.isVisibleInDesktopSidebar);
  const isVisibleInRuneUtility = useModulePreferencesStore((s) => s.isVisibleInRuneUtility);
  const toggleSurfaceVisibility = useModulePreferencesStore((s) => s.toggleSurfaceVisibility);

  const canToggle = !mod.isCore && mod.entryMode !== 'global-status-pill';
  const switches = [
    ['rune', 'Rune Utility', isVisibleInRuneUtility(mod.id)],
    ['sidebar', 'Sidebar', isVisibleInDesktopSidebar(mod.id)],
    ['more', 'Mobile More', isVisibleInMore(mod.id)],
  ] as const;

  return (
    <div
      className="modules-row"
      data-module-id={mod.id}
      data-hidden={!switches.some(([, , visible]) => visible) || undefined}
      data-core={mod.isCore || undefined}
      data-pill={mod.entryMode === 'global-status-pill' || undefined}
    >
      <span className="modules-row-icon"><ModuleIcon name={mod.icon} /></span>
      <div className="modules-row-copy">
        <span className="modules-row-label">
          {mod.label}
          {mod.secondaryLabel && (
            <span className="modules-row-secondary">{mod.secondaryLabel}</span>
          )}
          {mod.isCore && <span className="modules-row-badge">核心</span>}
          {mod.entryMode === 'global-status-pill' && <span className="modules-row-badge modules-row-badge--pill">頁面頂部</span>}
        </span>
        <span className="modules-row-desc">{mod.description}</span>
      </div>
      <div className="modules-row-surfaces" aria-label={`${mod.label} 顯示位置`}>
        {switches.map(([surface, label, visible]) => <label key={surface} className="modules-surface-control">
          <span>{label}</span>
          <button type="button" className={`modules-row-toggle${visible ? ' is-on' : ' is-off'}`} onClick={() => toggleSurfaceVisibility(surface, mod.id)} role="switch" aria-checked={visible} aria-label={`${mod.label}：${label}`} disabled={!canToggle}>
            <span className="modules-row-toggle-knob" />
          </button>
        </label>)}
      </div>
    </div>
  );
}

export function ModulesSettingsPage() {
  const resetToDefault = useModulePreferencesStore((s) => s.resetToDefault);
  const showToast = useToastStore((s) => s.showToast);

  const modules = useMemo(() => getModuleSettingsList(), []);

  const grouped = useMemo(() => {
    const buckets = new Map<string, AppModuleDefinition[]>();
    for (const mod of modules) {
      const list = buckets.get(mod.group) ?? [];
      list.push(mod);
      buckets.set(mod.group, list);
    }
    return APP_MODULE_GROUPS
      .filter((g) => buckets.has(g.id))
      .map((g) => ({ group: g, items: buckets.get(g.id)! }));
  }, [modules]);

  const handleReset = () => {
    resetToDefault();
    showToast('已恢復預設排列');
  };

  return (
    <section className="settings-modules-view" data-testid="settings-modules-view">
      <div className="settings-modules-intro">
        <p>管理 App 在 Rune Utility、Sidebar 與 Mobile More 的顯示位置。這裡只管理入口，不取代各 App。</p>
        <p className="settings-modules-intro-note">核心入口無法隱藏；資料與功能仍由各 App 的 canonical owner 管理。</p>
      </div>

      {grouped.map(({ group, items }) => (
        <section key={group.id} className="settings-modules-group" data-testid={`modules-group-${group.id}`}>
          <header className="settings-modules-group-header">
            <span>{group.label}</span>
            <small>{items.length} 個模組</small>
          </header>
          <div className="settings-modules-group-list">
            {items.map((mod) => (
              <ModuleRow
                key={mod.id}
                mod={mod}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="settings-modules-actions">
        <button
          type="button"
          className="settings-modules-reset-btn"
          onClick={handleReset}
        >
          恢復預設排列
        </button>
      </div>
    </section>
  );
}
