import { useCallback, useEffect, useRef, useState } from 'react';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useQuestStore } from '@/store/useQuestStore';
import { toLocalDateString } from '@/utils/date';
import { TideClockIcon } from '@/components/tideclock/TideClockIcon';

type WidgetPhase = 'idle' | 'stamping' | 'done';

export function DailyTideWidget({ onOpen }: { onOpen: () => void }) {
  const [phase, setPhase] = useState<WidgetPhase>('idle');
  const [stampVisible, setStampVisible] = useState(false);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSubmittedRef = useRef(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clockIn = useCheckInStore((s) => s.clockIn);
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getCurrentPerfectStreak = useCheckInStore((s) => s.getCurrentPerfectStreak);
  const policy = useCheckInStore((s) => s.policy);

  const todayRecord = getTodayStatus();
  const isDone = !!todayRecord;
  const streak = getCurrentPerfectStreak();
  const today = toLocalDateString();

  const quests = useQuestStore((s) => s.quests);
  const mainQuestByDate = useQuestStore((s) => s.mainQuestByDate);
  const mainQuest = quests.find((q) => q.id === mainQuestByDate[today]);

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  const doClockIn = useCallback(() => {
    if (phase !== 'idle' || isDone || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    if (prefersReducedMotion) {
      const report =
        policy.mode === 'report'
          ? { sleepOk: true, mainTask: mainQuest?.title || '日常安排', curfewNote: '' }
          : undefined;
      clockIn(report);
      setPhase('done');
      setStampVisible(true);
      return;
    }

    setPhase('stamping');
    setStampVisible(true);

    phaseTimerRef.current = setTimeout(() => {
      const report =
        policy.mode === 'report'
          ? { sleepOk: true, mainTask: mainQuest?.title || '日常安排', curfewNote: '' }
          : undefined;
      clockIn(report);
      setPhase('done');
    }, 400);

    phaseTimerRef.current = setTimeout(() => {
      setStampVisible(false);
    }, 1800);
  }, [phase, isDone, clockIn, policy, mainQuest, prefersReducedMotion]);

  const handlePunch = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    doClockIn();
  };

  const handleCardClick = () => {
    if (phase === 'idle' && !isDone) {
      doClockIn();
    } else {
      onOpen();
    }
  };

  const timeStr = todayRecord?.clockInAt
    ? (() => {
        const d = new Date(todayRecord.clockInAt);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })()
    : null;

  const dateDisplay = (() => {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${m}月${day}日 週${weekdays[d.getDay()]}`;
  })();

  return (
    <div
      className={`dt-widget${phase === 'stamping' ? ' dt-widget--stamping' : ''}${isDone ? ' dt-widget--done' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={isDone ? '今日已打卡，點擊查看詳情' : '今日尚未打卡，點擊打卡'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="dt-widget-inner">
        <div className="dt-widget-top">
          <div className="dt-widget-date">{dateDisplay}</div>
          <div className="dt-widget-machine">
            <TideClockIcon size={40} />
            {isDone && <div className="dt-machine-lit" aria-hidden="true" />}
          </div>
        </div>

        <div className="dt-widget-body">
          {isDone ? (
            <div className="dt-widget-status dt-widget-status--done">
              <span className="dt-status-label">今日已打卡</span>
              <span className="dt-status-time">{timeStr}</span>
              <span className="dt-status-streak">連續第 {Math.max(streak, 1)} 天</span>
            </div>
          ) : (
            <div className="dt-widget-status dt-widget-status--pending">
              <span className="dt-status-label">今日尚未打卡</span>
              <span className="dt-status-streak">
                {streak > 0 ? `連續 ${streak} 天` : '尚無連續記錄'}
              </span>
            </div>
          )}

          <div className="dt-widget-reward">
            {isDone ? (
              <>
                {todayRecord?.moonDewAwarded != null && todayRecord.moonDewAwarded > 0 && (
                  <span className="dt-reward-item">
                    +{todayRecord.moonDewAwarded} Moon Dew
                  </span>
                )}
                {todayRecord?.isLate && (
                  <span className="dt-reward-item dt-reward-item--late">遲到</span>
                )}
              </>
            ) : (
              <div className="dt-widget-cta-row">
                <button
                  type="button"
                  className="dt-cta-button"
                  onClick={handlePunch}
                  onPointerDown={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                  }}
                  onPointerLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                  }}
                  disabled={phase !== 'idle'}
                >
                  刷卡簽到
                </button>
              </div>
            )}
          </div>
        </div>

        {stampVisible && (
          <div className={`dt-stamp-strip${prefersReducedMotion ? ' dt-no-anim' : ''}`} aria-hidden="true">
            <div className="dt-stamp-strip-inner">
              <div className="dt-stamp-head">
                <svg viewBox="0 0 56 28" width="56" height="28" fill="none">
                  <rect x="2" y="2" width="52" height="24" rx="5" stroke="var(--teal)" strokeWidth="1.5" />
                  <text x="28" y="13" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--teal)">已打卡</text>
                  <text x="28" y="23" textAnchor="middle" fontSize="6" fill="var(--text-3)">{today}</text>
                </svg>
              </div>
              <span className="dt-stamp-time">{timeStr || ''}</span>
              <span className="dt-stamp-streak">{Math.max(streak, 1)} 天連續</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
