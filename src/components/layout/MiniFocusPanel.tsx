import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { useFocusWitnessStore } from '@/store/useFocusWitnessStore';
import { useAppStore } from '@/store/useAppStore';
import { FocusReportIcon, type FocusReportIconType } from '@/components/layout/FocusReportIcon';
import { useFocusCareerStore, getNextFocusMilestone } from '@/store/useFocusCareerStore';
import { useQuestStore } from '@/store/useQuestStore';
import { toLocalDateString } from '@/utils/date';
import { selectActiveMainline, useTideRailStore } from '@/store/useTideRailStore';

const SELF_REPORT_OPTIONS = [
  { value: 'completed', label: '完成了', icon: 'complete' },
  { value: 'partial', label: '做了一部分', icon: 'partial' },
  { value: 'barely', label: '幾乎沒做', icon: 'barely' },
  { value: 'faking', label: '我在假裝忙', icon: 'faking' },
] as const;

export function MiniFocusPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const session = useFocusSessionStore((s) => s);
  const startSession = useFocusSessionStore((s) => s.startSession);
  const pauseSession = useFocusSessionStore((s) => s.pauseSession);
  const resumeSession = useFocusSessionStore((s) => s.resumeSession);
  const endSession = useFocusSessionStore((s) => s.endSession);
  const completeSession = useFocusSessionStore((s) => s.completeSession);
  const focusConfig = useAppStore((s) => s.focusConfig);
  const setOutcome = useFocusIslandStore((s) => s.setOutcome);
  const witnessEnabled = useFocusWitnessStore((s) => s.witnessEnabled);
  const allowRecall = useFocusWitnessStore((s) => s.allowRecall);
  const setWitnessEnabled = useFocusWitnessStore((s) => s.setWitnessEnabled);
  const setAllowRecall = useFocusWitnessStore((s) => s.setAllowRecall);
  const careerStats = useFocusCareerStore((s) => s.stats);
  const quests = useQuestStore((s) => s.quests);
  const mainQuestId = useQuestStore((s) => s.mainQuestByDate[toLocalDateString()]);
  const mainQuest = quests.find((quest) => quest.id === mainQuestId);
  const nextMilestone = getNextFocusMilestone(careerStats.totalFocusSeconds);
  const activeMainline = useTideRailStore(selectActiveMainline);

  const openTideboundWindow = () => {
    useFocusWindowStore.getState().openWindow();
    useFocusIslandStore.getState().showWindow();
    onClose();
  };

  const [customMin, setCustomMin] = useState('25');
  const [task, setTask] = useState('');
  const [showSelfReport, setShowSelfReport] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!task && mainQuest?.title) setTask(mainQuest.title);
  }, [mainQuest?.title, task]);

  const isRunning = session.status === 'running';
  const isPaused = session.status === 'paused';
  const isActive = isRunning || isPaused;
  const isIdle = !isActive;

  const remaining = session.remainingSeconds;
  const rm = Math.floor(remaining / 60);
  const rs = remaining % 60;

  const handleQuickStart = (minutes: number) => {
    const trimmed = task.trim();
    startSession({
      durationMinutes: minutes,
      restMinutes: 5,
      rounds: 1,
      task: trimmed || undefined,
    });
    if (!trimmed) {
      setTimeout(() => useFocusSessionStore.getState().setTask(''), 100);
    }
    onClose();
  };

  const handleCustomStart = () => {
    const m = parseInt(customMin, 10);
    if (m > 0 && m <= 180) {
      const trimmed = task.trim();
      startSession({
        durationMinutes: m,
        restMinutes: 5,
        rounds: 1,
        task: trimmed || undefined,
      });
      if (!trimmed) {
        setTimeout(() => useFocusSessionStore.getState().setTask(''), 100);
      }
      onClose();
    }
  };

  const handleEnd = () => {
    setShowSelfReport(true);
  };

  const handleSelfReport = (report: string) => {
    const isFaking = report === 'faking';
    const isCompleted = report === 'completed';

    const outcomeLabel = isFaking
      ? '月潮抓包：假裝忙'
      : isCompleted
        ? '月潮覺得你守約了'
        : '月潮記下來了';
    setOutcome(outcomeLabel);
    if (isCompleted) completeSession(report);
    else endSession();
    setShowSelfReport(false);
    onClose();
  };

  const cancelSelfReport = () => {
    endSession();
    setShowSelfReport(false);
    onClose();
  };

  return createPortal(
    <>
      <div className="mini-focus-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mini-focus-panel" onClick={(e) => e.stopPropagation()}>
        {/* Self-report overlay */}
        {showSelfReport && (
          <div className="mini-focus-report-overlay">
            <div className="mini-focus-report">
              <div className="mini-focus-subtitle">這一輪的結果？</div>
              <div className="mini-focus-report-options">
                {SELF_REPORT_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    className="mini-focus-report-btn"
                    onClick={() => handleSelfReport(opt.value)}
                    aria-label={opt.label}
                    title={opt.label}>
                    <span className="mini-focus-report-icon"><FocusReportIcon type={opt.icon as FocusReportIconType} /></span>
                  </button>
                ))}
              </div>
              <button type="button" className="mini-focus-link" onClick={cancelSelfReport}>
                跳過，直接結束
              </button>
            </div>
          </div>
        )}

        <div className="mini-focus-head">
          <span className="mini-focus-title">TIDEBOUND</span>
          <button type="button" className="mini-focus-close" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {isIdle ? (
          <div className="mini-focus-quick">
            <div className="mini-focus-subtitle">快速開始</div>
            <div className="mini-focus-career-strip">
              <span><small>生涯專注時長</small><strong>{Math.floor(careerStats.totalFocusSeconds / 3600)}h {Math.floor((careerStats.totalFocusSeconds % 3600) / 60)}m</strong></span>
              <span><small>下一潮痕</small><strong>{nextMilestone?.title ?? '已集齊'}</strong></span>
            </div>
            {activeMainline && <button type="button" className="mini-focus-tiderail" onClick={() => { navigate('/quests/tiderail'); onClose(); }}><span>ACTIVE MAINLINE</span><strong>{activeMainline.title}</strong><small>查看驗收條件、Drift Inbox 與 Resume Note →</small></button>}

            {/* Task input */}
            <div className="mini-focus-task-input">
              <input type="text" value={task} onChange={(e) => setTask(e.target.value)}
                placeholder="這一輪只做什麼？（可空白）" />
              {!task.trim() && (
                <span className="mini-focus-task-hint">不填也可以，我會陪你進入狀態。</span>
              )}
            </div>

            <div className="mini-focus-buttons">
              <button className="mini-focus-btn" onClick={() => handleQuickStart(5)}>5 分鐘<br /><small>硬啟動</small></button>
              <button className="mini-focus-btn" onClick={() => handleQuickStart(8)}>8 分鐘<br /><small>守約</small></button>
              <button className="mini-focus-btn" onClick={() => handleQuickStart(focusConfig.focusMinutes)}>
                {focusConfig.focusMinutes} 分鐘<br /><small>{focusConfig.selectedPreset === 'flow' ? 'Flow' : '預設'}</small>
              </button>
            </div>
            <div className="mini-focus-custom">
              <input type="number" min={1} max={180} value={customMin}
                onChange={(e) => setCustomMin(e.target.value)} placeholder="自訂" />
              <button className="mini-focus-btn" onClick={handleCustomStart}>開始</button>
            </div>

            {/* Witness toggle */}
            <div className="mini-focus-witness">
              <div className="companion-toggle-row">
                <span>月潮見證</span>
                <button type="button"
                  className={`companion-toggle ${witnessEnabled ? 'active' : ''}`}
                  onClick={() => setWitnessEnabled(!witnessEnabled)}>
                  <span className="companion-toggle-knob" />
                </button>
              </div>
              {witnessEnabled && (
                <div className="companion-toggle-row">
                  <span className="mini-focus-witness-sub">允許 AI 參考</span>
                  <button type="button"
                    className={`companion-toggle ${allowRecall ? 'active' : ''}`}
                    onClick={() => setAllowRecall(!allowRecall)}>
                    <span className="companion-toggle-knob" />
                  </button>
                </div>
              )}
              <p className="mini-focus-witness-hint">
                {witnessEnabled
                  ? '月潮見證已開啟 · 本輪結果會寫入記憶庫'
                  : '見證關閉 · 仍可倒數但不寫入見證記錄'}
              </p>
            </div>

            <button className="mini-focus-link" onClick={openTideboundWindow}>
              進入 TIDEBOUND 完整設定 →
            </button>
          </div>
        ) : (
          <div className="mini-focus-active">
            <div className="mini-focus-timer">
              <span className="mini-focus-remaining">{String(rm).padStart(2, '0')}:{String(rs).padStart(2, '0')}</span>
              <span className="mini-focus-phase">
                {session.phase === 'focus' ? `專注第 ${session.currentRound}/${session.rounds} 輪` : '休息時間'}
              </span>
            </div>
            <div className="mini-focus-buttons">
              {isRunning ? (
                <button className="mini-focus-btn" onClick={pauseSession}>暫停</button>
              ) : (
                <button className="mini-focus-btn" onClick={resumeSession}>繼續</button>
              )}
              <button className="mini-focus-btn mini-focus-btn--danger" onClick={handleEnd}>結束本輪</button>
            </div>
            <button className="mini-focus-link" onClick={openTideboundWindow}>
              TIDEBOUND 完整設定 →
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
