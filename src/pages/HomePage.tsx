import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useModalStore } from '@/store/useModalStore';
import { useDrawerStore } from '@/store/useDrawerStore';
import { useAppStore } from '@/store/useAppStore';
import { TodoIcon, MoonIcon } from '@/components/icons/LunartideIcons';
import { QuickMoodSheet } from '@/components/home/QuickMoodSheet';
import { CoupleCapsule } from '@/components/home/CoupleCapsule';
import { ChatHeatmap } from '@/components/home/ChatHeatmap';
import { ThemeToggle } from '@/components/home/ThemeToggle';
import { MoonReadCard } from '@/components/home/MoonReadCard';
import { LunaMessage } from '@/components/layout/LunaMessage';
import { t, getLanguage } from '@/i18n';
import { computeMemoryStats } from '@/ai/memorySummary';
import { toLocalDateString } from '@/utils/date';

const WEEKDAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return t('home.goodMorning');
  if (hour >= 12 && hour < 18) return t('home.goodAfternoon');
  return t('home.goodEvening');
}

function getGreetingComma(): string {
  return getLanguage() === 'en' ? ',' : '，';
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const MOOD_LABELS: Record<number, string> = { 0: '', 2: '愉悅', 4: '平靜', 6: '疲憊', 8: '焦慮' };
const LOCATION_ALIAS: Record<string, string> = {
  '床上': '失眠街', '公司': '996工業區', '學校': '重啟校區',
  '咖啡店': '雨夜咖啡館', '車站': '緩衝站', '夢裡': '月潮外海', '未分類': '未命名地帶',
};
function locationAlias(name: string): string { return LOCATION_ALIAS[name] || name }

function formatDate(d: Date): string {
  const lang = getLanguage();
  if (lang === 'en') {
    const locale = 'en-US';
    const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
    const month = d.toLocaleDateString(locale, { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    return `${weekday}, ${month} ${day}, ${year}`;
  }
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAYS_ZH[d.getDay()];
  return `${y}年${m}月${day}日 · ${w}`;
}

export function HomePage() {
  const navigate = useNavigate();
  const now = useNow();

  // Store selectors
  const displayName = useAppStore((s) => s.profile.displayName);
  const todos = useAppStore((s) => s.todos);
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);

  const activeSheet = useModalStore((s) => s.activeSheet);
  const openSheet = useModalStore((s) => s.openSheet);
  const closeSheet = useModalStore((s) => s.closeSheet);
  const openDrawer = useDrawerStore((s) => s.openDrawer);
  const [memoryPopoverOpen, setMemoryPopoverOpen] = useState(false);

  const today = toLocalDateString(now);

  // Today's memories (with safety checks)
  const safeMemories = Array.isArray(memoryEntries) ? memoryEntries : [];
  const todayMemories = safeMemories.filter((m) => {
    try { const d = new Date(m.createdAt).toISOString().slice(0, 10); return d === today; } catch { return false; }
  });
  const stats = safeMemories.length > 0 ? computeMemoryStats(safeMemories) : { total: 0, thisWeek: 0, dominantEmotion: null as string | null } as ReturnType<typeof computeMemoryStats>;
  const recentMemories = safeMemories.slice(0, 5);
  // Spotlight: mouse-tracking glow on summary grid
  const handleSpotlightMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const grid = e.currentTarget
    const rect = grid.getBoundingClientRect()
    grid.style.setProperty('--spotlight-x', `${e.clientX - rect.left}px`)
    grid.style.setProperty('--spotlight-y', `${e.clientY - rect.top}px`)
  }

  const todayTodos = todos.filter((t) => t.date === today);
  const incompleteTodos = todayTodos.filter((todo) => !todo.completed);
  const latestMemory = memoryEntries.length > 0 ? memoryEntries[0] : null;

  return (
    <section className="view home-view">
      {/* ================================================================
          HERO — capsule, clock, date, greeting, brand subtitle
          ================================================================ */}
      <div className="home-hero">
        <div className="home-hero-top">
          <CoupleCapsule />
          <ThemeToggle />
        </div>
        <div className="home-clock">{formatClock(now)}</div>
        <div className="home-date">{formatDate(now)}</div>
        <div className="home-greeting">
          {getGreeting(now.getHours())}{getGreetingComma()}
          <span className="home-greeting-name">{displayName}</span>
        </div>
        <div className="home-brand">
          <span className="home-brand-name">Lunartide</span>
          <span className="home-brand-tagline">{t('home.tagline')}</span>
        </div>
      </div>

      {/* ================================================================
          TODAY SUMMARY — 2×2 grid
          ================================================================ */}
      <Card className="home-dashboard-card home-dashboard-summary">
        <div className="sec-hdr">
          <span className="sec-title">{t('home.todaySummary')}</span>
        </div>
        <div className="summary-grid" onMouseMove={handleSpotlightMove}>
          {/* Todos — opens Calendar; add link opens the full Todo sheet */}
          <button className="summary-cell summary-cell-small home-dashboard-todo" onClick={() => navigate('/calendar')}>
            <div className="desktop-card-title">今日待辦</div>
            <div className="summary-cell-icon"><TodoIcon size={18} /></div>
            <div className="summary-cell-label">{t('home.todos')}</div>
            {incompleteTodos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div className="summary-cell-value" style={{ fontSize: 14, color: 'var(--text-3)' }}>
                  {t('home.noTodos')}
                </div>
                <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={(e) => { e.stopPropagation(); openDrawer('todo'); }}>
                  + 新增待辦
                </span>
              </div>
            ) : (
              <>
                <div className="summary-cell-value">{incompleteTodos.length}</div>
                <div className="summary-cell-sub">{incompleteTodos.length} {t('home.incomplete')}</div>
              </>
            )}
          </button>

          {/* MoonRead */}
          <MoonReadCard />

          {/* Recent Memory — click opens popover */}
          <button className="summary-cell summary-cell-large home-dashboard-memory" onClick={() => setMemoryPopoverOpen(true)}>
            <div className="desktop-card-title">最近記憶</div>
            <div className="summary-cell-icon"><MoonIcon size={18} /></div>
            <div className="summary-cell-label">{t('home.memory')}</div>
            {latestMemory ? (
              <>
                <div className="summary-cell-value" style={{ fontSize: 13, lineHeight: 1.3 }}>
                  {todayMemories.length > 0
                    ? `今日新增 ${todayMemories.length} 條`
                    : `共 ${memoryEntries.length} 條記憶`}
                </div>
                <div className="summary-cell-sub">
                  {stats.dominantEmotion && (
                    <span style={{
                      fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 8,
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                    }}>
                      {stats.dominantEmotion}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="summary-cell-value" style={{ fontSize: 16, color: 'var(--text-3)' }}>
                {t('home.noMemory')}
              </div>
            )}
          </button>

        </div>
      </Card>

      {/* ================================================================
          LUNA CONTEXT MESSAGE
          ================================================================ */}
      <Card className="home-dashboard-card home-dashboard-lunaris">
        <div className="desktop-card-title">LUNARIS 狀態</div>
        <LunaMessage page="home" memoryCount={memoryEntries.length} />
      </Card>

      {/* ================================================================
          SYSTEM ACTIVITY — latest activity logs as dashboard feed
          ================================================================ */}
      <SystemActivity />

      {/* ================================================================
          TIDE FOOTPRINT — 12-week chat heatmap
          ================================================================ */}
      <Card className="home-dashboard-card home-dashboard-tide">
        <div className="desktop-card-title">潮汐足跡</div>
        <ChatHeatmap />
      </Card>

      {/* ================================================================
          QUICK SHEETS
          ================================================================ */}
      <QuickMoodSheet
        isOpen={activeSheet === 'mood'}
        onClose={closeSheet}
      />
      {/* ── Memory Popover ── */}
      {memoryPopoverOpen && createPortal(
        <div
          className="lang-modal-overlay"
          onClick={() => setMemoryPopoverOpen(false)}
          style={{ zIndex: 200 }}
        >
          <div
            className="lang-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, width: 'calc(100vw - 32px)', maxHeight: '70vh', overflowY: 'auto' }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>最近記憶</h2>

            {recentMemories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 13 }}>
                尚無記憶記錄
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentMemories.map((m) => {
                  const d = new Date(m.createdAt);
                  const timeStr = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
                    + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                  const sourceLabel = m.cardType === 'health' ? '健康'
                    : m.triggerText?.includes('月讀') ? '月讀室'
                    : m.triggerText?.includes('聊天') ? '聊天'
                    : '手動';
                  const displayText = m.summary || m.scene || '未命名記憶';
                  const emotionLabel = m.anxietyLevel >= 7 ? '低落'
                    : m.anxietyLevel >= 5 ? '激昂'
                    : m.anxietyLevel >= 3 ? '愉悅'
                    : '疲憊';

                  return (
                    <div key={m.id} style={{
                      padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10,
                      display: 'flex', flexDirection: 'column', gap: 3,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{displayText}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{timeStr}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 6,
                          background: 'var(--accent-soft)', color: 'var(--accent)',
                        }}>{emotionLabel}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{sourceLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setMemoryPopoverOpen(false); navigate('/memory'); }}
                style={{ flex: 1, fontSize: 13 }}
              >
                查看全部記憶
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => { setMemoryPopoverOpen(false); openSheet('mood'); }}
                style={{ flex: 1, fontSize: 13 }}
              >
                新增記憶
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Quick Actions FAB */}
      <div className="quick-actions">
        <button className="quick-action-fab primary" onClick={() => navigate('/memory?action=new')} aria-label="新增記憶" title="新增記憶">
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: '#fff', fill: 'none', strokeWidth: 2 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button className="quick-action-fab" onClick={() => navigate('/chat')} aria-label="聊天" title="聊天"
          style={{ background: 'var(--coral)' }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: '#fff', fill: 'none', strokeWidth: 2 }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
        <button className="quick-action-fab" onClick={() => navigate(`/calendar?action=new&date=${today}`)} aria-label="待辦" title="待辦"
          style={{ background: 'var(--amber)' }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: '#fff', fill: 'none', strokeWidth: 2 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function SystemActivity() {
  const navigate = useNavigate()
  const activityLogs = useAppStore(s => s.activityLogs || [])

  const fmtTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return `${Math.floor(diff / 86400000)}d`
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'todo': return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--success)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>)
      case 'memory': return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--journal)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>)
      case 'health': return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--coral)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.8 1-1.1a5.5 5.5 0 000-7.8z" />
        </svg>)
      case 'music': return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--amber)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>)
      case 'chat': return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--accent)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>)
      case 'settings': return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>)
      default: return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>)
    }
  }

  return (
    <Card className="home-dashboard-card home-dashboard-activity">
      <div className="sec-hdr">
        <span className="sec-title">{t('system.activityTitle')}</span>
        {activityLogs.length > 0 && (
          <button
            type="button"
            className="system-activity-more"
            onClick={() => navigate('/chat/system')}
          >
            {t('system.viewAll')}
          </button>
        )}
      </div>
      {activityLogs.length === 0 ? (
        <div className="system-activity-idle">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{
            width: 28, height: 28, stroke: 'var(--text-3)', fill: 'none',
            strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
            opacity: 0.35,
          }}>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
          <span>{t('system.idle')}</span>
        </div>
      ) : (
        <div className="system-activity-list">
          {activityLogs.slice(0, 3).map((log) => (
            <div
              key={log.id}
              className={`system-activity-item ${log.read ? '' : 'system-activity-item--unread'}`}
              onClick={() => log.route && navigate(log.route)}
              style={{ cursor: log.route ? 'pointer' : undefined }}
            >
              <span className="system-activity-item-icon">{typeIcon(log.type)}</span>
              <span className="system-activity-item-text">{log.title}</span>
              <span className="system-activity-item-time">{fmtTime(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
