import { useEffect, useMemo } from 'react';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useTideboundDraftStore } from '@/store/useTideboundDraftStore';
import { selectActiveMainline, useTideRailStore } from '@/store/useTideRailStore';
import '@/components/focus/TideboundOrb.css';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';

const DURATIONS = [15, 25, 40, 60];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatTime = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

/**
 * Canonical pet-safe contract for the TIDEBOUND quick panel.
 *
 * The quick panel is a shell-portaled sheet (`MobileShellOverlay` → `#app`), so
 * the reserved-region resolver cannot discover it through either of its generic
 * paths: `#app main :is(button, a[href], [role="button"])` (wrong subtree) or
 * `[role="dialog"][aria-modal="true"]` (this sheet did not declare itself modal).
 * Declaring the surface and each interactive control as a pet-safe region is what
 * keeps the companion pet from covering a control the user
 * must click.
 *
 * The surface declaration documents ownership; the per-control declarations are
 * the actionable constraints for companion placement.
 */
const PET_SAFE_INTERACTIVE = { 'data-pet-safe-region': 'interactive' } as const;

/**
 * The quick panel IS a modal sheet: `MobileShellOverlay` already makes the
 * workspace `inert` + `aria-hidden` while it is open, and every sibling shell
 * sheet declares the same (`rune-utility-sheet`, `calendar-canvas-workspace`,
 * the stash boards). Declaring it is what lets the resolver treat the sheet as
 * the interaction owner — background controls stop being collision constraints.
 */
const MODAL_SHEET_SEMANTICS = { role: 'dialog', 'aria-modal': 'true' } as const;

/** Global TIDEBOUND entry and quick controls. useFocusSessionStore remains the sole timer owner. */
export function FocusIsland() {
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
  const isOpen = islandState === 'expanded';
  const isActive = session.status === 'running' || session.status === 'paused';
  const isBreak = isActive && session.phase === 'break';
  const isPaused = session.status === 'paused';

  const statusLabel = useMemo(() => {
    if (session.lastSettlement && session.status === 'idle') return 'TIDEBOUND · 已完成';
    if (isBreak) return 'TIDEBOUND · 休息';
    if (isPaused) return 'TIDEBOUND · 已暫停';
    if (isActive) return 'TIDEBOUND · 專注中';
    return 'TIDEBOUND · 開始這一輪';
  }, [isActive, isBreak, isPaused, session.lastSettlement, session.status]);

  const closePanel = () => {
    showCompact();
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="route-focus-status"]')?.focus());
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
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
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

  return (
    <div className="tidebound-quick" data-open={isOpen || undefined} data-testid="tidebound-host">
      {isOpen && (
        <MobileShellOverlay onClose={closePanel} variant="sheet">
        <section className="tidebound-quick-panel" {...MODAL_SHEET_SEMANTICS} aria-label="TIDEBOUND 快捷面板" data-testid="tidebound-quick-panel" {...PET_SAFE_INTERACTIVE}>
          <header>
            <div><small>TIDEBOUND</small><h2>{statusLabel.replace('TIDEBOUND · ', '')}</h2></div>
            <button type="button" {...PET_SAFE_INTERACTIVE} onClick={closePanel} aria-label="關閉 TIDEBOUND 快捷面板">×</button>
          </header>

          {!isActive ? (
            <div className="tidebound-quick-panel__body" data-testid="tidebound-idle-controls">
              <label>任務<input {...PET_SAFE_INTERACTIVE} value={draft.task} onChange={(event) => setDraft({ task: event.target.value })} placeholder={mainline?.title || '這一輪要完成什麼？'} /></label>
              <div className="tidebound-quick-stepper"><span>專注時間</span><div><button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => setDraft({ durationMinutes: clamp(draft.durationMinutes - 5, 5, 120) })}>−</button><strong>{draft.durationMinutes} 分</strong><button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => setDraft({ durationMinutes: clamp(draft.durationMinutes + 5, 5, 120) })}>+</button></div></div>
              <div className="tidebound-quick-presets" aria-label="快捷專注時間">{DURATIONS.map((minutes) => <button key={minutes} type="button" {...PET_SAFE_INTERACTIVE} className={draft.durationMinutes === minutes ? 'is-active' : ''} onClick={() => setDraft({ durationMinutes: minutes })}>{minutes}</button>)}</div>
              <div className="tidebound-quick-grid">
                <div><span>休息</span><div><button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => setDraft({ breakMinutes: clamp(draft.breakMinutes - 1, 1, 60) })}>−</button><strong>{draft.breakMinutes} 分</strong><button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => setDraft({ breakMinutes: clamp(draft.breakMinutes + 1, 1, 60) })}>+</button></div></div>
                <div><span>輪數</span><div><button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => setDraft({ rounds: clamp(draft.rounds - 1, 1, 12) })}>−</button><strong>{draft.rounds}</strong><button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => setDraft({ rounds: clamp(draft.rounds + 1, 1, 12) })}>+</button></div></div>
              </div>
              <button type="button" {...PET_SAFE_INTERACTIVE} className="tidebound-quick-primary" onClick={handleStart}>開始這一輪</button>
            </div>
          ) : (
            <div className="tidebound-quick-panel__body tidebound-quick-active" data-phase={session.phase}>
              <span className="tidebound-quick-task">{session.task || '未命名任務'}</span>
              <strong className="tidebound-quick-time">{formatTime(session.remainingSeconds)}</strong>
              {!isBreak && <small>第 {session.currentRound} / {session.rounds} 輪</small>}
              <div className="tidebound-quick-actions">
                {isBreak ? <button type="button" {...PET_SAFE_INTERACTIVE} onClick={transitionPhase}>跳過休息</button> : isPaused ? <button type="button" {...PET_SAFE_INTERACTIVE} onClick={resumeSession}>恢復</button> : <button type="button" {...PET_SAFE_INTERACTIVE} onClick={pauseSession}>暫停</button>}
                {!isBreak && <button type="button" {...PET_SAFE_INTERACTIVE} className="is-danger" onClick={endSession}>結束這一輪</button>}
              </div>
            </div>
          )}

          <footer>
            <button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => openFullWindow(false)}>完整設定</button>
            <button type="button" {...PET_SAFE_INTERACTIVE} onClick={() => openFullWindow(true)}>專注統計</button>
          </footer>
        </section>
        </MobileShellOverlay>
      )}
    </div>
  );
}
