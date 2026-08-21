/**
 * App Module Registry — 二級功能與 Overflow Module Registry
 *
 * 管理 Mobile More Sheet、Settings「功能與模塊」、DesktopSidebar 等
 * 非主要 Dock Tab（home/chat/music/calendar）的功能入口。
 *
 * 主導航（Home/Chat/Music/Calendar）同樣由本 Registry 派生；Dock 只補上
 * synthetic More action，不維護第二份 route 清單。
 *
 * DockMoreSheet、Settings「功能與模塊」、DesktopSidebar 均從此 Registry 讀取，
 * 不維護獨立的入口陣列。
 */

import type {
  AppModuleDefinition,
  AppModuleGroupMeta,
  AppModuleId,
} from './types';

/* ══════════════════════════════════════
   分組定義
   ══════════════════════════════════════ */

export const APP_MODULE_GROUPS: AppModuleGroupMeta[] = [
  { id: 'life',          label: '生活',         order: 10 },
  { id: 'tools',         label: '工具與管理',   order: 20 },
  { id: 'entertainment', label: '娛樂',         order: 30 },
  { id: 'creation',      label: '創作',         order: 40 },
  { id: 'account',       label: '賬號與系統',   order: 50 },
];

/* ══════════════════════════════════════
   模組清單
   ══════════════════════════════════════ */

export const APP_MODULES: readonly AppModuleDefinition[] = [
  /* ── 主要導航（桌機側邊欄單列） ── */
  {
    id: 'home',
    label: '首頁',
    description: '返回主儀表板',
    icon: 'home',
    route: '/',
    group: 'life',
    order: 0,
    enabled: true,
    showInMobileMore: false,
    showInDesktopSidebar: true,
    showInModuleSettings: false,
    isCore: true,
    isPrimaryNavigation: true,
    desktopGroup: 'primary',
    desktopOrder: 10,
    activePrefixes: ['/'],
  },
  {
    id: 'chat',
    label: '聊天',
    description: 'AI 對話與夥伴互動',
    icon: 'chat',
    route: '/chat',
    group: 'life',
    order: 1,
    enabled: true,
    showInMobileMore: false,
    showInDesktopSidebar: true,
    showInModuleSettings: false,
    isCore: true,
    isPrimaryNavigation: true,
    desktopGroup: 'primary',
    desktopOrder: 20,
    activePrefixes: ['/chat'],
  },
  {
    id: 'music',
    label: '音樂',
    description: '播放清單與音訊管理',
    icon: 'music',
    route: '/music',
    group: 'entertainment',
    order: 2,
    enabled: true,
    showInMobileMore: false,
    showInDesktopSidebar: true,
    showInModuleSettings: false,
    isCore: true,
    isPrimaryNavigation: true,
    desktopGroup: 'primary',
    desktopOrder: 40,
    activePrefixes: ['/music'],
  },
  {
    id: 'moonread',
    label: '共讀',
    secondaryLabel: 'MoonRead',
    description: '與 LUNARIS 一起慢慢讀一本書',
    icon: 'moonread',
    route: '/moonread',
    group: 'entertainment',
    order: 5,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    isPrimaryNavigation: true,
    desktopGroup: 'primary',
    desktopOrder: 50,
    activePrefixes: ['/moonread'],
  },
  {
    id: 'calendar',
    label: '日曆',
    description: '行事曆、待辦與計時管理',
    icon: 'calendar',
    route: '/calendar',
    group: 'life',
    order: 3,
    enabled: true,
    showInMobileMore: false,
    showInDesktopSidebar: true,
    showInModuleSettings: false,
    isCore: true,
    isPrimaryNavigation: true,
    desktopGroup: 'primary',
    desktopOrder: 60,
    activePrefixes: ['/calendar'],
  },

  /* ── 生活 ── */
  {
    id: 'quests',
    label: 'TIDEQUEST',
    description: '任務、待辦與日程管理',
    icon: 'quest',
    route: '/quests',
    group: 'life',
    order: 5,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 5,
    activePrefixes: ['/quests', '/todo', '/todos'],
  },
  {
    id: 'diet',
    label: '飲食',
    description: '餐次、營養與熱量追蹤',
    icon: 'diet',
    route: '/diet',
    group: 'life',
    order: 20,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 10,
    activePrefixes: ['/diet'],
  },
  {
    id: 'objects',
    label: '物品檔案',
    secondaryLabel: 'Object Archive',
    description: '收藏物品的記憶與故事',
    icon: 'objects',
    route: '/objects',
    group: 'life',
    order: 30,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: false,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 20,
    activePrefixes: ['/objects'],
  },
  {
    id: 'moonlex',
    label: '單詞本',
    secondaryLabel: 'MoonLex · 月潮詞冊',
    description: '收藏語彙並用互動牌組練習',
    icon: 'moonlex',
    route: '/moonlex',
    group: 'life',
    order: 40,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 25,
    activePrefixes: ['/moonlex'],
  },
  /* ── 工具與管理 ── */
  {
    id: 'ledger',
    label: '潮汐賬本',
    secondaryLabel: 'Tide Ledger',
    description: '訂閱、支出與週期性帳目',
    icon: 'ledger',
    route: '/ledger',
    group: 'tools',
    order: 10,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 30,
    activePrefixes: ['/ledger', '/subscriptions'],
  },
  {
    id: 'storage',
    label: '儲存空間管理',
    description: '查看並清理可重建的暫存資料',
    icon: 'storage',
    route: '/settings/data/storage',
    group: 'tools',
    order: 20,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 50,
    activePrefixes: ['/settings/data/storage'],
  },

  /* ── 娛樂 ── */

  /* ── 創作 ── */
  {
    id: 'works',
    label: '作品庫',
    description: '彙整個人創作與筆記',
    icon: 'works',
    route: '/works',
    group: 'creation',
    order: 10,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 60,
    activePrefixes: ['/works'],
  },
  {
    id: 'inspiration',
    label: '靈感庫',
    description: '收集靈感、顏文字與範本',
    icon: 'inspiration',
    route: '/inspiration',
    group: 'creation',
    order: 20,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: false,
    desktopGroup: 'secondary',
    desktopOrder: 70,
    activePrefixes: ['/inspiration'],
  },
  {
    id: 'focus',
    label: '月潮航程',
    secondaryLabel: 'Lunartide Voyage',
    description: '今日主線、健康與長期旅程',
    icon: 'focus',
    route: '/focus',
    group: 'creation',
    order: 30,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: true,
    showInModuleSettings: true,
    isCore: true,
    desktopGroup: 'secondary',
    desktopOrder: 80,
    activePrefixes: ['/focus'],
  },

  /* ── 賬號與系統 ── */
  {
    id: 'profile',
    label: '個人資料',
    description: '名字、頭像與身分設定',
    icon: 'profile',
    route: '/profile',
    group: 'account',
    order: 10,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: false,
    showInModuleSettings: true,
    isCore: false,
    activePrefixes: ['/profile'],
  },
  {
    id: 'settings',
    label: '設定',
    description: '外觀、AI 模型與資料管理',
    icon: 'settings',
    route: '/settings',
    group: 'account',
    order: 20,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: false,
    showInModuleSettings: true,
    isCore: true,
    activePrefixes: ['/settings'],
  },
  {
    id: 'about',
    label: '關於月潮',
    description: '版本資訊與本機資料說明',
    icon: 'about',
    route: '/settings/about',
    group: 'account',
    order: 30,
    enabled: true,
    showInMobileMore: true,
    showInDesktopSidebar: false,
    showInModuleSettings: false,
    isCore: false,
    activePrefixes: ['/settings/about'],
  },
  {
    id: 'modules',
    label: '功能與模塊',
    description: '管理月潮中的工具、入口與顯示方式',
    icon: 'settings',
    route: '/settings/modules',
    group: 'account',
    order: 25,
    enabled: true,
    showInMobileMore: false,
    showInDesktopSidebar: false,
    showInModuleSettings: false,
    isCore: false,
    activePrefixes: ['/settings/modules'],
  },
];

/* ══════════════════════════════════════
   輔助函數
   ══════════════════════════════════════ */

/** 取得所有已啟用且未廢棄的模組 */
export function getEnabledModules(): AppModuleDefinition[] {
  return APP_MODULES.filter((m) => m.enabled && !m.deprecated);
}

/** 依 id 取得模組定義 */
export function getModuleById(id: AppModuleId): AppModuleDefinition | undefined {
  return APP_MODULES.find((m) => m.id === id);
}

/** 取得所有「更多」入口應顯示的模組（根據偏好過濾） */
export function getMobileMoreModules(
  hiddenIds: readonly AppModuleId[] = [],
  visibleOverrides: readonly AppModuleId[] = [],
  options: { excludeDockModules?: boolean } = { excludeDockModules: true },
): AppModuleDefinition[] {
  const dockIds = options.excludeDockModules ? new Set(getMobileDockModules().map((module) => module.id)) : new Set<AppModuleId>();
  return getEnabledModules()
    .filter((module) => !dockIds.has(module.id))
    // CLAWD/TIDEBOUND 固定顯示於頁面頂部（global-status-pill），不在 More 出現
    .filter((m) => !m.entryMode || m.entryMode === 'more-sheet')
    // 顯示條件：showInMobileMore=true 且未被隱藏，或 showInMobileMore=false 但在 visibleOverrides 中
    .filter((m) => {
      if (m.showInMobileMore) {
        return !hiddenIds.includes(m.id) || m.isCore;
      }
      return visibleOverrides.includes(m.id);
    })
    .sort((a, b) => {
      const ga = APP_MODULE_GROUPS.find((g) => g.id === a.group)?.order ?? 999;
      const gb = APP_MODULE_GROUPS.find((g) => g.id === b.group)?.order ?? 999;
      if (ga !== gb) return ga - gb;
      return a.order - b.order;
    });
}

/** Canonical five-slot mobile IA uses these four Registry modules plus the synthetic More action. */
export function getMobileDockModules(): AppModuleDefinition[] {
  const ids: readonly AppModuleId[] = ['home', 'chat', 'music', 'calendar'];
  return ids.map((id) => getModuleById(id)).filter((module): module is AppModuleDefinition => Boolean(module?.enabled && !module.deprecated));
}

/** 取得「功能與模塊」設置頁應顯示的模組 */
export function getModuleSettingsList(): AppModuleDefinition[] {
  return getEnabledModules()
    .filter((m) => m.showInModuleSettings)
    .sort((a, b) => {
      const ga = APP_MODULE_GROUPS.find((g) => g.id === a.group)?.order ?? 999;
      const gb = APP_MODULE_GROUPS.find((g) => g.id === b.group)?.order ?? 999;
      if (ga !== gb) return ga - gb;
      return a.order - b.order;
    });
}

/** 取得 Mobile More 的分組（按 APP_MODULE_GROUPS 順序） */
export function getMobileMoreGroups(): AppModuleGroupMeta[] {
  return [...APP_MODULE_GROUPS].sort((a, b) => a.order - b.order);
}

/** 將模組按分組分桶 */
export function groupModulesByGroup(
  modules: readonly AppModuleDefinition[],
): { group: AppModuleGroupMeta; items: AppModuleDefinition[] }[] {
  const groups = getMobileMoreGroups();
  return groups
    .map((group) => ({
      group,
      items: modules.filter((m) => m.group === group.id),
    }))
    .filter((bucket) => bucket.items.length > 0);
}

/** 判斷給定 pathname 是否對應到某個模組（用於 active 狀態） */
export function resolveActiveModuleId(pathname: string): AppModuleId | null {
  // 按 route 長度降序排列，讓更具體的路由（如 /settings/about）優先匹配，
  // 而非被較通用的路由（如 /settings）覆蓋。
  const sorted = [...getEnabledModules()].sort((a, b) => {
    const aLen = Math.max(...(a.activePrefixes ?? [a.route]).map((p) => p.length));
    const bLen = Math.max(...(b.activePrefixes ?? [b.route]).map((p) => p.length));
    return bLen - aLen;
  });
  for (const mod of sorted) {
    const prefixes = mod.activePrefixes ?? [mod.route];
    for (const prefix of prefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return mod.id;
      }
    }
  }
  return null;
}

/** 取得「更多」按鈕應高亮的所有路由前綴（用於 dockNavigation） */
export function getMoreActivePrefixes(): readonly string[] {
  const prefixes = new Set<string>();
  // Only exclude core dock tabs (home/chat/music/calendar) — primary nav
  // modules like journal/moonread still need More highlighting on mobile.
  const dockTabIds = new Set<AppModuleId>(getMobileDockModules().map((module) => module.id));
  for (const mod of getEnabledModules()) {
    if (dockTabIds.has(mod.id)) continue;
    const modPrefixes = mod.activePrefixes ?? [mod.route];
    for (const p of modPrefixes) prefixes.add(p);
  }
  return Array.from(prefixes);
}

/** 取得 Desktop Sidebar 主要導航模組（單列，按 desktopOrder 排序） */
export function getDesktopPrimaryModules(): AppModuleDefinition[] {
  return APP_MODULES
    .filter((m) => m.enabled && !m.deprecated && m.isPrimaryNavigation)
    .sort((a, b) => (a.desktopOrder ?? 999) - (b.desktopOrder ?? 999));
}

/** 取得 Desktop Sidebar 月潮空間次級模組（雙列網格，按 desktopOrder 排序）。
 *  尊重 hiddenIds（隱藏 showInDesktopSidebar=true 的模組）與
 *  visibleOverrides（顯示 showInDesktopSidebar=false 的模組）。
 */
export function getDesktopSecondaryModules(
  hiddenIds: readonly AppModuleId[] = [],
  visibleOverrides: readonly AppModuleId[] = [],
): AppModuleDefinition[] {
  return APP_MODULES
    .filter((m) => {
      if (!m.enabled || m.deprecated || m.isPrimaryNavigation) return false;
      if (m.id === 'objects') return false;
      if (m.showInDesktopSidebar) {
        return !hiddenIds.includes(m.id) || m.isCore;
      }
      return visibleOverrides.includes(m.id);
    })
    .sort((a, b) => (a.desktopOrder ?? 999) - (b.desktopOrder ?? 999));
}

/** 取得 Desktop Sidebar 全部模組（主導航 + 次級） */
export function getDesktopSidebarModules(
  hiddenIds: readonly AppModuleId[] = [],
  visibleOverrides: readonly AppModuleId[] = [],
): { primary: AppModuleDefinition[]; secondary: AppModuleDefinition[] } {
  return {
    primary: getDesktopPrimaryModules(),
    secondary: getDesktopSecondaryModules(hiddenIds, visibleOverrides),
  };
}

/** 核心入口 id 清單（不可隱藏） */
export const CORE_MODULE_IDS: readonly AppModuleId[] = APP_MODULES
  .filter((m) => m.isCore)
  .map((m) => m.id);
