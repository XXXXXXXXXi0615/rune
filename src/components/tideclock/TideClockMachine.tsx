import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { TideClockTicket } from './TideClockTicket';
import { TideClockIcon } from './TideClockIcon';
import { toLocalDateString } from '@/utils/date';
import { calculatePerfectStreak, getMonthlyAttendance } from '@/features/tideclock/tideclockEngine';
import { useQuestStore } from '@/store/useQuestStore';

interface TideClockMachineProps {
  open: boolean;
  onClose: () => void;
}

type MachinePhase = 'idle' | 'swiping' | 'stamping' | 'done';

export function TideClockMachine({ open, onClose }: TideClockMachineProps) {
  const [phase, setPhase] = useState<MachinePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clockIn = useCheckInStore((s) => s.clockIn);
  const policy = useCheckInStore((s) => s.policy);
  const records = useCheckInStore((s) => s.records);
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getCurrentPerfectStreak = useCheckInStore((s) => s.getCurrentPerfectStreak);
  const getMonthlyAttendanceFn = useCheckInStore((s) => s.getMonthlyAttendance);
  const dismissedTodayDate = useCheckInStore((s) => s.dismissedTodayDate);
  const dismissToday = useCheckInStore((s) => s.dismissToday);

  const quests = useQuestStore((s) => s.quests);
  const mainQuestByDate = useQuestStore((s) => s.mainQuestByDate);
  const today = toLocalDateString();
  const mainQuest = quests.find((q) => q.id === mainQuestByDate[today]);

  const todayRecord = getTodayStatus();
  const alreadyDone = !!todayRecord;
  const streak = getCurrentPerfectStreak();
  const monthly = getMonthlyAttendanceFn();
  const monthlyCount = Object.values(monthly).filter((s) => s === 'completed' || s === 'late').length;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const resetPhase = useCallback(() => {
    setPhase('idle');
    setDragY(0);
    setIsDragging(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) resetPhase();
  }, [open, resetPhase]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Enter' || e.key === ' ') && phase === 'idle' && !alreadyDone) {
        e.preventDefault();
        handlePunch();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, phase, alreadyDone]);

  const handlePunch = useCallback(() => {
    if (phase !== 'idle' || alreadyDone) return;
    setPhase('swiping');

    const duration = prefersReducedMotion ? 0 : 400;
    setTimeout(() => {
      setPhase('stamping');
      setTimeout(() => {
        const report = policy.mode === 'report' ? {
          sleepOk: true,
          mainTask: mainQuest?.title || '日常安排',
          curfewNote: '',
        } : undefined;

        const result = clockIn(report);
        if (!result) {
          setError('打卡失敗，請重試');
          setPhase('idle');
          return;
        }
        setPhase('done');
      }, prefersReducedMotion ? 0 : 300);
    }, duration);
  }, [phase, alreadyDone, clockIn, policy, mainQuest, prefersReducedMotion]);

  const handleDragStart = useCallback((clientY: number) => {
    if (phase !== 'idle' || alreadyDone) return;
    dragStartRef.current = clientY;
    setIsDragging(true);
  }, [phase, alreadyDone]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartRef.current;
    setDragY(Math.max(0, Math.min(delta, 120)));
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 80) {
      handlePunch();
    } else {
      setDragY(0);
    }
  }, [isDragging, dragY, handlePunch]);

  const onPointerDown = (e: React.PointerEvent) => {
    handleDragStart(e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    handleDragMove(e.clientY);
  };

  const onPointerUp = () => {
    handleDragEnd();
  };

  if (!open) return null;

  const content = (
    <div className="tc-overlay" onClick={onClose}>
      <div
        className="tc-machine"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="月潮打卡機"
        aria-modal="true"
      >
        <div className="tc-machine-header">
          <TideClockIcon size={20} />
          <span className="tc-machine-title">月潮打卡機</span>
          <button type="button" className="tc-machine-close" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="tc-machine-body">
          {alreadyDone ? (
            <div className="tc-machine-done">
              <p className="tc-machine-done-text">今日已完成打卡</p>
              <TideClockTicket
                record={todayRecord!}
                streak={streak}
                monthlyCount={monthlyCount}
                monthlyTotal={daysInMonth}
                mainTask={mainQuest?.title}
              />
              <div className="tc-machine-done-stats">
                <span>連續 <strong>{streak}</strong> 天</span>
                <span>本月 <strong>{monthlyCount}</strong> / {daysInMonth}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="tc-machine-slot">
                <div className="tc-machine-slot-label">卡片插入處</div>
                <div
                  ref={cardRef}
                  className={`tc-machine-card ${phase === 'swiping' ? 'tc-machine-card--swiping' : ''} ${isDragging ? 'tc-machine-card--dragging' : ''}`}
                  style={{ transform: `translateY(${isDragging ? dragY : phase === 'swiping' ? 120 : 0}px)` }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  tabIndex={0}
                  role="button"
                  aria-label="向下拖動打卡"
                >
                  <div className="tc-machine-card-face">
                    <TideClockIcon size={32} />
                    <span>TIDECLOCK</span>
                    <span className="tc-machine-card-hint">↓ 向下滑動</span>
                  </div>
                </div>
              </div>

              {phase === 'stamping' && (
                <div className={`tc-machine-stamp ${prefersReducedMotion ? '' : 'tc-machine-stamp--animate'}`}>
                  <svg viewBox="0 0 80 40" width="80" height="40" aria-label="打卡印章">
                    <rect x="2" y="2" width="76" height="36" rx="6" fill="none" stroke="var(--teal, #6bb5a0)" strokeWidth="2" />
                    <text x="40" y="18" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--teal, #6bb5a0)" fontFamily="var(--f-ui, sans-serif)">已打卡</text>
                    <text x="40" y="30" textAnchor="middle" fontSize="7" fill="var(--text-3, #888)" fontFamily="var(--f-ui, sans-serif)">{today}</text>
                  </svg>
                </div>
              )}

              {phase === 'done' && todayRecord && (
                <div className="tc-machine-receipt">
                  <TideClockTicket
                    record={todayRecord}
                    streak={streak}
                    monthlyCount={monthlyCount}
                    monthlyTotal={daysInMonth}
                    mainTask={mainQuest?.title}
                  />
                </div>
              )}

              {error && (
                <div className="tc-machine-error" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => { setError(null); handlePunch(); }}>重試</button>
                </div>
              )}

              {phase === 'idle' && (
                <button
                  type="button"
                  className="tc-machine-punch-btn"
                  onClick={handlePunch}
                  disabled={alreadyDone}
                >
                  打卡
                </button>
              )}
            </>
          )}
        </div>

        {phase === 'done' && (
          <div className="tc-machine-footer">
            <button type="button" className="tc-machine-dismiss" onClick={() => { dismissToday(); onClose(); }}>
              收起
            </button>
            <button type="button" className="tc-machine-view-records" onClick={onClose}>
              查看紀錄
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
