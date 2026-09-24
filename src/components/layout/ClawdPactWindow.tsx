import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useAppStore } from '@/store/useAppStore';
import { useTideboundDraftStore } from '@/store/useTideboundDraftStore';
import { useQuestStore } from '@/store/useQuestStore';
import { selectActiveMainline, useTideRailStore } from '@/store/useTideRailStore';
import { toLocalDateString } from '@/utils/date';
import { FocusSettlement } from '@/components/layout/FocusSettlement';
import { FocusStatisticsView } from '@/components/focus/FocusStatisticsView';
import { FocusRoomPanel } from '@/components/focus/FocusRoomPanel';
import { getFocusRoom } from '@/components/focus/FocusRoomScene';
import '@/styles/moon-focus.css';
import '@/components/focus/tidebound.css';
import '@/components/focus/focus-statistics.css';

/* ── Tidebound unified view state ── */
export type TideboundView = 'setup' | 'active' | 'paused' | 'break' | 'settlement' | 'statistics' | 'room';

type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_EDGES: ResizeEdge[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'];
const MIN_W = 360;
const MIN_H = 440;
const MAX_W = 560;
const MAX_H = 720;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(min, value), max);
}

function getResizeBounds() {
  const maxWidth = Math.min(MAX_W, window.innerWidth * 0.9);
  const maxHeight = Math.min(MAX_H, window.innerHeight * 0.9);
  return {
    minWidth: Math.min(MIN_W, maxWidth),
    minHeight: Math.min(MIN_H, maxHeight),
    maxWidth,
    maxHeight,
  };
}

function clampRounds(n: number): number {
  return Math.max(1, Math.min(12, Number.isFinite(n) ? Math.round(n) : 1));
}

export function ClawdPactWindow() {
  const win = useFocusWindowStore();
  const session = useFocusSessionStore((s) => s);
  const startSession = useFocusSessionStore((s) => s.startSession);
  const pauseSession = useFocusSessionStore((s) => s.pauseSession);
  const resumeSession = useFocusSessionStore((s) => s.resumeSession);
  const endSession = useFocusSessionStore((s) => s.endSession);
  const dismissSettlement = useFocusSessionStore((s) => s.dismissSettlement);
  const recoverSettlement = useFocusSessionStore((s) => s.recoverSettlement);
  const updateFocusConfig = useAppStore((s) => s.updateFocusConfig);

  /* ── Shared draft store ── */
  const draft = useTideboundDraftStore((s) => s);
  const setDraft = useTideboundDraftStore((s) => s.setDraft);
  const quests = useQuestStore((s) => s.quests);
  const mainQuestId = useQuestStore((s) => s.mainQuestByDate[toLocalDateString()]);
  const mainQuest = quests.find((quest) => quest.id === mainQuestId);
  const activeMainline = useTideRailStore(selectActiveMainline);
  const navigate = useNavigate();

  useEffect(() => {
    if (!draft.task.trim() && mainQuest?.title) setDraft({ task: mainQuest.title });
  }, [draft.task, mainQuest?.title, setDraft]);

  /* ── TideboundView — sole owner in ClawdPactWindow ── */
  const [tideboundView, setTideboundView] = useState<TideboundView | null>(null);

  useEffect(() => {
    const openStatistics = () => setTideboundView('statistics');
    const openRoom = () => setTideboundView('room');
    window.addEventListener('tidebound:open-statistics', openStatistics);
    window.addEventListener('tidebound:open-room', openRoom);
    return () => {
      window.removeEventListener('tidebound:open-statistics', openStatistics);
      window.removeEventListener('tidebound:open-room', openRoom);
    };
  }, []);

  const [showSelfReport, setShowSelfReport] = useState(false);
  const [pendingReport, setPendingReport] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  const isRunning = session.status === 'running';
  const isPaused = session.status === 'paused';
  const isActive = isRunning || isPaused;
  const isBreak = session.phase === 'break';

  /* ── Effective TideboundView ── */
  /*
   * Priority:
   * 1. Active session (running/paused) — dictated by session state
   * 2. User-navigated view (settlement/statistics/setup) — stored in tideboundView
   * 3. Default — lastSettlement exists ? 'settlement' : 'room'
   *
   * marker  = persisted flag: session was settled (idempotent, survives refresh)
   * lastSettlement = in-memory settlement data for display
   * tideboundView  = what page the user is looking at right now
   */
  const effectiveView: TideboundView = (() => {
    if (isRunning) return session.phase === 'break' ? 'break' : 'active';
    if (isPaused) return 'paused';
    if (tideboundView !== null) return tideboundView;
    if (session.lastSettlement) return 'settlement';
    return 'room';
  })();

  /* ── Detect session finalization → auto-show settlement ── */
  useEffect(() => {
    if (session.lastSettlement && session.status === 'idle') {
      setTideboundView('settlement');
    }
  }, [session.lastSettlement, session.status]);

  /* ── Detect new session start → reset user view ── */
  useEffect(() => {
    if (session.status === 'running' || session.status === 'paused') {
      setTideboundView(null);
    }
  }, [session.status, session.sessionId]);

  /* ── Settlement recovery ── */
  useEffect(() => {
    if (win.isOpen && session.status === 'idle' && !session.lastSettlement) {
      recoverSettlement();
    }
  }, [win.isOpen, session.status, session.lastSettlement, recoverSettlement]);

  /* ── Settlement / Statistics handlers ── */
  const handleSettlementClose = () => {
    /* Direct close — keep settlement data for next open */
    win.closeWindow();
  };

  const handleSettlementAgain = () => {
    dismissSettlement();
    setTideboundView('room');
  };

  const handleBackToSetup = () => {
    /* Navigate to setup — keep lastSettlement data, no re-finalize */
    setTideboundView('room');
  };

  const handleViewStatistics = () => {
    setTideboundView('statistics');
  };

  /* ── Close X: confirm for active sessions ── */
  const handleTitleClose = () => {
    if (effectiveView === 'active' || effectiveView === 'paused' || effectiveView === 'break') {
      setShowCloseConfirm(true);
    } else {
      /* settlement / statistics / setup — direct close, keep data */
      win.closeWindow();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    if (isActive) endSession();
    win.closeWindow();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  /* ── Self-report flow ── */
  const handleEnd = () => {
    setShowSelfReport(true);
    setPendingReport(null);
  };

  const handlePickReport = (report: string) => {
    setPendingReport(report);
  };

  const handleCancelReport = () => {
    setPendingReport(null);
  };

  const handleSubmitReport = () => {
    if (!pendingReport) return;
    useFocusSessionStore.setState({ selfReport: pendingReport });
    setShowSelfReport(false);
    setPendingReport(null);
    endSession();
  };

  const handleSkipReport = () => {
    setShowSelfReport(false);
    setPendingReport(null);
    endSession();
  };

  /* ── Drag ── */
  const dragRef = useRef<{ sx: number; sy: number; wx: number; wy: number } | null>(null);

  const onTitlePointerDown = useCallback((e: React.PointerEvent) => {
    if (win.isMaximized) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, wx: win.x, wy: win.y };
    const el = windowRef.current;
    if (el) el.setPointerCapture(e.pointerId);
  }, [win.isMaximized, win.x, win.y]);

  const onDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    win.setPosition(dragRef.current.wx + dx, dragRef.current.wy + dy);
  }, [win]);

  const onDragPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    const el = windowRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  /* ── Resize ── */
  const resizeRef = useRef<{ edge: ResizeEdge; sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);

  const onResizePointerDown = useCallback((edge: ResizeEdge) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (win.isMaximized) return;
    resizeRef.current = { edge, sx: e.clientX, sy: e.clientY, x: win.x, y: win.y, w: win.width, h: win.height };
    const el = windowRef.current;
    if (el) el.setPointerCapture(e.pointerId);
  }, [win.isMaximized, win.x, win.y, win.width, win.height]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    const state = resizeRef.current;
    if (!state) return;
    const dx = e.clientX - state.sx;
    const dy = e.clientY - state.sy;
    const bounds = getResizeBounds();

    let nextX = state.x;
    let nextY = state.y;
    let nextW = state.w;
    let nextH = state.h;

    if (state.edge.includes('e')) nextW = clamp(state.w + dx, bounds.minWidth, bounds.maxWidth);
    if (state.edge.includes('s')) nextH = clamp(state.h + dy, bounds.minHeight, bounds.maxHeight);
    if (state.edge.includes('w')) {
      const right = state.x + state.w;
      nextW = clamp(state.w - dx, bounds.minWidth, bounds.maxWidth);
      nextX = right - nextW;
    }
    if (state.edge.includes('n')) {
      const bottom = state.y + state.h;
      nextH = clamp(state.h - dy, bounds.minHeight, bounds.maxHeight);
      nextY = bottom - nextH;
    }

    win.setFrame(nextX, nextY, nextW, nextH);
  }, [win]);

  const onResizeUp = useCallback((e: React.PointerEvent) => {
    resizeRef.current = null;
    const el = windowRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  const onWindowPointerMove = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current) { onResizeMove(e); return; }
    if (dragRef.current) onDragPointerMove(e);
  }, [onDragPointerMove, onResizeMove]);

  const onWindowPointerUp = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current) { onResizeUp(e); return; }
    if (dragRef.current) onDragPointerUp(e);
  }, [onDragPointerUp, onResizeUp]);

  /* ── Session actions ── */
  const handleStart = () => {
    const room = getFocusRoom(draft.selectedRoom);
    updateFocusConfig({
      focusMinutes: draft.durationMinutes,
      breakMinutes: draft.breakMinutes,
      targetRounds: draft.rounds,
    });
    startSession({
      durationMinutes: draft.durationMinutes,
      restMinutes: draft.breakMinutes,
      rounds: draft.rounds,
      task: draft.task.trim() || undefined,
      loopMode: draft.loopMode,
      category: room.category,
      roomType: room.id,
    });
  };

  const handleRoomSelect = (roomType: typeof draft.selectedRoom) => {
    setDraft({ selectedRoom: roomType });
  };

  /* ── Window title ── */
  const windowTitle = (() => {
    switch (effectiveView) {
      case 'active': return session.sessionCategory === 'rest' ? 'TIDEBOUND · 恢復中' : 'TIDEBOUND · 專注中';
      case 'paused': return 'TIDEBOUND · 休息';
      case 'break': return 'TIDEBOUND · 休息';
      case 'settlement': return 'TIDEBOUND · 本次結算';
      case 'statistics': return 'TIDEBOUND · 專注統計';
      case 'room': return 'TIDEBOUND · 月潮小屋';
      default: return 'TIDEBOUND · 開始這一輪';
    }
  })();

  if (!win.isOpen) return null;

  const style: React.CSSProperties = win.isMaximized
    ? { top: 0, left: 0, width: '100vw', height: '100dvh', borderRadius: 0 }
    : { top: win.y, left: win.x, width: win.width, height: win.height };

  const settlementOutcome = session.lastSettlement?.outcome;

  return createPortal(
    <div
      ref={windowRef}
      className={`tidebound-window ${win.isMaximized ? 'maximized' : ''} ${win.isMinimized ? 'minimized' : ''}`}
      style={style}
      onPointerMove={onWindowPointerMove}
      onPointerUp={onWindowPointerUp}
      onPointerCancel={onWindowPointerUp}
    >
      {/* ── Close confirm Sheet (active/paused/break) ── */}
      {showCloseConfirm && (
        <div className="tb-report-overlay">
          <div className="tb-report" style={{ maxWidth: 320 }}>
            <div className="tb-report-title">確定要關閉 TIDEBOUND？</div>
            <p className="tb-report-confirm-text">
{effectiveView === 'active' ? '專注尚未結束，關閉將會中斷本輪。' :
                effectiveView === 'paused' ? '你還在暫停中，關閉將會中斷本輪。' :
                '休息尚未結束，關閉不會存檔。'}
            </p>
            <div className="tb-report-confirm-btns">
              <button type="button" className="tb-btn" onClick={handleCancelClose}>繼續</button>
              <button type="button" className="tb-btn tb-btn--danger" onClick={handleConfirmClose}>關閉</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unified header ── */}
      <div className="tidebound-header" onPointerDown={onTitlePointerDown}>
        <div className="tb-traffic" aria-label="視窗控制">
          <button type="button" className="tb-traffic-btn tb-traffic-btn--close" onPointerDown={(e) => e.stopPropagation()} onClick={handleTitleClose} aria-label="關閉" title="關閉" />
          <button type="button" className="tb-traffic-btn tb-traffic-btn--minimize" onPointerDown={(e) => e.stopPropagation()} onClick={win.minimizeWindow} aria-label="最小化" title="最小化" />
          <button type="button" className="tb-traffic-btn tb-traffic-btn--maximize" onPointerDown={(e) => e.stopPropagation()} onClick={win.toggleMaximized} aria-label={win.isMaximized ? '還原' : '最大化'} title={win.isMaximized ? '還原' : '最大化'} />
        </div>

        {/* Back button for settlement / statistics */}
        {(effectiveView === 'settlement' || effectiveView === 'statistics') ? (
          <button type="button" className="tidebound-header-btn"
            onClick={effectiveView === 'statistics' ? () => setTideboundView('settlement') : handleBackToSetup}
            aria-label={effectiveView === 'statistics' ? '返回本次結算' : '返回設定'} title={effectiveView === 'statistics' ? '返回本次結算' : '返回設定'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <span className="tidebound-header-side-spacer" aria-hidden="true" />
        )}

        <span className="tidebound-header-title">{windowTitle}</span>

        {/* Close button for settlement / statistics */}
        {(effectiveView === 'settlement' || effectiveView === 'statistics') ? (
          <button type="button" className="tidebound-header-btn" onClick={handleSettlementClose} aria-label="關閉" title="關閉">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : (
          <span className="tidebound-header-side-spacer" aria-hidden="true" />
        )}
      </div>

      {/* ── Single scroll body ── */}
      <div className="tidebound-scroll-body">
        {/* Self-report overlay */}
        {showSelfReport && isActive && (
          <div className="tb-report-overlay">
            {pendingReport ? (
              <div className="tb-report">
                <div className="tb-report-title">
                  {pendingReport === 'completed' ? '確認完成？' :
                   pendingReport === 'partial' ? '只完成了一部分？' :
                   pendingReport === 'none' ? '確認沒做？' : '確認'}
                </div>
                <p className="tb-report-confirm-text">
                  {pendingReport === 'completed' ? '月潮會把這輪記為守約完成。' :
                   pendingReport === 'partial' ? '這不是失敗，但月潮會記下實際進度。' :
                   pendingReport === 'none' ? '至少誠實。這輪會被記為未完成。' : ''}
                </p>
                <div className="tb-report-confirm-btns">
                  <button type="button" className="tb-btn" onClick={handleCancelReport}>返回</button>
                  <button type="button" className="tb-btn" style={{ background: 'var(--tb-accent)', borderColor: 'transparent', color: '#fff', fontWeight: 600 }} onClick={handleSubmitReport}>
                    {pendingReport === 'completed' ? '確認完成' :
                     pendingReport === 'partial' ? '記錄部分完成' :
                     '照實記錄'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="tb-report">
                <div className="tb-report-title">這一輪的結果？</div>
                <div className="tb-report-options">
                  <button className="tb-report-btn" onClick={() => handlePickReport('completed')}>有完成</button>
                  <button className="tb-report-btn" onClick={() => handlePickReport('partial')}>只完成一部分</button>
                  <button className="tb-report-btn" onClick={() => handlePickReport('none')}>沒有</button>
                </div>
                <button className="tb-report-link" onClick={handleSkipReport}>跳過</button>
              </div>
            )}
          </div>
        )}

        {(effectiveView === 'active' || effectiveView === 'paused' || effectiveView === 'break') && !showSelfReport ? (
          <FocusRoomPanel
            selectedRoom={session.roomType}
            onPause={pauseSession}
            onResume={resumeSession}
            onEnd={session.sessionCategory === 'focus' ? handleEnd : endSession}
          />
        ) : effectiveView === 'room' || effectiveView === 'setup' ? (
          <FocusRoomPanel
            selectedRoom={draft.selectedRoom}
            task={draft.task}
            onTaskChange={(t) => setDraft({ task: t })}
            onRoomSelect={handleRoomSelect}
            durationMinutes={draft.durationMinutes}
            onDurationChange={(m) => setDraft({ durationMinutes: m })}
            breakMinutes={draft.breakMinutes}
            onBreakChange={(b) => setDraft({ breakMinutes: b })}
            rounds={draft.rounds}
            onRoundsChange={(r) => setDraft({ rounds: r })}
            loopMode={draft.loopMode}
            onLoopModeChange={(l) => setDraft({ loopMode: l })}
            witnessEnabled={draft.witnessEnabled}
            allowRecall={draft.allowAiReference}
            autoMemory={draft.autoSaveMemory}
            reminderEnabled={draft.completionReminder}
            soundEnabled={draft.focusSoundEnabled}
            onWitnessChange={(v) => setDraft({ witnessEnabled: v })}
            onRecallChange={(v) => setDraft({ allowAiReference: v })}
            onAutoMemoryChange={(v) => setDraft({ autoSaveMemory: v })}
            onReminderChange={(v) => setDraft({ completionReminder: v })}
            onSoundChange={(v) => setDraft({ focusSoundEnabled: v })}
          />
        ) : effectiveView === 'settlement' && settlementOutcome ? (
          <FocusSettlement
            outcome={settlementOutcome}
            onViewStatistics={handleViewStatistics}
          />
        ) : effectiveView === 'statistics' ? (
          <div className="tb-stats-body">
            <FocusStatisticsView />
          </div>
        ) : null}
      </div>

      {(effectiveView === 'room' || effectiveView === 'setup') && (() => {
        const room = getFocusRoom(draft.selectedRoom);
        return (
          <div className="focus-room-start-footer tidebound-setup-footer">
            <div><span>{room.label} · {room.subtitle}</span><small>專注 {draft.durationMinutes} 分鐘 · 完成後休息 {draft.breakMinutes} 分鐘</small></div>
            {activeMainline && <button type="button" className="tb-tiderail-entry" onClick={() => { win.closeWindow(); navigate('/quests/tiderail'); }}><small>ACTIVE MAINLINE</small><strong>{activeMainline.title}</strong></button>}
            <button type="button" className="tb-cta" onClick={handleStart}>開始這一輪</button>
          </div>
        );
      })()}

      {/* ── Unified footer — settlement / statistics only ── */}
      {effectiveView === 'settlement' && settlementOutcome ? (
        <div className="tidebound-footer">
          <button type="button" className="tb-footer-btn tb-footer-btn--primary" onClick={handleSettlementAgain}>再來一輪</button>
          <button type="button" className="tb-footer-btn" onClick={handleViewStatistics}>查看統計</button>
          <button type="button" className="tb-footer-btn tb-footer-btn--ghost" onClick={handleSettlementClose}>關閉</button>
        </div>
      ) : effectiveView === 'statistics' ? (
        <div className="tidebound-footer">
          <button type="button" className="tb-footer-btn tb-footer-btn--ghost" onClick={() => setTideboundView('settlement')}>返回結算</button>
          <button type="button" className="tb-footer-btn tb-footer-btn--primary" onClick={handleSettlementClose}>關閉</button>
        </div>
      ) : null}

      {!win.isMaximized && RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          className={`tb-resize-zone tb-resize-zone--${edge}`}
          onPointerDown={onResizePointerDown(edge)}
          aria-hidden="true"
        />
      ))}
    </div>,
    document.body,
  );
}
