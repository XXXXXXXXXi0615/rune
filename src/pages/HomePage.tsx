import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { ActivityHeatmap } from '@/components/shared/ActivityHeatmap';
import { toLocalDateString } from '@/utils/date';
import { useSystemState } from '@/core/systemBridge';
import { AppIcon } from '@/components/icons/AppIcon';
import { DailyCacheIcon } from '@/components/icons/DailyCacheIcon';
import { getQuestDateKey, useQuestStore } from '@/store/useQuestStore';
import { useDailyCacheWindowStore } from '@/store/useDailyCacheWindowStore';
import { DailyTideWidget } from '@/components/home/DailyTideWidget';
import { TodayQuestWidget } from '@/components/home/TodayQuestWidget';
import { HomeCountdownWidget } from '@/components/home/HomeCountdownWidget';
import { useHomeWidgetStore, selectCountdownWidgetEnabled } from '@/store/useHomeWidgetStore';
import { HomeWidgetGrid } from '@/components/home/HomeWidgetGrid';
import { HomeFixedClockSection } from '@/components/home/HomeFixedClockSection';
import { HomePresencePill } from '@/components/home/HomePresencePill';
import { PeriodHomeWidget } from '@/components/home/PeriodHomeWidget';
import { HomeCheckInWidget } from '@/components/home/HomeCheckInWidget';
import { HomeTodayTaskWidget } from '@/components/home/HomeTodayTaskWidget';
import { HomeAnniversaryWidget } from '@/components/home/HomeAnniversaryWidget';
import { HomeLunarisWidget } from '@/components/home/HomeLunarisWidget';
import { HomeActivityHeatmapWidget } from '@/components/home/HomeActivityHeatmapWidget';
import { HomeHydrationWidget } from '@/components/home/HomeHydrationWidget';
import { MoonLexHomeWidget } from '@/components/home/MoonLexHomeWidget';
import '@/styles/dailytide.css';
import '@/styles/home-widget-grid.css';
import '@/styles/home-widget-visual.css';
import '@/styles/home-presence-pill.css';
import '@/styles/home-widget-gallery.css';
import '@/styles/home-storybook.css';

function useNow() {
  const [now] = useState(new Date());
  return now;
}

// ═══════════════════════════════════════
// L2 — NAV ACTIONS (4 entry points)
// ═══════════════════════════════════════

function L2_NavActions() {
  const navigate = useNavigate();
  const quests = useQuestStore((state) => state.quests);
  const badge = quests.filter((quest) => quest.status === 'available' && getQuestDateKey(quest) === toLocalDateString()).length
    || quests.filter((quest) => quest.status === 'in_progress').length;
  const items = [
    { label: '對話', description: '月潮對話', icon: 'chat' as const, to: '/chat' },
    { label: '日記', description: '手記與回憶', icon: 'diary' as const, to: '/journal' },
    { label: '飲食', description: '今日飲食', icon: 'food' as const, to: '/diet' },
    { label: '任務', description: '待辦任務', icon: 'quest' as const, to: '/quests', badge },
  ];
  return (
    <div className="ah-layer ah-shortcut-layer">
      <div className="ah-action-bar ah-action-bar--labeled">
        {items.map((item) => (
          <button key={item.to} type="button"
            className="ah-action-btn ah-action-btn--labeled"
            onClick={() => navigate(item.to)}
            aria-label={`${item.label}：${item.description}`}
            title={item.label}
          >
            <span className="ah-action-icon"><AppIcon name={item.icon} size={20} /></span>
            <span className="ah-action-label">{item.label}</span>
            {'badge' in item && (item.badge ?? 0) > 0 && <span className="ah-action-badge">{item.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// L3 — ANALYTICS (ActivityHeatmap only)
// ═══════════════════════════════════════

function L3_Analytics() {
  return (
    <section className="ah-layer ah-heatmap-layer">
      <div className="ah-section-head">
        <span className="ah-section-title">
          <span className="ah-section-label ah-section-label--accent">活動熱力圖</span>
        </span>
      </div>
      <div className="ah-analytic-body">
        <ActivityHeatmap fullWidth />
      </div>
    </section>
  );
}


// ════════════════════════════════════════════════════
// MOBILE TOOLBAR — Daily Cache + search/notification icons
// ════════════════════════════════════════════════════

function HomeMobileToolbar() {
  const openCacheWindow = useDailyCacheWindowStore((s) => s.openWindow);
  return (
    <div className="home-mobile-toolbar" role="toolbar" aria-label="首頁工具列">
      <button
        type="button"
        className="dc-toolbar-btn"
        onClick={openCacheWindow}
        aria-label="每日緩存"
        title="每日緩存"
      >
        <DailyCacheIcon size={20} />
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════
// MAIN HOME PAGE — V2 LOCKSCREEN MINIMAL ARCHITECTURE
// ════════════════════════════════════════════════════

export function HomePage() {
  const now = useNow();
  const runDailyDietSettlement = useAppStore((s) => s.runDailyDietSettlement);


  const systemState = useSystemState();

  const todayStr = toLocalDateString(now);

  // Home Widget Registry — countdown widget visibility
  const showCountdownWidget = useHomeWidgetStore(selectCountdownWidgetEnabled);

  useEffect(() => {
    runDailyDietSettlement();
  }, [runDailyDietSettlement]);


  /* Echo state (ambient modulation) */
  const diaryEntries = useAppStore((s) => s.diaryEntries || []);
  const activityLogs = useAppStore((s) => s.activityLogs || []);
  const healthRecords = useAppStore((s) => s.healthRecords);
  const mealEntries = useAppStore((s) => s.mealEntries);
  const focusSessionLog = useAppStore((s) => s.focusSessionLog || []);
  const todos = useAppStore((s) => s.todos);
  const todayStrForTodos = toLocalDateString(new Date());
  const todayTodoItems = useMemo(() =>
    todos.filter(t => t.date === todayStrForTodos).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')),
    [todos, todayStrForTodos]
  );
  const todayPendingCount = todayTodoItems.filter(t => !t.completed).length;
  const todayCompletedCount = todayTodoItems.filter(t => t.completed).length;

  const echoState = useMemo(() => {
    const todayStartMs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    const todayEndMs = todayStartMs + 86400000;

    const todayDiaryCount = diaryEntries.filter(d => toLocalDateString(new Date(d.date)) === todayStr).length;
    const todayMeals = mealEntries.filter(m => m.createdAt >= todayStartMs && m.createdAt < todayEndMs).length;
    const todaySleepRecord = healthRecords.find(r => r.type === 'sleep' && r.date === todayStr);
    const todaySleepMin = todaySleepRecord?.sleepDurationMinutes || 0;
    const todayFocus = focusSessionLog.filter(f => f.date === todayStr).reduce((sum, f) => sum + (f.actualFocusMinutes || 0), 0);
    const todayPending = todayTodoItems.filter(t => !t.completed).length;

    const activityRaw =
      (todayDiaryCount > 0 ? 1 : 0) +
      (todayMeals > 0 ? 1 : 0) +
      (todaySleepMin >= 360 ? 1 : 0) +
      (todayFocus >= 25 ? 1 : 0) +
      (todayPending > 0 ? 0.5 : 0);
    const activityScore = Math.min(1, activityRaw / 4);
    const oneDayAgo = Date.now() - 86400000;
    const recentChats = activityLogs.filter(l => l.type === 'chat' && l.createdAt > oneDayAgo).length;
    const aiPulse = Math.min(1, recentChats / 6);
    const driftSignal = systemState.driftState === 'calm' ? 0.15 : systemState.driftState === 'warm' ? 0.85 : 0.45;
    const intensity = activityScore * 0.50 + aiPulse * 0.30 + driftSignal * 0.20;

    let echoMood: 'silent' | 'active' | 'resonant' = 'active';
    if (intensity < 0.25) echoMood = 'silent';
    else if (intensity > 0.65) echoMood = 'resonant';

    return { intensity, mood: echoMood, activityScore, aiPulse };
  }, [diaryEntries, mealEntries, healthRecords, focusSessionLog, activityLogs, todayStr, todayTodoItems, systemState]);

  const echoCSS = useMemo(() => {
    const i = echoState.intensity;
    const layerOpacity = 0.84 + i * 0.16;
    const glowAlpha = i * 0.12;
    const glowSpread = Math.round(8 + i * 24);
    const hueDeg = 220 - i * 40;
    const satPct = Math.round(10 + i * 20);
    return {
      '--echo-layer-opacity': layerOpacity,
      '--echo-glow-alpha': glowAlpha,
      '--echo-glow-spread': `${glowSpread}px`,
      '--echo-hue': hueDeg,
      '--echo-sat': satPct,
    } as React.CSSProperties;
  }, [echoState]);

  return (
    <section className="view home-view home-view--apple-health home-view--minimal" style={echoCSS} data-echo={echoState.mood} data-clawd-anchor="home">
      {/* Phase 1.5E — Fixed Zone: Clock + PresencePill, normal document flow, no overlap */}
      <div className="home-fixed-zone">
        <HomeFixedClockSection />
        <HomePresencePill />
      </div>

      {/* Phase 1.5E — Workspace: Toolbar + Widget Grid, widget coordinates origin here */}
      <div className="home-workspace">
        <HomeWidgetGrid>
          {{
            'home-checkin': ({ size }) => <HomeCheckInWidget size={size} />,
            'home-today-task': ({ size }) => <HomeTodayTaskWidget size={size} />,
            'home-anniversary': ({ size }) => <HomeAnniversaryWidget size={size} />,
            'home-lunaris': ({ size }) => <HomeLunarisWidget size={size} />,
            'home-period': ({ size }) => <PeriodHomeWidget size={size} />,
            'home-activity-heatmap': ({ size }) => <HomeActivityHeatmapWidget size={size} />,
            'home-hydration': ({ size }) => <HomeHydrationWidget size={size} />,
            'home-moonlex': ({ size }) => <MoonLexHomeWidget size={size} />,
          }}
        </HomeWidgetGrid>
      </div>
    </section>
  );
}
