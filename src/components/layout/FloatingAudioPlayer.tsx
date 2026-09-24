/**
 * FloatingAudioPlayer — unified draggable floating player.
 *
 * Renders the voice/Suno clip card when a clip is loaded and otherwise stays
 * unmounted. Music playback is surfaced separately by the top MusicIsland.
 *   - Voice clips interrupt music (AudioManager pauses music on voice focus).
 *   - The voice card persists across ALL pages including /music, because
 *     the /music page only owns music playback, not voice.
 *
 * All audio state flows through AudioManager (the global focus orchestrator).
 * This component never imports musicStore or voiceStore directly — it uses the
 * `useVoiceAudio` selector hook so focus coordination stays centralized.
 *
 * Theme-aware via CSS variables. Drag logic is self-contained pointer events.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMusicTime } from '@/hooks/useAudioPlayer';
import { useVoiceAudio, sourceBadge } from '@/store/audioManager';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import './FloatingAudioPlayer.css';

const DRAG_THRESHOLD = 3;
const VIEWPORT_GAP = 12;
const POSITION_KEY = 'lunartide_floating_audio_position_v1';
const RESET_EVENT = 'lunartide:floating-audio-reset';

interface Position { x: number; y: number; }
interface DragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function getBottomDockSafeOffset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bottom-dock-safe-offset').trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 112;
}

function loadPosition(): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || '');
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
      return { x: saved.x, y: saved.y };
    }
  } catch {
    /* malformed legacy data */
  }
  // Default: bottom-right (MiniPlayer owns bottom-left by convention).
  return { x: Math.max(VIEWPORT_GAP, window.innerWidth - 292), y: window.innerHeight - getBottomDockSafeOffset() - 68 };
}

function savePosition(p: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(p));
  } catch {
    /* localStorage may be unavailable */
  }
}

export function FloatingAudioPlayer() {
  // Subscribe to language so labels re-render on locale change.
  useAppStore((s) => s.language);

  /* ── Voice slice via AudioManager (priority source) ── */
  const {
    currentClip,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    next: nextClip,
    previous: previousClip,
    stop,
    queue,
  } = useVoiceAudio();

  /* ── Drag + position state ── */
  const [initial] = useState(loadPosition);
  const [position, setPosition] = useState<Position>({ x: initial.x, y: initial.y });
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(position);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => { positionRef.current = position; }, [position]);

  const constrain = useCallback((p: Position): Position => {
    const w = playerRef.current?.offsetWidth || (minimized ? 56 : 280);
    const h = playerRef.current?.offsetHeight || 56;
    return {
      x: clamp(p.x, VIEWPORT_GAP, Math.max(VIEWPORT_GAP, window.innerWidth - w - VIEWPORT_GAP)),
      y: clamp(p.y, VIEWPORT_GAP, Math.max(VIEWPORT_GAP, window.innerHeight - h - getBottomDockSafeOffset())),
    };
  }, [minimized]);

  const persist = useCallback((p: Position) => {
    positionRef.current = p;
    setPosition(p);
    savePosition(p);
  }, []);

  /* ── Pointer drag handlers ── */
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // Don't start drag from buttons
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      moved: false,
    };
  }, []);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        drag.moved = true;
        setDragging(true);
      }
      persist(constrain({ x: drag.originX + dx, y: drag.originY + dy }));
    };
    const handleUp = () => {
      const drag = dragRef.current;
      if (drag) {
        persist(constrain(positionRef.current));
        dragRef.current = null;
      }
      setDragging(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [constrain, persist]);

  /* Re-clamp on viewport resize + after minimize toggle + on mount. */
  useEffect(() => {
    const handle = () => persist(constrain(positionRef.current));
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [constrain, persist]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => persist(constrain(positionRef.current)));
    return () => window.cancelAnimationFrame(frame);
  }, [constrain, minimized, persist]);

  /* External reset event (mirrors MiniPlayer's pattern). */
  useEffect(() => {
    const handle = () => {
      const p = { x: Math.max(VIEWPORT_GAP, window.innerWidth - 292), y: window.innerHeight - getBottomDockSafeOffset() - 68 };
      persist(p);
      setMinimized(false);
    };
    window.addEventListener(RESET_EVENT, handle);
    return () => window.removeEventListener(RESET_EVENT, handle);
  }, [persist]);

  const badge = useMemo(() => (currentClip ? sourceBadge(currentClip.source) : null), [currentClip]);
  const progress = currentClip && duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasMultipleInQueue = queue.length > 1;

  /* ── Render ── */
  // Music is represented by MusicIsland. This component owns voice clips only.
  if (!currentClip) return null;

  // Voice clip is active — render the voice card on EVERY page (incl. /music),
  // because /music only owns music playback, not AI voice/Suno clips.
  if (minimized) {
    return (
      <div
        ref={playerRef}
        className={`floating-audio floating-audio--minimized ${dragging ? 'is-dragging' : ''}`}
        style={{ left: position.x, top: position.y }}
        onPointerDown={onPointerDown}
        role="button"
        tabIndex={0}
        aria-label={t('audio.expand')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMinimized(false); } }}
      >
        <button
          type="button"
          className="floating-audio-mini-btn"
          aria-label={t('audio.expand')}
          tabIndex={-1}
        >
          <span className="floating-audio-glyph" aria-hidden="true">{badge?.glyph ?? '◈'}</span>
          {isPlaying && <span className="floating-audio-pulse" />}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={playerRef}
      className={`floating-audio ${dragging ? 'is-dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
    >
      {/* Header: badge + title + close */}
      <div className="floating-audio-head">
        <span className={`floating-audio-badge floating-audio-badge--${currentClip.source}`}>
          <span aria-hidden="true">{badge?.glyph ?? '◈'}</span>
          <span className="floating-audio-badge-label">{badge ? t(badge.labelKey) : ''}</span>
        </span>
        <button
          type="button"
          className="floating-audio-close"
          onClick={stop}
          aria-label={t('audio.close')}
          title={t('audio.close')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      {/* Cover / waveform */}
      <div className="floating-audio-cover">
        {currentClip.cover ? (
          <img src={currentClip.cover} alt="" className="floating-audio-cover-img" />
        ) : (
          <div className={`floating-audio-waveform ${isPlaying ? 'is-playing' : ''}`} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="floating-audio-meta">
        <span className="floating-audio-title">{currentClip.title}</span>
        {currentClip.subtitle && <span className="floating-audio-subtitle">{currentClip.subtitle}</span>}
      </div>

      {/* Progress */}
      <div className="floating-audio-progress">
        <div className="floating-audio-progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="floating-audio-time-row">
        <span>{formatMusicTime(currentTime)}</span>
        <span>{formatMusicTime(duration || currentClip.duration || 0)}</span>
      </div>

      {/* Controls */}
      <div className="floating-audio-controls">
        <button
          type="button"
          className="floating-audio-btn"
          onClick={previousClip}
          disabled={!hasMultipleInQueue}
          aria-label={t('audio.previous')}
          title={t('audio.previous')}
        >
          <svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>
        </button>
        <button
          type="button"
          className="floating-audio-btn play"
          onClick={togglePlay}
          aria-label={isPlaying ? t('audio.paused') : t('audio.playing')}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><polygon points="7 4 19 12 7 20" /></svg>
          )}
        </button>
        <button
          type="button"
          className="floating-audio-btn"
          onClick={nextClip}
          disabled={!hasMultipleInQueue}
          aria-label={t('audio.next')}
          title={t('audio.next')}
        >
          <svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
        </button>
        <button
          type="button"
          className="floating-audio-btn subtle"
          onClick={() => setMinimized(true)}
          aria-label={t('audio.minimize')}
          title={t('audio.minimize')}
        >
          <svg viewBox="0 0 24 24"><line x1="6" y1="12" x2="18" y2="12" /></svg>
        </button>
      </div>
    </div>
  );
}
