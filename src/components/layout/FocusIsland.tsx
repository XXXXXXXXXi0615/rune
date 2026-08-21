import { useEffect, useMemo, useRef } from 'react';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useTideboundDraftStore } from '@/store/useTideboundDraftStore';
import { selectActiveMainline, useTideRailStore } from '@/store/useTideRailStore';
import '@/components/focus/TideboundOrb.css';

const DURATIONS = [15, 25, 40, 60];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatTime = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

interface FocusIslandProps {
  /** When true, omit the idle orb button (Home CTA is the sole idle entry). */
  hideIdleOrb?: boolean;
}

/** Global TIDEBOUND entry and quick controls. useFocusSessionStore remains the sole timer owner. */
export function FocusIsland({ hideIdleOrb = false }: FocusIslandProps) {
  const islandState = useFocusIslandStore((state) => state.state);
  const showCompact = useFocusIslandStore((state) => state.showCompact);
  const showExpanded = useFocusIslandStore((state) => state.showExpanded);
  const showWindow = useFocusIslandStore((state) => state.showWindow);
  const session = useFocusSessionStore((state) => state);
  const startSession = useFocusSessionStore((state) => state.startSession);
  const pauseSession = useFocusSessionStore((state) => state.pauseSession);
  const resumeSession = useFocusSessionStore((state) => state.resumeSession);
  const endSession = useFocusSessionStore((state) => state.endSession);
  const transitionPhase = useFocusSessionStore((state) => state.transitionPhase);
  const draft = useTideboundDraftStore((state) => state);
  const setDraft = useTideboundDraftStore((state) => state.setDraft);
  const mainline = useTideRailStore(selectActiveMainline);
  const hostRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const isOpen = islandState === 'expanded';
  const isActive = session.status === 'running' || session.status === 'paused';
  const isBreak = isActive && session.phase === 'break';
  const isPaused = session.status === 'paused';

  const totalSeconds = (isBreak ? session.restMinutes : session.durationMinutes) * 60;
  const progress = totalSeconds > 0 ? clamp(1 - session.remainingSeconds / totalSeconds, 0, 1) : 0;
  const circumference = 2 * Math.PI * 19;
  const dashOffset = circumference * (1 - progress);

  const statusLabel = useMemo(() => {
    if (session.lastSettlement && session.status === 'idle') return 'TIDEBOUND · 已完成';
    if (isBreak) return 'TIDEBOUND · 休息';
    if (isPaused) return 'TIDEBOUND · 已暫停';
    if (isActive) return 'TIDEBOUND · 專注中';
    return 'TIDEBOUND · 開始這一輪';
  }, [isActive, isBreak, isPaused, session.lastSettlement, session.status]);

  const closePanel = () => {
    showCompact();
    requestAnimationFrame(() => orbRef.current?.focus());
  };

  const openQuickPanel = (task?: string) => {
    if (!isActive && !draft.task.trim()) setDraft({ task: task?.trim() || mainline?.title || '' });
    showExpanded();
  };

  useEffect(() => {
    const onOpen = (event: Event) => openQuickPanel((event as CustomEvent<{ task?: string }>).detail?.task);
    window.addEventListener('tidebound:open-quick', onOpen);
    return () => window.removeEventListener('tidebound:open-quick', onOpen);
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
      }
    };
    const onOutside = (event: PointerEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) closePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [isOpen]);

  const handleStart = () => {
    startSession({
      durationMinutes: clamp(draft.durationMinutes, 5, 120),
      restMinutes: clamp(draft.breakMinutes, 1, 60),
      rounds: clamp(draft.rounds, 1, 12),
      task: draft.task.trim() || mainline?.title,
      loopMode: draft.loopMode,
      category: 'focus',
      roomType: draft.selectedRoom,
    });
  };

  const openFullWindow = (statistics = false) => {
    showWindow();
    useFocusWindowStore.getState().openWindow();
    if (statistics) requestAnimationFrame(() => window.dispatchEvent(new Event('tidebound:open-statistics')));
  };

  if (islandState === 'hidden' || islandState === 'window') return null;

  const orbHidden = hideIdleOrb && !isActive;

  return (
    <div className="tidebound-quick" ref={hostRef} data-open={isOpen || undefined} data-testid="tidebound-host">
      {!orbHidden && (
        <button
          ref={orbRef}
          type="button"
          className={`tidebound-orb${isActive ? ' is-active' : ''}${isPaused ? ' is-paused' : ''}${isBreak ? ' is-break' : ''}${session.lastSettlement && session.status === 'idle' ? ' is-settled' : ''}`}
          onClick={() => openQuickPanel()}
          aria-label={isOpen ? 'TIDEBOUND 快捷面板已開啟' : `開啟 ${statusLabel}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          data-testid="tidebound-orb"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle className="tidebound-orb__track" cx="24" cy="24" r="19" />
            <circle className="tidebound-orb__progress" cx="24" cy="24" r="19" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
            <path className="tidebound-orb__mark" d="M28.8 13.4a12.2 12.2 0 1 0 6.3 21.4 10.7 10.7 0 1 1-6.3-21.4Z" />
            <path className="tidebound-orb__line" d="M24 17.5V24l4.4 2.6" />
          </svg>
        </button>
      )}

      {isOpen && (
        <section className="tidebound-quick-panel" role="dialog" aria-label="TIDEBOUND 快捷面板" data-testid="tidebound-quick-panel">
          <header>
            <div><small>TIDEBOUND</small><h2>{statusLabel.replace('TIDEBOUND · ', '')}</h2></div>
            <button type="button" onClick={closePanel} aria-label="關閉 TIDEBOUND 快捷面板">×</button>
          </header>

          {!isActive ? (
            <div className="tidebound-quick-panel__body" data-testid="tidebound-idle-controls">
              <label>任務<input value={draft.task} onChange={(event) => setDraft({ task: event.target.value })} placeholder={mainline?.title || '這一輪要完成什麼？'} /></label>
              <div className="tidebound-quick-stepper"><span>專注時間</span><div><button type="button" onClick={() => setDraft({ durationMinutes: clamp(draft.durationMinutes - 5, 5, 120) })}>−</button><strong>{draft.durationMinutes} 分</strong><button type="button" onClick={() => setDraft({ durationMinutes: clamp(draft.durationMinutes + 5, 5, 120) })}>+</button></div></div>
              <div className="tidebound-quick-presets" aria-label="快捷專注時間">{DURATIONS.map((minutes) => <button key={minutes} type="button" className={draft.durationMinutes === minutes ? 'is-active' : ''} onClick={() => setDraft({ durationMinutes: minutes })}>{minutes}</button>)}</div>
              <div className="tidebound-quick-grid">
                <div><span>休息</span><div><button type="button" onClick={() => setDraft({ breakMinutes: clamp(draft.breakMinutes - 1, 1, 60) })}>−</button><strong>{draft.breakMinutes} 分</strong><button type="button" onClick={() => setDraft({ breakMinutes: clamp(draft.breakMinutes + 1, 1, 60) })}>+</button></div></div>
                <div><span>輪數</span><div><button type="button" onClick={() => setDraft({ rounds: clamp(draft.rounds - 1, 1, 12) })}>−</button><strong>{draft.rounds}</strong><button type="button" onClick={() => setDraft({ rounds: clamp(draft.rounds + 1, 1, 12) })}>+</button></div></div>
              </div>
              <button type="button" className="tidebound-quick-primary" onClick={handleStart}>開始這一輪</button>
            </div>
          ) : (
            <div className="tidebound-quick-panel__body tidebound-quick-active" data-phase={session.phase}>
              <span className="tidebound-quick-task">{session.task || '未命名任務'}</span>
              <strong className="tidebound-quick-time">{formatTime(session.remainingSeconds)}</strong>
              {!isBreak && <small>第 {session.currentRound} / {session.rounds} 輪</small>}
              <div className="tidebound-quick-actions">
                {isBreak ? <button type="button" onClick={transitionPhase}>跳過休息</button> : isPaused ? <button type="button" onClick={resumeSession}>恢復</button> : <button type="button" onClick={pauseSession}>暫停</button>}
                {!isBreak && <button type="button" className="is-danger" onClick={endSession}>結束這一輪</button>}
              </div>
            </div>
          )}

          <footer>
            <button type="button" onClick={() => openFullWindow(false)}>完整設定</button>
            <button type="button" onClick={() => openFullWindow(true)}>專注統計</button>
          </footer>
        </section>
      )}
    </div>
  );
}
