/**
 * Life Insight Engine — Template-based rule system.
 * Generates 1-3 daily observations from cross-module data.
 * Designed to be swappable with AI-generated insights in the future.
 */

import type { MemoryEntry, HealthRecord, ForumPost, ForumReply, FocusSessionEntry, TodoItem, Conversation } from '@/types';
import type { PeriodRecord } from '@/utils/periodStorage';
import { MOOD_BY_ID } from '@/components/memory/MoodSystem';

/* ── Public types ── */

export interface InsightInput {
  memoryEntries: MemoryEntry[];
  todos: TodoItem[];
  healthRecords: HealthRecord[];
  forumPosts: ForumPost[];
  forumReplies: ForumReply[];
  focusSessions: FocusSessionEntry[];
  conversations: Conversation[];
  periodRecords: PeriodRecord[];
  water: { dailyLogs: Record<string, number>; goalMl: number } | null;
  favoritedIds: Set<string>;
}

export interface LifeInsight {
  id: string;
  category: 'sleep' | 'mood' | 'creativity' | 'productivity' | 'memory' | 'health' | 'focus';
  emoji: string;
  text: (isZh: boolean) => string;
  detail: (isZh: boolean) => string;
  priority: number; // 0.0-1.0, higher = shown first
}

/* ── Helpers ── */

function dateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayStart(offset = 0): number {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

/* ── Rule definitions ── */

type RuleFn = (input: InsightInput) => LifeInsight | null;

const rules: RuleFn[] = [

  /* ═══ Sleep declining in past 3 days ═══ */
  (input) => {
    const sleep = input.healthRecords
      .filter(h => h.type === 'sleep' && h.sleepDurationMinutes)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sleep.length < 3) return null;

    const last3 = sleep.slice(-3);
    const prev7 = sleep.slice(-10, -3);
    if (prev7.length === 0) return null;

    const last3Avg = avg(last3.map(s => s.sleepDurationMinutes!));
    const prev7Avg = avg(prev7.map(s => s.sleepDurationMinutes!));
    const ratio = last3Avg / Math.max(prev7Avg, 1);

    if (ratio < 0.88 && last3Avg < 420) { // declining by >12% and < 7h
      const h = Math.floor(last3Avg / 60);
      const m = Math.round(last3Avg % 60);
      const priority = Math.min(1, (1 - ratio) * 5);
      return {
        id: 'sleep_decline',
        category: 'sleep',
        emoji: '😴',
        text: (isZh) => isZh ? '最近睡眠時間下降' : 'Recent sleep duration declining',
        detail: (isZh) =>
          isZh
            ? `近 3 天平均 ${h}h${m}m${ratio < 0.75 ? '，明顯低於上週' : ''}，負面情緒可能增加。`
            : `Last 3 days avg ${h}h${m}m${ratio < 0.75 ? ', significantly below last week' : ''}, negative mood may increase.`,
        priority,
      };
    }
    return null;
  },

  /* ═══ Creativity surge — forum posts + memory creations ═══ */
  (input) => {
    const weekStart = dayStart(-6);
    const forumCount = input.forumPosts.filter(p => p.createdAt >= weekStart).length +
      input.forumReplies.filter(r => r.createdAt >= weekStart).length;
    const memCount = input.memoryEntries.filter(e => e.createdAt >= weekStart).length;

    if (forumCount >= 3 && memCount >= 2) {
      return {
        id: 'creativity_surge',
        category: 'creativity',
        emoji: '🌊',
        text: (isZh) => isZh ? '本週創作活躍度提升' : 'Creative activity rising this week',
        detail: (isZh) =>
          isZh
            ? `本週 ${forumCount} 篇論壇互動 + ${memCount} 條記錄，創作能量充盈。`
            : `${forumCount} forum interactions + ${memCount} records this week. Creative energy flows.`,
        priority: Math.min(0.9, (forumCount + memCount) * 0.08),
      };
    }
    return null;
  },

  /* ═══ Favorited memories — common themes ═══ */
  (input) => {
    const favs = input.memoryEntries.filter(e => input.favoritedIds.has(e.id));
    if (favs.length < 2) return null;

    const tagCounts = new Map<string, number>();
    for (const e of favs) for (const t of (e.tags || [])) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);

    if (topTags.length === 0) return null;

    const theme = topTags.map(([t]) => t).join('、');
    return {
      id: 'faved_theme',
      category: 'memory',
      emoji: '⭐',
      text: (isZh) => isZh ? '收藏記憶集中於特定主題' : 'Favorites cluster around a theme',
      detail: (isZh) =>
        isZh
          ? `收藏記憶中「${theme}」出現最頻繁，這可能是你近期關注的方向。`
          : `"${theme}" appears most often in favorites — a recent focus area.`,
      priority: Math.min(0.85, favs.length * 0.12),
    };
  },

  /* ═══ Consecutive todo completion ═══ */
  (input) => {
    const last3Days = [dayStart(-2), dayStart(-1), dayStart(0)];
    const dailyRates = last3Days.map(ds => {
      const dayStr = dateStr(ds);
      const dayTodos = input.todos.filter(t => t.date === dayStr);
      if (dayTodos.length === 0) return null;
      return dayTodos.filter(t => t.completed).length / dayTodos.length;
    });

    const validRates = dailyRates.filter(r => r !== null) as number[];
    if (validRates.length < 3) return null;

    const allAbove80 = validRates.every(r => r >= 0.8);
    if (!allAbove80) return null;

    const avgRate = Math.round(avg(validRates) * 100);
    return {
      id: 'todo_streak',
      category: 'productivity',
      emoji: '✅',
      text: (isZh) => isZh ? '連續幾天完成率很高' : 'Consecutive high completion days',
      detail: (isZh) =>
        isZh
          ? `連續 3 天待辦完成率超過 ${avgRate}%，執行力很棒。`
          : `3 consecutive days with >${avgRate}% todo completion. Great execution.`,
      priority: 0.7,
    };
  },

  /* ═══ Focus sessions increase ═══ */
  (input) => {
    const sessions = input.focusSessions.filter(s => s.actualFocusMinutes >= 15);
    if (sessions.length < 2) return null;

    const thisWeekStart = dayStart(-6);
    const lastWeekStart = dayStart(-13);
    const thisWeek = sessions.filter(s => new Date(s.date).getTime() >= thisWeekStart);
    const lastWeek = sessions.filter(s => {
      const ts = new Date(s.date).getTime();
      return ts >= lastWeekStart && ts < thisWeekStart;
    });

    const twCount = thisWeek.length;
    const lwCount = lastWeek.length;

    if (lwCount === 0 && twCount >= 2) {
      const totalMin = thisWeek.reduce((s, f) => s + f.actualFocusMinutes, 0);
      return {
        id: 'focus_new',
        category: 'focus',
        emoji: '🎯',
        text: (isZh) => isZh ? '本週開始了專注練習' : 'Focus practice started this week',
        detail: (isZh) =>
          isZh
            ? `本週 ${twCount} 次專注共 ${totalMin} 分鐘，專注力正在養成。`
            : `${twCount} focus sessions totaling ${totalMin}min this week. Building the habit.`,
        priority: 0.65,
      };
    }

    if (twCount > lwCount && twCount >= 2) {
      return {
        id: 'focus_increase',
        category: 'focus',
        emoji: '🎯',
        text: (isZh) => isZh ? '專注時間穩定增加中' : 'Focus time steadily increasing',
        detail: (isZh) =>
          isZh
            ? `本週 ${twCount} 次專注${twCount > lwCount ? '，比上週多了 ' + (twCount - lwCount) + ' 次' : ''}。`
            : `${twCount} sessions this week${twCount > lwCount ? ', ' + (twCount - lwCount) + ' more than last week' : ''}.`,
        priority: 0.55,
      };
    }
    return null;
  },

  /* ═══ Period mood awareness ═══ */
  (input) => {
    const now = Date.now();
    const active = input.periodRecords.find(p => {
      const start = new Date(p.startDate).getTime();
      const end = new Date(p.endDate).getTime() + 86400000;
      return now >= start && now < end;
    });
    if (!active) return null;

    const todayMoods = input.memoryEntries
      .filter(e => e.updatedAt >= dayStart(0) && e.moodV4)
      .map(e => e.moodV4!);

    const moodLabels = [...new Set(todayMoods)].map(m => MOOD_BY_ID[m]?.label).filter(Boolean);

    return {
      id: 'period_awareness',
      category: 'health',
      emoji: '🌊',
      text: (isZh) => isZh ? '生理期間，身體需要更多關照' : 'During your period, body needs extra care',
      detail: (isZh) =>
        isZh
          ? (moodLabels.length > 0 ? `今天心情記錄為 ${moodLabels.join('、')}。` : '')
            + '多休息，吃溫熱的食物。'
          : (moodLabels.length > 0 ? `Today\'s mood records: ${moodLabels.join(', ')}. ` : '')
            + 'Rest well and stay warm.',
      priority: 0.75,
    };
  },

  /* ═══ Memory volume spike ═══ */
  (input) => {
    const todayCount = input.memoryEntries.filter(e => e.createdAt >= dayStart(0)).length;
    if (todayCount < 3) return null;

    const last7 = input.memoryEntries.filter(e => e.createdAt >= dayStart(-6) && e.createdAt < dayStart(0)).length;
    const last7DailyAvg = last7 / 7;

    if (todayCount >= last7DailyAvg * 2.5) {
      const moods = input.memoryEntries.filter(e => e.createdAt >= dayStart(0) && e.moodV4).map(e => e.moodV4!);
      const topMoodLabel = moods.length > 0 ? MOOD_BY_ID[moods[0]]?.label : '';
      return {
        id: 'memory_spike',
        category: 'memory',
        emoji: '🧠',
        text: (isZh) => isZh ? '今天記錄了比平常多的潮痕' : 'More tide traces than usual today',
        detail: (isZh) =>
          isZh
            ? `今天已記錄 ${todayCount} 條${topMoodLabel ? '，主要心情為 ' + topMoodLabel : ''}。是平常的 ${Math.round(todayCount / Math.max(last7DailyAvg, 1))} 倍。`
            : `${todayCount} traces today${topMoodLabel ? ', mostly ' + topMoodLabel : ''}. ${Math.round(todayCount / Math.max(last7DailyAvg, 1))}× the average.`,
        priority: Math.min(0.8, todayCount * 0.1),
      };
    }
    return null;
  },

  /* ═══ Low water intake ═══ */
  (input) => {
    if (!input.water) return null;
    const todayMl = input.water.dailyLogs?.[dateStr(Date.now())] || 0;
    const goal = input.water.goalMl || 2000;

    if (todayMl > 0 && todayMl < goal * 0.4) {
      const hour = new Date().getHours();
      if (hour < 20) {
        return {
          id: 'low_water',
          category: 'health',
          emoji: '💧',
          text: (isZh) => isZh ? '今天喝水還不夠' : 'Hydration is low today',
          detail: (isZh) =>
            isZh
              ? `目前 ${todayMl}ml/${goal}ml，還差 ${goal - todayMl}ml。記得補充水分。`
              : `${todayMl}ml/${goal}ml, ${goal - todayMl}ml to go. Stay hydrated.`,
          priority: 0.6,
        };
      }
    }
    return null;
  },

];

/* ── Public API ── */

export function generateInsights(input: InsightInput, isZh: boolean): LifeInsight[] {
  const results = rules
    .map(rule => rule(input))
    .filter((r): r is LifeInsight => r !== null)
    .sort((a, b) => b.priority - a.priority);

  // Return top 1-3
  if (results.length === 0) return [];
  if (results.length === 1) return results;
  return results.slice(0, 3);
}
