import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';
import { useSystemState } from '@/core/systemBridge';
import { DailyCacheIcon } from '@/components/icons/DailyCacheIcon';
import { useDailyCacheWindowStore } from '@/store/useDailyCacheWindowStore';
import { HomeFixedClockSection } from '@/components/home/HomeFixedClockSection';
import { HomePresencePill } from '@/components/home/HomePresencePill';
import { HomePhotoWall } from '@/components/home/HomePhotoWall';
import '@/styles/dailytide.css';
import '@/styles/home-presence-pill.css';
import '@/styles/home-storybook.css';

function useNow() {
  const [now] = useState(new Date());
  return now;
}

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

export function HomePage() {
  const now = useNow();
  const runDailyDietSettlement = useAppStore((s) => s.runDailyDietSettlement);

  const systemState = useSystemState();

  const todayStr = toLocalDateString(now);

  useEffect(() => {
    runDailyDietSettlement();
  }, [runDailyDietSettlement]);

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
      <div className="home-fixed-zone">
        <HomeFixedClockSection />
        <HomePresencePill />
      </div>
      <HomePhotoWall />
    </section>
  );
}
