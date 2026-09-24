import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useCanonicalCheckInStreak } from '@/features/moon-dew/canonicalCheckInStreak';
import { getMoonDewProgression } from '@/features/moon-dew/getMoonDewProgression';
// Phase D: the retired ledger page used to be the only Home-route importer of the
// --ledger-* tokens; the growth surface owns that import now.
import '@/styles/tide-ledger-tokens.css';
import './moondew.css';

type AchievementId =
  | 'first_checkin'
  | 'first_focus'
  | 'checkin_streak_7'
  | 'focus_streak_7'
  | 'moon_dew_100'
  | 'focus_50_sessions'
  | 'good_recovery'
  | 'focus_60_minutes';

interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  icon: () => React.ReactNode;
  compute: (p: ReturnType<typeof getMoonDewProgression>, ledger: import('@/types').MoonDewLedgerEntry[], focusSessions: import('@/types').FocusSessionEntry[]) => {
    unlocked: boolean;
    current: number;
    target: number;
  };
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_checkin',
    title: '初次報備',
    description: '完成第一次月潮報備',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
    compute: (p) => {
      const unlocked = p.checkInStreak >= 1 || p.lifetimeEarned > 0;
      return { unlocked, current: unlocked ? 1 : 0, target: 1 };
    },
  },
  {
    id: 'first_focus',
    title: '首次守約',
    description: '完成一輪專注',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
    ),
    compute: (p) => {
      const unlocked = p.focusStreak >= 1 || !!p.latestFocus;
      return { unlocked, current: unlocked ? 1 : 0, target: 1 };
    },
  },
  {
    id: 'checkin_streak_7',
    title: '連續報備 7 天',
    description: '連續 7 天完成報備',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 3-2 4-2 7a4 4 0 0 0 8 0c0-3-2-4-2-7-2 1-4 3-4 5 0-2-2-4-2-5z" />
      </svg>
    ),
    compute: (p) => ({ unlocked: p.checkInStreak >= 7, current: p.checkInStreak, target: 7 }),
  },
  {
    id: 'focus_streak_7',
    title: '連續守約 7 天',
    description: '連續 7 天完成專注',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /><path d="M2 18h20" />
      </svg>
    ),
    compute: (p) => ({ unlocked: p.focusStreak >= 7, current: p.focusStreak, target: 7 }),
  },
  {
    id: 'moon_dew_100',
    title: '累計獲得 100 月印',
    description: '一生累計獲得 100 月印',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /><circle cx="12" cy="14" r="3" />
      </svg>
    ),
    compute: (p) => ({ unlocked: p.lifetimeEarned >= 100, current: p.lifetimeEarned, target: 100 }),
  },
  {
    id: 'focus_50_sessions',
    title: '完成 50 輪專注',
    description: '一生累計 50 輪完成',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /><path d="M2 18h20" />
      </svg>
    ),
    compute: (_p, _ledger, fs) => {
      const completed = fs.filter((s) => s.status === 'completed').length;
      return { unlocked: completed >= 50, current: completed, target: 50 };
    },
  },
  {
    id: 'good_recovery',
    title: '暫停後仍守約',
    description: '完成一次 goodRecovery',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 1 9 9" /><polyline points="3 12 6 12 6 9" />
      </svg>
    ),
    compute: (_p, ledger) => {
      const has = ledger.some((e) => e.reasonCode === 'focus:good_recovery');
      return { unlocked: has, current: has ? 1 : 0, target: 1 };
    },
  },
  {
    id: 'focus_60_minutes',
    title: '單輪專注 60 分鐘',
    description: '單輪實際專注滿 60 分鐘',
    icon: () => (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" />
      </svg>
    ),
    compute: (_p, _ledger, fs) => {
      const maxMinutes = fs.reduce((max, s) => Math.max(max, s.actualFocusMinutes || 0), 0);
      return { unlocked: maxMinutes >= 60, current: maxMinutes, target: 60 };
    },
  },
];

/**
 * 成就 — Moon Dew presentation rehomed into the Home 報備 growth surface (Phase D).
 * Progress stays derived (ledger + focus log + canonical streak); nothing is persisted.
 */
export function MoonDewAchievements() {
  const moonDewLedger = useAppStore((s) => s.moonDewLedger || []);
  const focusSessions = useAppStore((s) => s.focusSessionLog || []);
  const checkInStreak = useCanonicalCheckInStreak();

  const progression = useMemo(
    () => getMoonDewProgression(moonDewLedger, focusSessions, checkInStreak),
    [moonDewLedger, focusSessions, checkInStreak],
  );

  return (
    <div className="moon-dew-achievements" data-testid="moondew-achievements">
      {ACHIEVEMENTS.map((ach) => {
        const result = ach.compute(progression, moonDewLedger, focusSessions);
        return (
          <div
            key={ach.id}
            className={`moon-dew-achievement-card${result.unlocked ? ' is-unlocked' : ''}`}
          >
            <div className="moon-dew-achievement-card__icon">
              {ach.icon()}
            </div>
            <div className="moon-dew-achievement-card__info">
              <span className="moon-dew-achievement-card__title">{ach.title}</span>
              <span className="moon-dew-achievement-card__desc">{ach.description}</span>
              <div className="moon-dew-achievement-card__progress">
                <div className="moon-dew-progress-bar">
                  <div
                    className={`moon-dew-progress-bar__fill${result.unlocked ? ' is-done' : ''}`}
                    style={{ width: `${Math.min(100, (result.current / result.target) * 100)}%` }}
                  />
                </div>
                <span className="moon-dew-achievement-card__count">
                  {result.current}/{result.target}
                </span>
              </div>
            </div>
            <div className="moon-dew-achievement-card__badge">
              {result.unlocked ? (
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
