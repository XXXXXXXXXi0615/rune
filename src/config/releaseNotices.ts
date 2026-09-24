import type { UpdateRelease } from './updateNotes';
import { CURRENT_RELEASE } from './updateNotes';

export interface IterationRecord {
  id: string;
  sprintLabel: string;
  startedAt: number;
  completedAt: number;
  goal: string;
  deliverables: string[];
  techDebtResolved: string[];
  nextTasks: string[];
}

export interface ReleaseNotice {
  id: string;
  version: string;
  publishedAt: number;
  added: string[];
  improved: string[];
  fixed: string[];
  knownIssues: string[];
  sourceIterationIds: string[];
  readAt?: number;
  dismissedUntil?: number;
}

function noticeId(version: string): string {
  return `release:${version}:lunartide-v1`;
}

const ITERATIONS: IterationRecord[] = [
  {
    id: 'iter-001',
    sprintLabel: 'Sprint 1 — 基礎架構',
    startedAt: new Date('2026-06-01').getTime(),
    completedAt: new Date('2026-06-07').getTime(),
    goal: '建立 Lunartide 前端骨架與核心路由',
    deliverables: [
      'React + Vite + TypeScript 初始化',
      'Zustand 狀態管理 (useAppStore)',
      '路由結構 (/ 首頁, /chat, /memory, /calendar, /music)',
      'Mobile First 底部導覽',
    ],
    techDebtResolved: [],
    nextTasks: ['實現 AI 對話串接', '上線 MoonRead HTML 閱讀器'],
  },
  {
    id: 'iter-002',
    sprintLabel: 'Sprint 2 — 對話與記憶',
    startedAt: new Date('2026-06-08').getTime(),
    completedAt: new Date('2026-06-14').getTime(),
    goal: '實現 AI 對話與記憶系統',
    deliverables: [
      'ChatPage 對話介面 (MessageList / ChatInput)',
      'AI Provider 中心 (ProviderCenter)',
      'MemoryPage 記憶面板 (DiaryPanel / QuickJournalForm)',
      '活動熱力圖 (ActivityHeatmap)',
    ],
    techDebtResolved: ['統一 date 工具函式 (toLocalDateString)'],
    nextTasks: ['行動版更多 Drawer', '訂閱管理系統', 'AI Provider 真實資料流'],
  },
  {
    id: 'iter-003',
    sprintLabel: 'Sprint 3 — 生態系統擴展',
    startedAt: new Date('2026-06-15').getTime(),
    completedAt: new Date('2026-06-22').getTime(),
    goal: '擴展首頁生態與行動體驗',
    deliverables: [
      '訂閱管理系統上線',
      '行動版底部導覽加入「更多」Drawer',
      'AI Provider 真實資料流串接',
      '設定狀態概覽讀取真實 Store',
      'Emoji 圖標遷移至 SVG',
      'Clawd 桌寵支援底部導航感知',
    ],
    techDebtResolved: ['狀態概覽與角色/技能模態框簡化'],
    nextTasks: ['月潮打卡機 TideClock', '潮汐釣場 LUNARIS Playroom'],
  },
  {
    id: 'iter-004',
    sprintLabel: 'Sprint 4 — 打卡與釣場',
    startedAt: new Date('2026-07-01').getTime(),
    completedAt: new Date('2026-07-14').getTime(),
    goal: '上線月潮打卡機與潮汐釣場',
    deliverables: [
      '月潮打卡機 TideClock (useCheckInStore / TideClockMachine)',
      '連續打卡獎勵與 Moon Dew 結算',
      '潮汐釣場 Playroom (FishingGamePage / fishingClient)',
      'LUNARIS Profile Panel',
    ],
    techDebtResolved: [],
    nextTasks: ['排程專注任務系統', '每日緩存抽屜', '今日待辦 2.0'],
  },
  {
    id: 'iter-005',
    sprintLabel: 'Sprint 5 — 任務與緩存',
    startedAt: new Date('2026-07-15').getTime(),
    completedAt: new Date('2026-07-21').getTime(),
    goal: '任務系統升級與每日緩存',
    deliverables: [
      'Quest 任務系統 (useQuestStore / QuestPage)',
      '專注計時器 (FocusSession / FocusWindow / FocusIsland)',
      '每日緩存抽屜 (DailyCacheWindow)',
      'TodayTodo 2.0 (stats card / heatmap / suggestion)',
    ],
    techDebtResolved: ['ResizableEditorWindow CSS cascade workaround'],
    nextTasks: ['首頁簽到小組件', '月潮更新摘要面板'],
  },
];

const RELEASE_NOTICES: ReleaseNotice[] = [
  {
    id: noticeId(CURRENT_RELEASE.version),
    version: CURRENT_RELEASE.version,
    publishedAt: new Date('2026-06-15').getTime(),
    added: [
      '訂閱管理系統上線（分類 / 帳單週期 / 自動續約）',
      '行動版底部導覽加入「更多」Drawer（音樂、訂閱、作品庫、專注）',
      'AI Provider 真實資料流串接，Luna 對話可使用實體模型',
    ],
    improved: [
      '設定狀態概覽改為讀取真實 Store 資料',
      '狀態概覽與角色／技能模態框的 Emoji 圖標遷移至 SVG',
      'Clawd 桌寵支援底部導航感知的右下角定位',
    ],
    fixed: [],
    knownIssues: ['CSS minify 使用 lightningcss workaround（@keyframes 解析問題）'],
    sourceIterationIds: ['iter-003'],
  },
  {
    id: noticeId('2026.07.22'),
    version: '2026.07.22',
    publishedAt: new Date('2026-07-22').getTime(),
    added: [
      '月潮打卡機 TideClock 上線（useCheckInStore）',
      '連續打卡獎勵與 Moon Dew 結算系統',
      '潮汐釣場 Playroom（FishingGamePage / mock 引擎）',
      'LUNARIS Profile Panel（首頁同儕狀態卡）',
    ],
    improved: [
      '首頁改為 Apple Health 式層疊架構（ah-layer）',
      'FlipCalendarClock 可縮放時鐘',
    ],
    fixed: ['修復 .cw-model-pill CSS 壞選擇器'],
    knownIssues: ['Python ai-fishing-game 引擎尚未接上（Phase 2 待辦）'],
    sourceIterationIds: ['iter-004'],
  },
  {
    id: noticeId('2026.07.23'),
    version: '2026.07.23',
    publishedAt: new Date('2026-07-23').getTime(),
    added: [
      'Quest 任務系統上線（useQuestStore / QuestPage）',
      '專注計時器（FocusSession / FocusWindow / FocusIsland）',
      '每日緩存抽屜 (DailyCacheWindow)',
      'TodayTodo 2.0 (stats / heatmap / suggestion)',
    ],
    improved: [
      '首頁快捷鍵 L2_NavActions 改為 4 圖標按鈕',
      'LunarisGlassCard 顯示同儕連線狀態',
    ],
    fixed: ['ResizableEditorWindow 使用 setProperty important workaround'],
    knownIssues: [],
    sourceIterationIds: ['iter-005'],
  },
];

export { ITERATIONS, RELEASE_NOTICES, noticeId };

export function generateReleaseNotices(
  existingNotices: ReleaseNotice[],
  release: UpdateRelease,
  iterationId: string,
): ReleaseNotice | null {
  const nid = noticeId(release.version);
  if (existingNotices.some((n) => n.id === nid)) return null;
  return {
    id: nid,
    version: release.version,
    publishedAt: Date.now(),
    added: release.items.slice(0, 3),
    improved: release.items.slice(3, 6),
    fixed: [],
    knownIssues: [],
    sourceIterationIds: [iterationId],
  };
}

export function getLatestUnreadNotice(
  notices: ReleaseNotice[],
): ReleaseNotice | undefined {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const tomorrowStart = todayStart + 86400000;
  return notices
    .filter((n) => {
      if (n.readAt) return false;
      if (n.dismissedUntil && n.dismissedUntil > now && n.dismissedUntil < tomorrowStart) return false;
      return true;
    })
    .sort((a, b) => b.publishedAt - a.publishedAt)[0];
}
