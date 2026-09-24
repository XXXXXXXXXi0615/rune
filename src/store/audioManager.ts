/**
 * AudioManager — transactional audio focus controller.
 *
 * Sits above musicStore + voiceStore and enforces OS-level audio focus rules
 * via atomic state transitions. All cross-store mutations go through
 * `transition()`, which suppresses subscription handlers during the commit so
 * intermediate states are never observed.
 *
 * ══════════════════════════════════════
 * Architecture
 * ══════════════════════════════════════
 *
 *   AudioEventQueue (dispatcher)
 *     └─ transition() — atomic gate, increments _transitionDepth
 *         ├─ Compute desired audioManager state
 *         ├─ Apply audioManager.setState()
 *         ├─ Execute store side-effects (music.pause / music.play)
 *         └─ [subscriptions suppressed throughout]
 *
 *   Subscriptions on musicStore / voiceStore:
 *     - Skip when _transitionDepth > 0 (intermediate state)
 *     - Skip when _expectingMusicResume && music.isPlaying just became true
 *       (AudioManager already committed the final state; async play() is
 *       just catching up)
 *
 * ══════════════════════════════════════
 * Priority: voice > music > ambient
 * ══════════════════════════════════════
 *
 *   - Voice starts → music paused, wasMusicPlayingBeforeVoice recorded.
 *   - Voice ends → music auto-resumes ONLY if it was playing before.
 *   - Only one source is "active" at a time.
 *
 * ══════════════════════════════════════
 * Player API
 * ══════════════════════════════════════
 *
 *   Players import from here, not from musicStore / voiceStore directly:
 *     - useMusicAudio() — music state + actions + isActive/isSuppressed
 *     - useVoiceAudio() — voice state + actions + isActive/hasClip
 *     - useActiveAudioSource() — activeSource subscription
 *     - playVoiceClip(clip) — play a clip from anywhere
 *     - sourceBadge(source) — voice source → badge glyph + i18n key
 */
import { create } from 'zustand';
import { useMusicStore } from '@/store/musicStore';
import { useVoiceStore } from '@/store/voiceStore';
import type { VoiceClip, VoiceClipSource } from '@/types';

/* ══════════════════════════════════════
   Part 1: AudioEventQueue & Transaction Gate
   ══════════════════════════════════════ */

/**
 * Lightweight event dispatcher that gates cross-store mutations.
 *
 * Call `transition(fn)` to atomically commit a batch of state changes.
 * While the batch is executing:
 *   - `isTransitioning` returns true
 *   - Subscription handlers on musicStore / voiceStore skip all logic
 *   - Only the committed (final) state is visible to external observers
 *
 * No queuing is needed because JavaScript is single-threaded — transitions
 * are serialised by the call stack. The depth counter supports nested
 * transitions (one transition calling another).
 */
class AudioEventQueue {
  private _depth = 0;

  get isTransitioning(): boolean {
    return this._depth > 0;
  }

  /** Execute fn atomically. Subscriptions are suppressed for its duration. */
  dispatch(fn: () => void): void {
    this._depth++;
    try {
      fn();
    } finally {
      this._depth--;
    }
  }
}

const queue = new AudioEventQueue();

/**
 * Execute an atomic audio state transition.
 * All musicStore / voiceStore subscription handlers are suppressed while fn
 * runs, and intermediate store states are never observed by AudioManager.
 */
function transition(fn: () => void): void {
  queue.dispatch(fn);
}

/**
 * When AudioManager intentionally resumes music (after voice ends), the
 * `play()` call is async — the audio 'play' event fires AFTER the transition
 * has finished. We set this flag so the music subscription knows to skip:
 * AudioManager already committed the final state.
 */
let _expectingMusicResume = false;

/* ══════════════════════════════════════
   Part 2: AudioManager Store (Focus State)
   ══════════════════════════════════════ */

export type AudioSource = 'voice' | 'music' | 'ambient';

interface AudioManagerState {
  activeSource: AudioSource | null;
  previousSource: AudioSource | null;
  wasMusicPlayingBeforeVoice: boolean;
}

interface AudioManagerActions {
  /** Atomically acquire voice focus: record music state, set voice active, pause music. */
  _voiceStarted: () => void;
  /** Atomically release voice focus: resume music if it was playing. */
  _voiceCleared: () => void;
  /** Manually request focus for a source. */
  requestFocus: (source: AudioSource) => void;
  /** Manually release focus for a source. */
  abandonFocus: (source: AudioSource) => void;
}

type AudioManager = AudioManagerState & AudioManagerActions;

export const useAudioManager = create<AudioManager>((set, get) => ({
  activeSource: null,
  previousSource: null,
  wasMusicPlayingBeforeVoice: false,

  /* ── Atomic: voice acquires focus ── */
  _voiceStarted: () => {
    transition(() => {
      const musicState = useMusicStore.getState();
      const wasMusic = musicState.isPlaying;
      // Commit AudioManager state FIRST, then pause music. Order matters:
      // pause() triggers musicStore.subscribe synchronously, but `transition()`
      // suppresses it (isTransitioning === true → subscription skips).
      // If we paused before committing, musicStore would have no idea why.
      set((s) => ({
        wasMusicPlayingBeforeVoice: wasMusic || s.wasMusicPlayingBeforeVoice,
        previousSource: s.activeSource,
        activeSource: 'voice',
      }));
      if (wasMusic) musicState.pause();
    });
  },

  /* ── Atomic: voice releases focus ── */
  _voiceCleared: () => {
    transition(() => {
      const s = get();
      const shouldResume = s.wasMusicPlayingBeforeVoice;
      set({
        wasMusicPlayingBeforeVoice: false,
        previousSource: 'voice',
        activeSource: shouldResume ? 'music' : null,
      });
      if (shouldResume) {
        // `play()` is async — will fire 'play' event after transition ends.
        // The music subscription handles this via _expectingMusicResume.
        _expectingMusicResume = true;
        useMusicStore.getState().play().catch(() => {
          _expectingMusicResume = false;
        });
      }
    });
  },

  /* ── Manual focus request ── */
  requestFocus: (source) => {
    transition(() => {
      const s = get();
      if (source === 'voice') {
        const wasMusic = useMusicStore.getState().isPlaying;
        set({
          wasMusicPlayingBeforeVoice: wasMusic || s.wasMusicPlayingBeforeVoice,
          previousSource: s.activeSource,
          activeSource: 'voice',
        });
        if (wasMusic) useMusicStore.getState().pause();
        return;
      }
      if (source === 'music') {
        if (s.activeSource === 'voice') return; // voice wins
        set({ previousSource: s.activeSource, activeSource: 'music' });
        return;
      }
      // ambient
      set({ previousSource: s.activeSource, activeSource: source });
    });
  },

  /* ── Manual focus release ── */
  abandonFocus: (source) => {
    transition(() => {
      const s = get();
      if (s.activeSource !== source) return;
      if (source === 'voice' && s.wasMusicPlayingBeforeVoice) {
        set({
          wasMusicPlayingBeforeVoice: false,
          previousSource: 'voice',
          activeSource: 'music',
        });
        _expectingMusicResume = true;
        useMusicStore.getState().play().catch(() => {
          _expectingMusicResume = false;
        });
        return;
      }
      set({ previousSource: source, activeSource: null });
    });
  },
}));

/* ══════════════════════════════════════
   Part 3: Guarded Auto-Coordination Subscriptions
   ══════════════════════════════════════

   These subscribers observe musicStore / voiceStore to detect EXTERNAL
   changes (user clicked play in Music page, voice clip ended naturally,
   etc.). They MUST NOT react to state changes that AudioManager itself
   triggered during a transition — that would create feedback loops and
   race conditions.

   Guards:
     1. `queue.isTransitioning` → skip (AudioManager is mid-commit)
     2. `_expectingMusicResume` → skip music:playing (async resume in flight)
   ══════════════════════════════════════ */

/* ── Voice transitions (external detection) ── */
let _prevVoicePlaying = false;
let _prevVoiceClip: VoiceClip | null = null;

useVoiceStore.subscribe((state) => {
  if (queue.isTransitioning) return; // Guard 1: skip mid-transition

  // Voice started playing (external: user clicked play voicemail, etc.)
  if (!_prevVoicePlaying && state.isPlaying) {
    // Always acquire focus — this is the authoritative path.
    useAudioManager.getState()._voiceStarted();
  }

  // Voice clip was fully cleared (external: user stopped, queue exhausted)
  if (_prevVoiceClip && !state.currentClip) {
    useAudioManager.getState()._voiceCleared();
  }

  _prevVoicePlaying = state.isPlaying;
  _prevVoiceClip = state.currentClip;
});

/* ── Music transitions (external detection) ── */
let _prevMusicPlaying = false;

useMusicStore.subscribe((state) => {
  if (queue.isTransitioning) return; // Guard 1: skip mid-transition

  const am = useAudioManager.getState();

  // Guard 2: AudioManager just called play() after voice ended. The audio
  // 'play' event fired asynchronously — AudioManager already committed the
  // correct state. Acknowledge and skip.
  if (_expectingMusicResume && !_prevMusicPlaying && state.isPlaying) {
    _expectingMusicResume = false;
    _prevMusicPlaying = true;
    return;
  }

  // Music started playing (external: user clicked play in Music page, etc.)
  if (!_prevMusicPlaying && state.isPlaying) {
    if (am.activeSource !== 'voice') {
      useAudioManager.setState({
        previousSource: am.activeSource,
        activeSource: 'music',
      });
    }
  }

  // Music paused (external: user clicked pause, track ended, etc.)
  if (_prevMusicPlaying && !state.isPlaying) {
    const cur = useAudioManager.getState();
    if (cur.activeSource === 'music') {
      useAudioManager.setState({
        previousSource: 'music',
        activeSource: null,
      });
    }
  }

  _prevMusicPlaying = state.isPlaying;
});

/* ══════════════════════════════════════
   Part 4: Player-Facing Selector Hooks
   ══════════════════════════════════════ */

/**
 * Music slice for player UIs. Wraps musicStore with focus awareness.
 * MiniPlayer should use this instead of importing musicStore directly.
 */
export function useMusicAudio() {
  const tracks = useMusicStore((s) => s.tracks);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);
  const volume = useMusicStore((s) => s.volume);
  const shuffle = useMusicStore((s) => s.shuffle);
  const loopMode = useMusicStore((s) => s.loopMode);
  const favorites = useMusicStore((s) => s.favorites);
  const isLoading = useMusicStore((s) => s.isLoading);
  const error = useMusicStore((s) => s.error);

  const togglePlay = useMusicStore((s) => s.togglePlay);
  const play = useMusicStore((s) => s.play);
  const pause = useMusicStore((s) => s.pause);
  const previous = useMusicStore((s) => s.previous);
  const next = useMusicStore((s) => s.next);
  const stop = useMusicStore((s) => s.stop);
  const seek = useMusicStore((s) => s.seek);
  const setVolume = useMusicStore((s) => s.setVolume);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const cycleLoopMode = useMusicStore((s) => s.cycleLoopMode);
  const toggleFavorite = useMusicStore((s) => s.toggleFavorite);
  const selectTrack = useMusicStore((s) => s.selectTrack);

  const activeSource = useAudioManager((s) => s.activeSource);
  const currentTrack = tracks.find((t) => t.id === currentTrackId) ?? null;

  return {
    tracks,
    currentTrack,
    currentTrackId,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    loopMode,
    favorites,
    isLoading,
    error,
    togglePlay,
    play,
    pause,
    previous,
    next,
    stop,
    seek,
    setVolume,
    toggleShuffle,
    cycleLoopMode,
    toggleFavorite,
    selectTrack,
    activeSource,
    isActive: activeSource === 'music',
    /** True when voice currently has focus (music is suppressed). */
    isSuppressed: activeSource === 'voice',
  };
}

/**
 * Voice slice for player UIs. Wraps voiceStore with focus awareness.
 * FloatingAudioPlayer should use this instead of importing voiceStore directly.
 */
export function useVoiceAudio() {
  const currentClip = useVoiceStore((s) => s.currentClip);
  const isPlaying = useVoiceStore((s) => s.isPlaying);
  const currentTime = useVoiceStore((s) => s.currentTime);
  const duration = useVoiceStore((s) => s.duration);
  const queue = useVoiceStore((s) => s.queue);

  const playClip = useVoiceStore((s) => s.playClip);
  const enqueue = useVoiceStore((s) => s.enqueue);
  const playQueue = useVoiceStore((s) => s.playQueue);
  const togglePlay = useVoiceStore((s) => s.togglePlay);
  const stop = useVoiceStore((s) => s.stop);
  const seek = useVoiceStore((s) => s.seek);
  const next = useVoiceStore((s) => s.next);
  const previous = useVoiceStore((s) => s.previous);

  const activeSource = useAudioManager((s) => s.activeSource);

  return {
    currentClip,
    isPlaying,
    currentTime,
    duration,
    queue,
    playClip,
    enqueue,
    playQueue,
    togglePlay,
    stop,
    seek,
    next,
    previous,
    activeSource,
    isActive: activeSource === 'voice',
    hasClip: currentClip !== null,
  };
}

/** Subscribe to the active source only. */
export function useActiveAudioSource(): AudioSource | null {
  return useAudioManager((s) => s.activeSource);
}

/* ══════════════════════════════════════
   Part 5: Public Helpers
   ══════════════════════════════════════ */

/** Play a voice clip from anywhere (chat, TTS, Suno hook). */
export function playVoiceClip(clip: VoiceClip): void {
  useVoiceStore.getState().playClip(clip);
}

/** Map a clip source to badge glyph + i18n key (used by FloatingAudioPlayer). */
export function sourceBadge(source: VoiceClipSource): { glyph: string; labelKey: string } {
  switch (source) {
    case 'suno':    return { glyph: '✦', labelKey: 'audio.suno' };
    case 'tts':     return { glyph: '◎', labelKey: 'audio.tts' };
    case 'ai-voice':
    default:        return { glyph: '◈', labelKey: 'audio.aiVoice' };
  }
}
