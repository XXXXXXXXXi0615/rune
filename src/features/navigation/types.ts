/**
 * App Module Registry — 二級功能與 Overflow Module Registry 類型定義
 *
 * 管理 Mobile More Sheet、Settings「功能與模塊」、DesktopSidebar 等
 * 非主要 Dock Tab（home/chat/music/calendar）的功能入口。
 *
 * 主導航（Home/Chat/Music/Calendar）由 Registry 派生，Dock 不維護第二份 route 清單。
 * DockMoreSheet、Settings、DesktopSidebar 均從此 Registry 讀取，
 * 不維護獨立的入口陣列。
 *
 * 詳見 src/features/navigation/appModuleRegistry.ts
 */

/** 模組唯一識別碼 */
export type AppModuleId =
  /* 核心入口（Dock 主 Tab，不可隱藏） */
  | 'home'
  | 'chat'
  | 'music'
  | 'calendar'
  /* 生活 */
  | 'journal'
  | 'lifeLedger'
  | 'objects'
  | 'quests'
  | 'clawd'
  | 'focus'
  | 'moonlex'
  /* 工具與管理 */
  | 'ledger'
  | 'storage'
  /* 娛樂 */
  | 'playroom'
  | 'stash'
  /* 創作（預設不顯示在 Mobile More） */
  | 'works'
  | 'inspiration'
  /* 賬號與系統 */
  | 'profile'
  | 'settings'
  | 'about'
  | 'modules'
  /* 觀察與提醒 */
  | 'tidewatch';

/** 模組分組 */
export type AppModuleGroup =
  | 'life'           // 生活
  | 'tools'          // 工具與管理
  | 'entertainment'  // 娛樂
  | 'creation'       // 創作
  | 'account';       // 賬號與系統

/** 模組圖示名稱（與 MoreSheetIcon / DesktopNavIcon 對應） */
export type ModuleIconName =
  | 'home'
  | 'chat'
  | 'journal'
  | 'lifeLedger'
  | 'listChecks'
  | 'objects'
  | 'clawd'
  | 'focus'
  | 'ledger'
  | 'storage'
  | 'playroom'
  | 'stash'
  | 'moonlex'
  | 'works'
  | 'inspiration'
  | 'quest'
  | 'profile'
  | 'settings'
  | 'about'
  | 'music'
  | 'calendar'
  | 'tidewatch';

/** 分組顯示資訊 */
export interface AppModuleGroupMeta {
  id: AppModuleGroup;
  label: string;
  order: number;
}

/** 模組定義 */
export interface AppModuleDefinition {
  /** 唯一識別碼 */
  id: AppModuleId;
  /** 繁體中文顯示名稱 */
  label: string;
  /** 英文副標（可選，例如 Tide Ledger） */
  secondaryLabel?: string;
  /** 一行說明 */
  description: string;
  /** 圖示 */
  icon: ModuleIconName;
  /** 點擊後跳轉的路由 */
  route: string;
  /** 所屬分組 */
  group: AppModuleGroup;
  /** 在分組內的排序權重（越小越靠前） */
  order: number;
  /** 模組是否啟用（頁面存在且可用） */
  enabled: boolean;
  /** 是否在 Mobile More Sheet 顯示 */
  showInMobileMore: boolean;
  /** 是否在 Desktop Sidebar 顯示 */
  showInDesktopSidebar: boolean;
  /** 是否在「功能與模塊」設置頁顯示 */
  showInModuleSettings: boolean;
  /** 是否為核心入口（不可完全隱藏） */
  isCore: boolean;
  /** 用於 active 狀態檢測的路由前綴（若與 route 不同） */
  activePrefixes?: readonly string[];
  /** 標記為已廢棄（不顯示入口，僅在審計報告中說明） */
  deprecated?: boolean;
  /** 廢棄原因（僅 deprecated=true 時有效） */
  deprecatedReason?: string;
  /** 入口模式：'more-sheet'（預設，顯示在 More）、'global-status-pill'（固定於頁面頂部，不在 More 顯示） */
  entryMode?: 'more-sheet' | 'global-status-pill';
  /** Desktop Sidebar 中的組別：'primary'=主導航單列，'secondary'=月潮空間雙列網格 */
  desktopGroup?: 'primary' | 'secondary';
  /** Desktop Sidebar 中的排序權重（越小越靠前） */
  desktopOrder?: number;
  /** Desktop 雙列網格中佔用的欄數（1 或 2，預設 1） */
  desktopSpan?: 1 | 2;
  /** 是否為主要導航入口（首頁/聊天/手記/音樂/共讀/日曆），不受模組偏好隱藏 */
  isPrimaryNavigation?: boolean;
  /** 顯示於首頁的完整 App Launcher。 */
  showInLauncher?: boolean;
  /** 顯示於底部 Dock；Dock 只可由 Registry 派生。 */
  showInDock?: boolean;
  /** 顯示於 Rune Utility 的直接 App Launcher。 */
  showInRuneUtility?: boolean;
}

/** 模組偏好（用戶可自定義的顯示與排序） */
export interface AppModulePreferences {
  /** 用戶隱藏的模組 id 清單（核心入口會被過濾掉）。僅作用於 showInMobileMore=true 的模組 */
  hiddenIds: AppModuleId[];
  /** 用戶主動顯示的模組 id（覆寫 showInMobileMore=false 的預設，如作品庫／靈感庫） */
  visibleOverrides: AppModuleId[];
  /** 自定義排序（id 順序，未列出的使用 Registry 預設 order） */
  customOrder: AppModuleId[];
  /** 各 navigation surface 的獨立隱藏覆寫。 */
  hiddenRuneUtilityIds?: AppModuleId[];
  hiddenDesktopSidebarIds?: AppModuleId[];
  hiddenMobileMoreIds?: AppModuleId[];
}
