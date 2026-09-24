export interface SettingsRow {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  route?: string;
}

export interface SettingsGroup {
  key: string;
  label: string;
  description: string;
  icon: string;
  rows: SettingsRow[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  { key: 'us', label: '我們', description: '你與 Rune 的身份資料', icon: 'profile', rows: [
    { key: 'user-profile', title: '我的資料', subtitle: '顯示名稱、簽名與頭像', icon: 'profile', route: '/settings/us/user' },
    { key: 'rune-profile', title: 'Rune 的資料', subtitle: '顯示名稱、簽名與頭像', icon: 'brain', route: '/settings/us/rune' },
  ] },
  { key: 'appearance', label: '外觀', description: 'Rune 的視覺與閱讀體驗', icon: 'palette', rows: [
    { key: 'theme-background', title: '主題與背景', subtitle: '模式、主題預設與背景', icon: 'palette', route: '/settings/appearance/wallpaper' },
    { key: 'typography', title: '字體與排版', subtitle: '字型、字級與閱讀比例', icon: 'font', route: '/settings/appearance/fonts' },
    { key: 'color-transparency', title: '色彩與透明度', subtitle: '強調色與玻璃表現', icon: 'color', route: '/settings/appearance/colors' },
    { key: 'home-clock', title: '首頁時鐘', subtitle: '顯示、位置、大小與拖曳', icon: 'moon', route: '/settings/appearance/home-clock' },
    { key: 'calendar-holidays', title: '節假日地區', subtitle: '選擇要顯示的節假日曆', icon: 'globe', route: '/settings/appearance/calendar-holidays' },
    { key: 'dock', title: '底部導覽列', subtitle: '調整導覽列顯示大小', icon: 'dock', route: '/settings/appearance/dock' },
  ] },
  { key: 'chat', label: '聊天與陪伴', description: 'Rune 的連線與回覆方式', icon: 'chat', rows: [
    { key: 'companion', title: '桌寵', subtitle: '管理顯示、大小與位置', icon: 'moon', route: '/settings/companion' },
    { key: 'providers', title: 'Provider', subtitle: '連線與目前使用的提供者', icon: 'plug', route: '/settings/advanced/providers' },
    { key: 'models', title: '模型', subtitle: '同步與選擇聊天模型', icon: 'brain', route: '/settings/advanced/models' },
    { key: 'agent-capabilities', title: 'Rune 可使用的功能', subtitle: '日曆與朋友圈能力', icon: 'shield', route: '/settings/privacy/agent-capabilities' },
  ] },
  { key: 'memory', label: '記憶', description: '長期記憶與世界書內容', icon: 'brain', rows: [
    { key: 'memory-worldbook', title: '記憶與世界書', subtitle: '管理既有記憶與世界書內容', icon: 'brain', route: '/settings/lunaris/memory' },
  ] },
  { key: 'data', label: '資料', description: '本機資料、備份與清理', icon: 'database', rows: [
    { key: 'storage', title: '儲存空間', subtitle: '查看並清除可重建的暫存資料', icon: 'database', route: '/settings/data/storage' },
    { key: 'export', title: '匯出資料', subtitle: '下載完整本機備份', icon: 'exportArrow', route: '/settings/data/export' },
    { key: 'import', title: '匯入資料', subtitle: '從備份檔還原', icon: 'importArrow', route: '/settings/data/import' },
    { key: 'reset', title: '清除本機資料', subtitle: '移除 Rune 保存在這台裝置的資料', icon: 'trash', route: '/settings/data/reset' },
  ] },
  { key: 'advanced', label: '進階', description: '使用狀態與外部連線', icon: 'wrench', rows: [
    { key: 'usage', title: 'API 使用量', subtitle: '請求、Token、成本與延遲', icon: 'chart', route: '/settings/advanced/usage' },
    { key: 'mcp', title: 'MCP 連線', subtitle: '管理 Model Context Protocol 連線', icon: 'wrench', route: '/settings/advanced/mcp' },
    { key: 'about', title: '關於 Rune', subtitle: '版本與本機資料說明', icon: 'info', route: '/settings/about' },
  ] },
];

export const ADVANCED_ROWS: SettingsRow[] = SETTINGS_GROUPS.find((group) => group.key === 'advanced')?.rows ?? [];

export function searchSettingsRows(query: string): SettingsRow[] {
  const normalized = query.trim().toLocaleLowerCase('zh-TW');
  if (!normalized) return [];
  return SETTINGS_GROUPS.flatMap((group) => group.rows)
    .filter((row) => `${row.title} ${row.subtitle}`.toLocaleLowerCase('zh-TW').includes(normalized));
}

export function resolveLegacySettingsRoute(pathname: string): string | null {
  const redirects: Record<string, string> = {
    '/settings/clawd': '/settings',
    '/settings/agent': '/',
    '/settings/agent/persona': '/',
    '/settings/agent/interaction': '/',
    '/settings/lunaris': '/',
    '/settings/lunaris/persona': '/',
    '/settings/lunaris/companion': '/settings',
    '/settings/lunaris/status': '/settings',
    '/settings/ai/models': '/settings/advanced/models',
    '/settings/ai/providers': '/settings/advanced/providers',
    '/settings/ai/usage': '/settings/advanced/usage',
    '/settings/chat/activity': '/settings/appearance/wallpaper#motion',
    '/settings/appearance/theme-pack': '/settings/appearance/wallpaper',
    '/settings/data/cache': '/settings/data/storage',
    '/settings/modules': '/settings',
    '/settings/advanced/dev': '/settings',
  };
  return redirects[pathname] ?? null;
}
