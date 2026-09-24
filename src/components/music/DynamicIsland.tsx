import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMusicStore, getTrackDisplayName } from '@/store/musicStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';
import './DynamicIsland.css';

type DISource = 'ai' | 'focus' | 'music' | 'sleep';

interface DIState {
  source: DISource;
  icon: string;
  title: string;
  subtitle: string;
  progress: number;       // 0–1, or -1 for indeterminate
  actionLabel?: string;
  onAction?: () => void;
}

export function DynamicIsland() {
  /* ── Source: AI Thinking ── */
  const [aiState, setAiState] = useState<string>('idle');
  const [aiStep, setAiStep] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAiState(detail?.state ?? 'idle');
      setAiStep(detail?.step ?? 0);
    };
    window.addEventListener('lunartide:ai-state', handler);
    return () => window.removeEventListener('lunartide:ai-state', handler);
  }, []);

  /* ── Source: Focus Session ── */
  const focusStatus = useFocusSessionStore((s) => s.status);
  const focusRemaining = useFocusSessionStore((s) => s.remainingSeconds);
  const focusDuration = useFocusSessionStore((s) => s.durationMinutes);
  const pauseSession = useFocusSessionStore((s) => s.pauseSession);
  const endSession = useFocusSessionStore((s) => s.endSession);

  /* ── Source: Music ── */
  const tracks = useMusicStore((s) => s.tracks);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);
  const togglePlay = useMusicStore((s) => s.togglePlay);

  /* ── Source: Sleep ── */
  const sleepReceipts = useAppStore((s) => s.sleepReceipts || []);
  const todaySleepReceipt = useMemo(() => {
    const today = toLocalDateString(new Date());
    return sleepReceipts.find((r) => r.date === today && !r.viewed) || null;
  }, [sleepReceipts]);

  /* ── Track ── */
  const track = tracks.find((t) => t.id === currentTrackId);

  /* ── Active source (highest priority) ── */
  const [activeSource, setActiveSource] = useState<DISource | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const prevSourceRef = useRef<DISource | null>(null);

  const nextSource = useMemo((): DISource | null => {
    if (aiState === 'thinking' || aiState === 'streaming') return 'ai';
    if (track && isPlaying) return 'music';
    if (todaySleepReceipt) return 'sleep';
    return null;
  }, [aiState, focusStatus, track, isPlaying, todaySleepReceipt]);

  useEffect(() => {
    if (nextSource !== activeSource && !transitioning) {
      if (nextSource !== null) {
        // Transition: fade out → swap → fade in
        setTransitioning(true);
        setTimeout(() => {
          prevSourceRef.current = activeSource;
          setActiveSource(nextSource);
          // Small delay then remove transitioning flag
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTransitioning(false);
            });
          });
        }, 180);
      } else if (activeSource !== null) {
        // No source → fade out
        setTransitioning(true);
        setTimeout(() => {
          prevSourceRef.current = activeSource;
          setActiveSource(null);
          setTransitioning(false);
        }, 200);
      }
    }
  }, [nextSource, activeSource, transitioning]);

  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  // All hooks must run on every render. The early-exit guard is after diState below.
  /* ── Build state from active source ── */
  const diState = useMemo((): DIState | null => {
    // During transition where activeSource hasn't been set yet, use nextSource
    const src = (transitioning && activeSource === null) ? nextSource : (transitioning ? activeSource : nextSource);
    if (!src) return null;

    switch (src) {
      case 'ai':
        return {
          source: 'ai',
          icon: '🌙',
          title: aiState === 'thinking' ? 'LUNARIS 思考中' : 'LUNARIS 回覆中',
          subtitle: `Step ${aiStep}`,
          progress: -1,
        };
      case 'focus':
        return {
          source: 'focus',
          icon: '🎯',
          title: focusStatus === 'paused' ? '專注已暫停' : '專注中',
          subtitle: `${Math.ceil(focusRemaining / 60)}min 剩餘`,
          progress: focusDuration > 0 ? (focusRemaining / (focusDuration * 60)) : 0,
          actionLabel: focusStatus === 'paused' ? '繼續' : '結束',
          onAction: focusStatus === 'paused' ? useFocusSessionStore.getState().resumeSession : () => endSession(),
        };
      case 'music':
        return {
          source: 'music',
          icon: '♪',
          title: track ? getTrackDisplayName(track) : '',
          subtitle: isPlaying ? '播放中' : '已暫停',
          progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
          actionLabel: isPlaying ? '暫停' : '播放',
          onAction: togglePlay,
        };
      case 'sleep':
        return {
          source: 'sleep',
          icon: '😴',
          title: '睡眠收據已生成',
          subtitle: `Score ${todaySleepReceipt?.sleepScore ?? '—'}`,
          progress: (todaySleepReceipt?.sleepScore ?? 0) / 100,
          actionLabel: '查看',
          onAction: () => {
            // Dispatch custom event for SleepReceiptWidget to handle
            window.dispatchEvent(new CustomEvent('lunartide:show-sleep-receipt', { detail: todaySleepReceipt?.id }));
          },
        };
      default:
        return null;
    }
  }, [activeSource, nextSource, transitioning, aiState, aiStep, focusStatus, focusRemaining, focusDuration, track, isPlaying, currentTime, duration, todaySleepReceipt, togglePlay, endSession]);

  // During cross-fade, show the OLD state (fading out) or NEW state (fading in)
  const displayState = diState || (activeSource ? {
    source: activeSource,
    icon: '',
    title: '',
    subtitle: '',
    progress: 0,
  } as DIState : null);

  if (!displayState) return null;

  const isAnimating = displayState.progress < 0; // indeterminate

  const coverEl = displayState.source === 'music' && track?.customCover ? (
    <img src={track.customCover} alt="" />
  ) : (
    <span className="di-cover-emoji">{displayState.icon}</span>
  );

  return (
    <div
      className={`dynamic-island di-source--${displayState.source}${expanded ? ' is-expanded' : ''}${transitioning ? ' di-transitioning' : ''}`}
      onClick={toggleExpanded}
      role="button"
      tabIndex={0}
      aria-label={`${displayState.title} — ${displayState.subtitle}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }}
    >
      <div className="di-compact">
        <div className="di-cover">{coverEl}</div>
        <div className="di-text">
          <span className="di-title">{displayState.title}</span>
          <span className="di-subtitle">{displayState.subtitle}</span>
        </div>
        <div className="di-divider" />
        {displayState.onAction ? (
          <button
            type="button"
            className="di-action-btn"
            onClick={(e) => { e.stopPropagation(); displayState.onAction?.(); }}
            aria-label={displayState.actionLabel}
          >
            {displayState.source === 'music' ? (
              isPlaying ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="8,5 19,12 8,19" />
                </svg>
              )
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600 }}>{displayState.actionLabel}</span>
            )}
          </button>
        ) : (
          displayState.source === 'ai' && (
            <div className="di-thinking-pulse" />
          )
        )}
      </div>

      {expanded && (
        <div className="di-expanded">
          <div className={`di-progress-track${isAnimating ? ' di-progress--indeterminate' : ''}`}>
            {isAnimating ? (
              <div className="di-progress-indeterminate" />
            ) : (
              <div className="di-progress-fill" style={{ width: `${displayState.progress * 100}%` }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
