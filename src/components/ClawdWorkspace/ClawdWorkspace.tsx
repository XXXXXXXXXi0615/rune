import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusWitnessStore } from '@/store/useFocusWitnessStore';
import { useToastStore } from '@/store/useToastStore';
import type { FocusConfig } from '@/types';
import { computeEmotion } from '@/utils/focusEmotionEngine';
import type { EmotionOutput } from '@/utils/focusEmotionEngine';
import '@/styles/moon-focus.css';
import FocusVitals from './FocusVitals';
import { WheelPicker } from './WheelPicker';

function fmtFocusDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Inline SVG gear icon — replaces Unicode ⚙ emoji. */
function GearSvg({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* ════════════════════════════════════════

/* ════════════════════════════════════════
   INTERACTIVE CIRCULAR DIAL
   Idle:  draggable handle sets focus time.
   Running: progress ring with breathing glow.
   ════════════════════════════════════════ */

const DIAL_SIZE = 240;
const DIAL_STROKE = 5;
const DIAL_RADIUS = (DIAL_SIZE - DIAL_STROKE) / 2;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

const FOCUS_DURATION_STORAGE_KEY = 'lunartide_focus_rotary_duration_seconds';
const MIN_DURATION_SECONDS = 60;
const SECONDS_PER_ROTATION = 3600;

function normalizeDurationSeconds(seconds: number) {
  return Math.max(MIN_DURATION_SECONDS, Math.round(Number.isFinite(seconds) ? seconds : 25 * 60));
}

function loadFocusDurationSeconds(fallbackMinutes: number) {
  if (typeof window === 'undefined') return normalizeDurationSeconds(fallbackMinutes * 60);
  const stored = Number(window.localStorage.getItem(FOCUS_DURATION_STORAGE_KEY));
  return normalizeDurationSeconds(Number.isFinite(stored) && stored > 0 ? stored : fallbackMinutes * 60);
}

function saveFocusDurationSeconds(seconds: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FOCUS_DURATION_STORAGE_KEY, String(normalizeDurationSeconds(seconds)));
}

/** Convert duration seconds → visible angle in current watch rotation. */
function secondsToAngle(seconds: number): number {
  const remainder = normalizeDurationSeconds(seconds) % SECONDS_PER_ROTATION;
  return remainder === 0 ? 360 : (remainder / SECONDS_PER_ROTATION) * 360;
}

/** Convert dial angle + radius → SVG (x, y) on circle. */
function angleToSvg(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Angle in degrees from 12-o'clock CW given pointer offset from dial centre. */
function pointerToAngle(dialRect: DOMRect, clientX: number, clientY: number): number {
  const cx = dialRect.left + dialRect.width / 2;
  const cy = dialRect.top + dialRect.height / 2;
  let angle = Math.atan2(clientX - cx, -(clientY - cy)) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

interface FocusDialProps {
  seconds: number;
  onSecondsChange: (seconds: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

/** Idle-state interactive dial: filled arc + draggable knob. */
function FocusDial({ seconds, onSecondsChange, onDraggingChange }: FocusDialProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const dragRef = useRef({
    active: false,
    startSeconds: seconds,
    totalDelta: 0,
    lastAngle: 0,
    lastTime: 0,
    velocity: 0,
    raf: 0,
  });

  const setDraggingWithNotify = useCallback((v: boolean) => {
    setDragging(v);
    onDraggingChange?.(v);
  }, [onDraggingChange]);

  const handleAngle = secondsToAngle(seconds);
  const fillArcLen = (handleAngle / 360) * DIAL_CIRCUMFERENCE;
  const handlePos = angleToSvg(handleAngle, DIAL_RADIUS, DIAL_SIZE / 2, DIAL_SIZE / 2);
  const rotationCount = Math.floor(normalizeDurationSeconds(seconds) / SECONDS_PER_ROTATION);

  const commitSeconds = useCallback((nextSeconds: number) => {
    if (dragRef.current.raf) cancelAnimationFrame(dragRef.current.raf);
    dragRef.current.raf = requestAnimationFrame(() => {
      onSecondsChange(normalizeDurationSeconds(nextSeconds));
    });
  }, [onSecondsChange]);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect || !dragRef.current.active) return;
    const angle = pointerToAngle(rect, clientX, clientY);
    const now = performance.now();
    let delta = angle - dragRef.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragRef.current.totalDelta += delta;
    const elapsed = Math.max(1, now - dragRef.current.lastTime);
    dragRef.current.velocity = delta / elapsed;
    dragRef.current.lastAngle = angle;
    dragRef.current.lastTime = now;
    commitSeconds(dragRef.current.startSeconds + (dragRef.current.totalDelta / 360) * SECONDS_PER_ROTATION);
  }, [commitSeconds]);

  const finishDrag = useCallback(() => {
    if (!dragRef.current.active) return;
    const inertialDelta = Math.max(-90, Math.min(90, dragRef.current.velocity * 140));
    const nextSeconds = dragRef.current.startSeconds + ((dragRef.current.totalDelta + inertialDelta) / 360) * SECONDS_PER_ROTATION;
    dragRef.current.active = false;
    commitSeconds(nextSeconds);
    saveFocusDurationSeconds(nextSeconds);
    setDraggingWithNotify(false);
    setSettling(true);
    window.setTimeout(() => setSettling(false), 220);
  }, [commitSeconds, setDraggingWithNotify]);

  useEffect(() => () => {
    if (dragRef.current.raf) cancelAnimationFrame(dragRef.current.raf);
  }, []);

  return (
    <div
      ref={dialRef}
      className={`mf-dial-ring mf-dial-ring--interactive${dragging ? ' mf-dial-ring--dragging' : ''}${settling ? ' mf-dial-ring--settling' : ''}`}
      style={{ position: 'relative', width: DIAL_SIZE, height: DIAL_SIZE }}
      role="slider"
      aria-label="調整專注時間"
      aria-valuemin={MIN_DURATION_SECONDS}
      aria-valuenow={Math.round(seconds)}
      aria-valuetext={fmtFocusDuration(seconds)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = normalizeDurationSeconds(seconds - (e.shiftKey ? 300 : 30));
          onSecondsChange(next);
          saveFocusDurationSeconds(next);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = normalizeDurationSeconds(seconds + (e.shiftKey ? 300 : 30));
          onSecondsChange(next);
          saveFocusDurationSeconds(next);
        }
      }}
      onPointerDown={(e) => {
        const rect = dialRef.current?.getBoundingClientRect();
        if (!rect) return;
        const angle = pointerToAngle(rect, e.clientX, e.clientY);
        dragRef.current = {
          active: true,
          startSeconds: seconds,
          totalDelta: 0,
          lastAngle: angle,
          lastTime: performance.now(),
          velocity: 0,
          raf: dragRef.current.raf,
        };
        setDraggingWithNotify(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={dragging ? (e) => handlePointer(e.clientX, e.clientY) : undefined}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="mf-dial-grad-idle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8a55a" />
            <stop offset="100%" stopColor="#cc785c" />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={DIAL_RADIUS}
          fill="none" stroke="var(--border)" strokeWidth={DIAL_STROKE}
          strokeLinecap="round" opacity="0.3" />

        {/* Tick marks — watch-like reference marks, duration itself remains continuous */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = i * 30;
          const innerR = DIAL_RADIUS - 8;
          const outerR = DIAL_RADIUS + 2;
          const p1 = angleToSvg(a, innerR, DIAL_SIZE / 2, DIAL_SIZE / 2);
          const p2 = angleToSvg(a, outerR, DIAL_SIZE / 2, DIAL_SIZE / 2);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" opacity="0.25" />
          );
        })}

        {/* Filled arc from top to handle */}
        <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={DIAL_RADIUS}
          fill="none" stroke="url(#mf-dial-grad-idle)"
          strokeWidth={DIAL_STROKE + 1} strokeLinecap="round"
          strokeDasharray={`${fillArcLen} ${DIAL_CIRCUMFERENCE}`}
          strokeDashoffset={0}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>

      {/* Inner glass disc */}
      <div className="mf-dial-inner" style={{
        position: 'absolute', inset: 20, borderRadius: '50%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span className="mf-time-display">{fmtFocusDuration(seconds)}</span>
        {rotationCount > 0 && <span className="mf-dial-rotation-count">+{rotationCount}h</span>}
      </div>

      {/* Draggable knob */}
      <div className={`mf-dial-knob${dragging ? ' mf-dial-knob--active' : ''}`}
        style={{
          position: 'absolute',
          left: handlePos.x - 11,
          top: handlePos.y - 11,
          width: 22,
          height: 22,
          pointerEvents: 'none',
        }}>
        <div className="mf-dial-knob-inner" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   RUNNING-STATE TIMER (no interaction)
   ════════════════════════════════════════ */
function RunningTimer({ timeLeft, totalTime, phase, running, emotion }: {
  timeLeft: number; totalTime: number; phase: 'focus' | 'break'; running: boolean; emotion?: EmotionOutput;
}) {
  const isFocus = phase === 'focus';
  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const dashOffset = DIAL_CIRCUMFERENCE * (1 - progress);
  const ringGlow = emotion?.glowColor ?? (isFocus ? '#cc785c' : '#9a8e85');

  return (
    <div className="mf-dial-ring" style={{ position: 'relative', width: DIAL_SIZE, height: DIAL_SIZE }}>
      {running && <div className="mf-breathing-glow" />}
      <svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <linearGradient id="mf-run-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isFocus ? '#e8a55a' : '#9a8e85'} />
            <stop offset="100%" stopColor={isFocus ? '#cc785c' : '#7a7068'} />
          </linearGradient>
        </defs>
        <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={DIAL_RADIUS}
          fill="none" stroke="var(--border)" strokeWidth={DIAL_STROKE}
          strokeLinecap="round" opacity="0.3" />
        <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={DIAL_RADIUS}
          fill="none" stroke="url(#mf-run-grad)"
          strokeWidth={DIAL_STROKE + (running ? 1 : 0)} strokeLinecap="round"
          strokeDasharray={DIAL_CIRCUMFERENCE} strokeDashoffset={dashOffset}
          style={{
            transform: 'rotate(-90deg)', transformOrigin: 'center',
            transition: running ? 'stroke-dashoffset 1s linear, stroke-width 0.3s ease' : 'stroke-dashoffset 0.4s ease, stroke-width 0.3s ease',
            filter: running ? `drop-shadow(0 0 6px ${ringGlow}55)` : undefined,
          }}
        />
      </svg>
      <div className={`mf-dial-inner ${running ? 'mf-dial-inner--running' : ''}`} style={{
        position: 'absolute', inset: 20, borderRadius: '50%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="mf-time-display">{fmtFocusDuration(timeLeft)}</span>
        <span className="mf-phase-label">{phase === 'focus' ? '專注中' : '休息'}</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ROUND INDICATOR DOTS
   ════════════════════════════════════════ */
function RoundIndicator({ currentRound, totalRounds }: { currentRound: number; totalRounds: number }) {
  if (totalRounds <= 0) return null;
  return (
    <div className="mf-round-dots">
      {Array.from({ length: totalRounds }, (_, i) => (
        <div key={i}
          className={`mf-round-dot${i === currentRound - 1 ? ' mf-round-dot--active' : ''}${i < currentRound ? ' mf-round-dot--done' : ''}`}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   GLASS SETTINGS SHEET (iOS-style bottom sheet)
   ════════════════════════════════════════ */
function SettingsPanel({ cfgBreak, cfgRounds, updateConfig, onClose }: {
  cfgBreak: number; cfgRounds: number;
  updateConfig: (patch: Partial<FocusConfig>) => void; onClose: () => void;
}) {
  const [draftBreak, setDraftBreak] = useState(cfgBreak);
  const [draftRounds, setDraftRounds] = useState(cfgRounds);

  // Reset drafts when panel opens with new config values
  useEffect(() => {
    setDraftBreak(cfgBreak);
    setDraftRounds(cfgRounds);
  }, [cfgBreak, cfgRounds]);

  const handleCancel = () => {
    onClose();
  };

  const handleConfirm = () => {
    updateConfig({
      breakMinutes: draftBreak,
      targetRounds: draftRounds,
    });
    onClose();
  };

  return (
    <div className="mf-glass-sheet mf-glass-sheet--settings" onClick={(e) => e.stopPropagation()}>
      <div className="mf-sheet-handle" />
      <div className="mf-sheet-header">
        <span className="mf-sheet-title">專注設定</span>
        <button type="button" onClick={handleCancel} className="mf-sheet-close" aria-label="關閉設定">&#x2715;</button>
      </div>
      <div className="mf-sheet-body">
        <p className="mf-settings-note">專注時長由外圈旋鈕自由設定；這裡只調整休息與輪數。</p>
        <div className="mf-wheel-row">
          <WheelPicker value={draftBreak} min={1} max={60} unit="分鐘" onChange={setDraftBreak} />
          <WheelPicker value={draftRounds || 1} min={1} max={12} unit="輪" onChange={setDraftRounds} />
        </div>
      </div>
      <div className="mf-settings-footer">
        <button type="button" className="mf-btn mf-btn--cancel" onClick={handleCancel}>取消</button>
        <button type="button" className="mf-btn mf-btn--confirm" onClick={handleConfirm}>完成</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN WORKSPACE — MOON FOCUS 2.0
   ════════════════════════════════════════ */
export function MoonFocusWorkspace({ onClose, style, variant = 'embedded', workspaceRef, dragHandleProps, dragging }: {
  onClose?: () => void; style?: React.CSSProperties; variant?: 'embedded' | 'drawer';
  workspaceRef?: React.Ref<HTMLDivElement>; dragHandleProps?: React.HTMLAttributes<HTMLDivElement>; dragging?: boolean;
}) {
  const focusConfig = useAppStore((s) => s.focusConfig);
  const updateFocusConfig = useAppStore((s) => s.updateFocusConfig);

  const cfgFocus = focusConfig.focusMinutes;
  const cfgBreak = focusConfig.breakMinutes;
  const cfgRounds = focusConfig.targetRounds;

  /* ── Global focus session ── */
  const gsStatus = useFocusSessionStore((s) => s.status);
  const gsRemaining = useFocusSessionStore((s) => s.remainingSeconds);
  const gsPhase = useFocusSessionStore((s) => s.phase);
  const gsCurrentRound = useFocusSessionStore((s) => s.currentRound);
  const gsDurationMin = useFocusSessionStore((s) => s.durationMinutes);
  const gsRestMin = useFocusSessionStore((s) => s.restMinutes);
  const gsRounds = useFocusSessionStore((s) => s.rounds);
  const gsInterruptions = useFocusSessionStore((s) => s.interruptions);
  const gsRoundsCompleted = useFocusSessionStore((s) => s.roundsCompleted);
  const gsStart = useFocusSessionStore((s) => s.startSession);
  const gsPause = useFocusSessionStore((s) => s.pauseSession);
  const gsResume = useFocusSessionStore((s) => s.resumeSession);
  const gsEnd = useFocusSessionStore((s) => s.endSession);

  const sessionActive = gsStatus !== 'idle';
  const focusRunning = gsStatus === 'running';
  const focusTimeLeft = gsRemaining;
  const focusPhase = gsPhase as 'focus' | 'break';

  /* ── Witness toggles ── */
  const witnessEnabled = useFocusWitnessStore((s) => s.witnessEnabled);
  const allowRecall = useFocusWitnessStore((s) => s.allowRecall);
  const setWitnessEnabled = useFocusWitnessStore((s) => s.setWitnessEnabled);
  const setAllowRecall = useFocusWitnessStore((s) => s.setAllowRecall);

  /* ── Emotion Engine — 60s tick (decoupled from timer) ── */
  const [emotionTick, setEmotionTick] = useState(0);
  useEffect(() => {
    if (!focusRunning) return;
    const id = setInterval(() => setEmotionTick((v) => v + 1), 60_000);
    return () => clearInterval(id);
  }, [focusRunning]);

  const emotion: EmotionOutput = useMemo(() => {
    const elapsed = gsDurationMin > 0 ? (gsDurationMin * 60 - gsRemaining) : 0;
    return computeEmotion({
      durationMinutes: gsDurationMin || cfgFocus,
      elapsedSeconds: Math.max(0, elapsed),
      interruptions: gsInterruptions,
      completionRate: gsRounds > 0 ? gsRoundsCompleted / gsRounds : 0,
      phase: focusPhase,
      isRunning: focusRunning,
    });
  }, [gsDurationMin, gsRemaining, gsInterruptions, gsRoundsCompleted, gsRounds, focusPhase, focusRunning, cfgFocus, emotionTick]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Local dial duration in seconds. Stored separately so rotary input can be continuous.
  const [dialSeconds, setDialSeconds] = useState(() => loadFocusDurationSeconds(cfgFocus));
  const [dialDragging, setDialDragging] = useState(false);

  /* Toast notifications at key focus moments */
  const showToast = useToastStore((s) => s.showToast);
  const prevRemainingRef = useRef(gsRemaining);
  const prevStatusRef = useRef(gsStatus);
  const prevPhaseRef = useRef(gsPhase);
  const prevCompletedRoundsRef = useRef(gsRoundsCompleted);

  useEffect(() => {
    if (!sessionActive) return;
    // Session just started
    if (prevStatusRef.current !== 'running' && gsStatus === 'running') {
      showToast(`時間開始了。守住這 ${fmtFocusDuration(gsDurationMin * 60)}。`);
    }
    // Paused
    if (prevStatusRef.current === 'running' && gsStatus === 'paused') {
      showToast('已暫停。需要調整嗎？');
    }
    // Resumed
    if (prevStatusRef.current === 'paused' && gsStatus === 'running') {
      showToast('繼續專注。');
    }
    // 5 min warning
    if (gsPhase === 'focus' && gsStatus === 'running' && gsRemaining <= 300 && prevRemainingRef.current > 300) {
      showToast('還剩 5 分鐘，你可以的。');
    }
    // Round completed
    if (prevCompletedRoundsRef.current !== gsRoundsCompleted && gsRoundsCompleted > 0) {
      showToast(`完成第 ${gsRoundsCompleted} 輪！${gsPhase === 'break' ? '休息一下吧' : ''}`);
    }
    // Transition to break
    if (prevPhaseRef.current === 'focus' && gsPhase === 'break') {
      showToast('休息時間。喝點水、站起來動一動。');
    }
    // Transition to focus
    if (prevPhaseRef.current === 'break' && gsPhase === 'focus') {
      showToast('新一輪開始。慢慢來，比較快。');
    }
    prevRemainingRef.current = gsRemaining;
    prevStatusRef.current = gsStatus;
    prevPhaseRef.current = gsPhase;
    prevCompletedRoundsRef.current = gsRoundsCompleted;
  }, [gsRemaining, gsStatus, gsPhase, gsRoundsCompleted, sessionActive, gsDurationMin, showToast]);

  /* Hide BottomNav while settings sheet is open */
  useEffect(() => {
    if (settingsOpen) {
      document.body.classList.add('sheet-open');
    } else {
      document.body.classList.remove('sheet-open');
    }
  }, [settingsOpen]);

  /* ESC → close settings */
  useEffect(() => {
    if (!settingsOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [settingsOpen]);

  // Sync dial from config when idle
  useEffect(() => {
    if (!sessionActive && !dialDragging) setDialSeconds(loadFocusDurationSeconds(cfgFocus));
  }, [cfgFocus, sessionActive, dialDragging]);

  // Celebration state for round/session completion
  const [celebrateType, setCelebrateType] = useState<'none' | 'round' | 'session'>('none');
  const celebrateTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ type: string }>;
      const t = evt.detail.type;
      if (t === 'round-complete' || t === 'session-complete') {
        setCelebrateType(t === 'session-complete' ? 'session' : 'round');
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        celebrateTimer.current = setTimeout(() => setCelebrateType('none'), 2500);
      }
    };
    window.addEventListener('focus:event', handler);
    return () => {
      window.removeEventListener('focus:event', handler);
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
  }, []);

  const handleDialChange = useCallback((seconds: number) => {
    setDialSeconds(normalizeDurationSeconds(seconds));
  }, []);

  const startSession = () => {
    const normalizedSeconds = normalizeDurationSeconds(dialSeconds);
    saveFocusDurationSeconds(normalizedSeconds);
    updateFocusConfig({ focusMinutes: normalizedSeconds / 60 });
    gsStart({
      durationMinutes: normalizedSeconds / 60,
      restMinutes: cfgBreak,
      rounds: cfgRounds,
    });
  };

  const endSession = () => {
    gsEnd();
  };

  const isDrawer = variant === 'drawer';
  const phaseTotalSec = focusPhase === 'focus' ? gsDurationMin * 60 : gsRestMin * 60;

  const closeBtn = onClose ? (
    <button type="button" onClick={() => { setSettingsOpen(false); onClose?.(); }}
      onPointerDown={(e) => e.stopPropagation()} aria-label="關閉" className="mf-close-btn">&#x2715;</button>
  ) : null;

  return (
    <div ref={workspaceRef}
      className={`moon-focus-workspace clawd-workspace clawd-panel ${isDrawer ? 'moon-focus-workspace--drawer' : 'clawd-panel--embedded moon-focus-page'} ${dragging ? 'is-dragging' : ''}`}
      style={{
        display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto',
        ...(isDrawer ? { width: '100%', height: '100%', background: 'transparent', border: 'none', borderRadius: 0 }
          : { width: '100%', background: 'transparent', border: 'none' }),
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Header (drawer only) ─── */}
      {isDrawer && (
        <div {...dragHandleProps} className="clawd-panel-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          cursor: dragHandleProps ? (dragging ? 'grabbing' : 'grab') : undefined,
          touchAction: dragHandleProps ? 'none' : undefined,
          userSelect: dragHandleProps ? 'none' : undefined,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>TIDEBOUND</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {closeBtn}
          </div>
        </div>
      )}

      {/* ─── Unified Dashboard ─── */}
      <div className={`mf-dashboard mf-focus-mode-${focusConfig.selectedPreset}${emotion ? ` mf-emotion-${emotion.emotion}` : ''}`}>
        {/* Gear corner — always visible for settings */}
        {!isDrawer && (
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="設定" title="設定專注時間、休息與輪數" className="mf-gear-corner"><GearSvg size={16} /></button>
        )}

        {/* Timer — idle interactive dial or running progress ring */}
        {sessionActive ? (
          <RunningTimer timeLeft={focusTimeLeft} totalTime={phaseTotalSec} phase={focusPhase} running={focusRunning} emotion={emotion} />
        ) : (
          <FocusDial
            seconds={dialSeconds}
            onSecondsChange={handleDialChange}
            onDraggingChange={setDialDragging}
          />
        )}

        {/* Celebration overlay — round / session complete */}
        {celebrateType !== 'none' && (
          <div className={`mf-celebrate-overlay${celebrateType === 'session' ? ' mf-celebrate-overlay--session' : ' mf-celebrate-overlay--round'}`}>
            {celebrateType === 'session'
              ? '全部完成！'
              : '專注完成！休息一下吧'}
          </div>
        )}

        {/* Helper text — idle only */}
        {!sessionActive && (
          <p className="mf-dial-hint">拖動外圈自由設定時間，沒有預設刻度限制</p>
        )}

        {/* Session summary — idle only, clickable → settings */}
        {!sessionActive && (
          <button
            type="button"
            className="mf-session-summary"
            onClick={() => setSettingsOpen(true)}
            title="調整休息與輪數"
          >
            本輪：{fmtFocusDuration(dialSeconds)} 專注 &middot; {cfgBreak} 分休息
            {cfgRounds > 0 && <> &middot; {cfgRounds} 輪</>}
          </button>
        )}

        {/* Break / Rounds stepper chips — idle only */}
        {!sessionActive && (
          <div className="mf-info-chips">
            <div className="mf-info-chip mf-info-chip--stepper">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="mf-stepper-label">休息</span>
              <button type="button" className="mf-stepper-btn"
                onClick={() => updateFocusConfig({ breakMinutes: Math.max(1, cfgBreak - 1) })}
                aria-label="减少休息时间">−</button>
              <span className="mf-stepper-value">{cfgBreak}</span>
              <button type="button" className="mf-stepper-btn"
                onClick={() => updateFocusConfig({ breakMinutes: Math.min(60, cfgBreak + 1) })}
                aria-label="增加休息时间">+</button>
              <span className="mf-stepper-unit">分</span>
            </div>
            <div className="mf-info-chip mf-info-chip--stepper">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="mf-stepper-label">輪數</span>
              <button type="button" className="mf-stepper-btn"
                onClick={() => updateFocusConfig({ targetRounds: Math.max(0, cfgRounds - 1) })}
                aria-label="减少专注轮数">−</button>
              <span className="mf-stepper-value">{cfgRounds > 0 ? cfgRounds : '不限'}</span>
              <button type="button" className="mf-stepper-btn"
                onClick={() => updateFocusConfig({ targetRounds: Math.min(12, cfgRounds + 1) })}
                aria-label="增加专注轮数">+</button>
              <span className="mf-stepper-unit">輪</span>
            </div>
          </div>
        )}
        {!sessionActive && (
          <p className="mf-stepper-hint">调整休息时间 · 设置专注轮数</p>
        )}

        {/* ── LUNARIS Status ── */}
        <div className="mf-lunaris-status">
          {sessionActive ? (
            focusPhase === 'focus'
              ? (focusRunning ? '專注中' : '已暫停')
              : '休息中'
          ) : '待機中'}
        </div>

        {/* Round Indicator — visible during active session */}
        {sessionActive && (
          <>
            <RoundIndicator currentRound={gsCurrentRound} totalRounds={cfgRounds} />
            <div className="mf-round-info">
              第 {gsCurrentRound} 輪{cfgRounds > 0 && <> &middot; 目標 {cfgRounds} 輪</>}
            </div>
            {gsInterruptions > 0 && (
              <div className="mf-interruptions">
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                中斷 {gsInterruptions} 次
              </div>
            )}
          </>
        )}

        {/* Controls */}
        {!sessionActive ? (
          <>
            <div className="clawd-witness-inline">
              <label className="clawd-witness-row">
                <span>CLAWD 見證</span>
                <input type="checkbox" checked={witnessEnabled}
                  onChange={(e) => setWitnessEnabled(e.target.checked)} />
              </label>
              <label className={`clawd-witness-row clawd-witness-sub${!witnessEnabled ? ' clawd-witness-disabled' : ''}`}>
                <span>允許 AI 參考</span>
                <input type="checkbox" checked={witnessEnabled && allowRecall} disabled={!witnessEnabled}
                  onChange={(e) => setAllowRecall(e.target.checked)} />
              </label>
              <p className="clawd-witness-hint">
                {witnessEnabled
                  ? allowRecall ? '本輪結果會寫入記憶庫，並允許 AI 參考' : '本輪結果會寫入記憶庫'
                  : '見證關閉 · 仍可倒數但不寫入見證記錄'}
              </p>
            </div>
            <button type="button" onClick={startSession} className="mf-btn mf-btn--primary">開始這一輪</button>
          </>
        ) : (
          <div className="mf-btn-row">
            {focusRunning ? (
              <button type="button" onClick={gsPause} className="mf-btn mf-btn--glass">暫停</button>
            ) : (
              <button type="button" onClick={gsResume} className="mf-btn mf-btn--glass">繼續</button>
            )}
            <button type="button" onClick={endSession} className="mf-btn mf-btn--end">結束</button>
          </div>
        )}

        {/* Focus Vitals — ECG waveform, visible only during active session */}
        {sessionActive && (
          <FocusVitals isRunning={focusRunning} emotion={emotion} />
        )}

{/* Stats removed — minimal focus mode */}
      </div>

      {/* ─── Settings Sheet Overlay ─── */}
      {settingsOpen && (
        <div className="mf-settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <SettingsPanel
            cfgBreak={cfgBreak} cfgRounds={cfgRounds}
            updateConfig={updateFocusConfig}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
