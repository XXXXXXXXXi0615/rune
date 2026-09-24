import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useCanonicalCheckInStreak } from '@/features/moon-dew/canonicalCheckInStreak';
import { getMoonDewProgression, MOON_DEW_LEVELS } from '@/features/moon-dew/getMoonDewProgression';
// Phase D: the retired ledger page used to be the only Home-route importer of the
// --ledger-* tokens; the growth surface owns that import now.
import '@/styles/tide-ledger-tokens.css';
import './moondew.css';

/**
 * 潮階 progression — Moon Dew presentation rehomed into the Home 報備 growth
 * surface (Phase D). Data sources are unchanged: `moonDewLedger` for totals and
 * the canonical check-in streak via the Phase A adapter.
 */
export function MoonDewProgress() {
  const moonDewLedger = useAppStore((s) => s.moonDewLedger || []);
  const focusSessions = useAppStore((s) => s.focusSessionLog || []);
  const checkInStreak = useCanonicalCheckInStreak();

  const progression = useMemo(
    () => getMoonDewProgression(moonDewLedger, focusSessions, checkInStreak),
    [moonDewLedger, focusSessions, checkInStreak],
  );

  return (
    <div className="moon-dew-progress-page" data-testid="moondew-tide-stages">
      {MOON_DEW_LEVELS.map((lvl) => {
        const achieved = progression.lifetimeEarned >= lvl.start;
        const isCurrent = progression.level === lvl.level;
        const prev = MOON_DEW_LEVELS.find((l) => l.level === lvl.level - 1);
        const range = prev ? lvl.start - prev.start : lvl.start;
        const currentInRange = prev ? progression.lifetimeEarned - prev.start : progression.lifetimeEarned;
        const localProgress = isCurrent
          ? Math.min(1, currentInRange / range)
          : achieved ? 1 : 0;

        return (
          <div
            key={lvl.level}
            className={`moon-dew-level-card${achieved ? ' is-achieved' : ''}${isCurrent ? ' is-current' : ''}`}
          >
            <div className="moon-dew-level-card__header">
              <span className="moon-dew-level-card__badge">
                {achieved ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isCurrent ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                )}
              </span>
              <span className="moon-dew-level-card__title">
                Lv{lvl.level} · {lvl.title}
              </span>
              <span className="moon-dew-level-card__start">{lvl.start}</span>
            </div>
            <div className="moon-dew-progress-bar">
              <div
                className={`moon-dew-progress-bar__fill${achieved && !isCurrent ? ' is-done' : ''}`}
                style={{ width: `${localProgress * 100}%` }}
              />
            </div>
            <div className="moon-dew-level-card__status">
              {isCurrent && '當前潮階'}
              {achieved && !isCurrent && '已達到'}
              {!achieved && `還差 ${lvl.start - progression.lifetimeEarned}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
