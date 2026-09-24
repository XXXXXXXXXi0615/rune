import { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getLanguage } from '@/i18n';
import { generateInsights, type LifeInsight } from '@/utils/lifeInsightEngine';
import { loadPeriodRecords, type PeriodRecord } from '@/utils/periodStorage';
import { Card } from '@/components/ui/Card';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcon';
import './LifeInsightsCard.css';
import { useHydrationStore } from '@/store/useHydrationStore';

/** LocalStorage key for persisting today's seen insights so we don't regenerate on every render. */
const INSIGHT_CACHE_KEY = 'lunartide_life_insights_v1';
const INSIGHT_CACHE_DATE_KEY = 'lunartide_life_insights_date_v1';

export function LifeInsightsCard() {
  const isZh = getLanguage() === 'zh-TW';

  /* ── Data sources ── */
  const memoryEntries = useAppStore(s => s.memoryEntries || []);
  const todos = useAppStore(s => s.todos || []);
  const healthRecords = useAppStore(s => s.healthRecords || []);
  const forumPosts = useAppStore(s => s.forumPosts || []);
  const forumReplies = useAppStore(s => s.forumReplies || []);
  const focusSessions = useAppStore(s => s.focusSessionLog || []);
  const conversations = useAppStore(s => s.conversations || []);
  const hydrationEntries = useHydrationStore(s => s.entries);
  const hydrationGoalMl = useHydrationStore(s => s.settings.dailyGoalMl);
  const water = useMemo(() => ({
    goalMl: hydrationGoalMl,
    dailyLogs: hydrationEntries.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.dateKey] = (totals[entry.dateKey] ?? 0) + entry.amountMl;
      return totals;
    }, {}),
  }), [hydrationEntries, hydrationGoalMl]);

  /* ── Favorites from localStorage ── */
  const FAV_KEY = 'lunartide_favorited_memory';
  const [favoritedIds] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem(FAV_KEY); return raw ? new Set(JSON.parse(raw)) : new Set(); }
    catch { return new Set(); }
  });

  /* ── Period from localStorage ── */
  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>([]);
  useEffect(() => { setPeriodRecords(loadPeriodRecords()); }, []);

  /* ── Generate insights (memoized, cached per day) ── */
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [insights, setInsights] = useState<LifeInsight[]>(() => {
    // Try cache first
    try {
      const cachedDate = localStorage.getItem(INSIGHT_CACHE_DATE_KEY);
      const cachedRaw = localStorage.getItem(INSIGHT_CACHE_KEY);
      if (cachedDate && cachedRaw) {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (cachedDate === today) {
          return JSON.parse(cachedRaw) as LifeInsight[];
        }
      }
    } catch { /* ignore */ }
    return [];
  });

  useEffect(() => {
    const input = {
      memoryEntries, todos, healthRecords, forumPosts, forumReplies,
      focusSessions, conversations, periodRecords, water, favoritedIds,
    };
    const generated = generateInsights(input, isZh);
    setInsights(generated);
    try {
      localStorage.setItem(INSIGHT_CACHE_DATE_KEY, todayStr);
      localStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify(generated));
    } catch { /* ignore */ }
  }, [todayStr]); // Only re-run once per day (on mount)

  const categoryColor = (cat: LifeInsight['category']) => {
    const map: Record<string, string> = {
      sleep: '#8b5cf6', creativity: '#0891b2', memory: '#6366f1',
      productivity: '#10b981', health: '#ec4899', focus: '#f59e0b',
      mood: '#d97706',
    };
    return map[cat] || 'var(--accent)';
  };

  const categoryIcon = (cat: LifeInsight['category']): AppIconName => {
    if (cat === 'sleep') return 'sleep';
    if (cat === 'focus' || cat === 'productivity') return 'focus';
    if (cat === 'health') return 'food';
    if (cat === 'memory') return 'memory';
    if (cat === 'creativity') return 'sparkle';
    return 'timeline';
  };

  if (insights.length === 0) return null;

  return (
    <Card className="home-dashboard-card li-card">
      <div className="li-card-header">
        <div className="li-card-header-left">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="li-card-bulb">
            <circle cx="12" cy="5" r="2" />
            <path d="M10 22v-4h4v4" />
            <path d="M12 7v1M9 13H8M16 13h-1" />
          </svg>
          <span className="li-card-title">{isZh ? '今日洞察' : "Today's Insights"}</span>
        </div>
      </div>
      <div className="li-card-list">
        {insights.map((insight, i) => (
          <div key={insight.id} className="li-insight" style={{ '--li-color': categoryColor(insight.category) } as React.CSSProperties}>
            <span className="li-insight-icon"><AppIcon name={categoryIcon(insight.category)} size={20} /></span>
            <div className="li-insight-body">
              <div className="li-insight-text">{insight.text(isZh)}</div>
              <div className="li-insight-detail">{insight.detail(isZh)}</div>
            </div>
            {i < insights.length - 1 && <div className="li-insight-divider" />}
          </div>
        ))}
      </div>
    </Card>
  );
}
