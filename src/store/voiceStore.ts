/**
 * Voice / Suno clip store — AI-generated audio runtime.
 *
 * Owns the voice audio element + queue. Does NOT know about musicStore —
 * cross-source focus coordination is handled by AudioManager, which observes
 * this store's transitions and pauses/resumes music as needed.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VoiceClip } from '@/types';

/* ══════════════════════════════════════
   Module-level audio singleton (voice)
   ══════════════════════════════════════ */
let _audio: HTMLAudioElement | null = null;
let _initialized = false;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'metadata';
  }
  return _audio;
}

/* ── Init audio events once ── */
function initAudio() {
  if (_initialized) return;
  _initialized = true;
  const audio = getAudio();
  audio.addEventListener('timeupdate', () => {
    useVoiceStore.setState({ currentTime: audio.currentTime });
  });
  audio.addEventListener('loadedmetadata', () => {
    useVoiceStore.setState({
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  });
  audio.addEventListener('play', () => useVoiceStore.setState({ isPlaying: true }));
  audio.addEventListener('pause', () => useVoiceStore.setState({ isPlaying: false }));
  audio.addEventListener('ended', () => {
    const s = useVoiceStore.getState();
    // Advance the queue; if nothing left, just stop.
    const idx = s.queue.findIndex((c) => c.id === s.currentClip?.id);
    const nextClip = s.queue[idx + 1] ?? null;
    if (nextClip) {
      useVoiceStore.getState()._loadClip(nextClip, /* autoplay */ true);
    } else {
      useVoiceStore.setState({ isPlaying: false, currentTime: 0 });
    }
  });
}

interface VoiceStoreState {
  /* persisted */
  queue: VoiceClip[];
  lastClipId: string | null;
  /* runtime (not persisted) */
  currentClip: VoiceClip | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface VoiceStoreActions {
  /** Play a single clip (replaces the queue with just this clip). */
  playClip: (clip: VoiceClip) => void;
  /** Append a clip to the queue. */
  enqueue: (clip: VoiceClip) => void;
  /** Replace the entire queue and start playing the first item. */
  playQueue: (clips: VoiceClip[], startIndex?: number) => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  next: () => void;
  previous: () => void;
  /** Internal: load a clip into the audio element. */
  _loadClip: (clip: VoiceClip, autoplay: boolean) => void;
}

type VoiceStore = VoiceStoreState & VoiceStoreActions;

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set, get) => {
      initAudio();
      return {
        /* persisted */
        queue: [],
        lastClipId: null,
        /* runtime */
        currentClip: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,

        /* ── Actions ── */
        playClip: (clip) => {
          set({ queue: [clip], lastClipId: clip.id, currentTime: 0, duration: clip.duration ?? 0 });
          get()._loadClip(clip, true);
        },

        enqueue: (clip) => {
          const s = get();
          const exists = s.queue.some((c) => c.id === clip.id);
          const nextQueue = exists ? s.queue : [...s.queue, clip];
          set({ queue: nextQueue });
          // If nothing is currently playing, start this clip.
          if (!s.currentClip) {
            set({ lastClipId: clip.id });
            get()._loadClip(clip, true);
          }
        },

        playQueue: (clips, startIndex = 0) => {
          if (clips.length === 0) return;
          const start = clips[Math.min(startIndex, clips.length - 1)];
          set({
            queue: clips,
            lastClipId: start.id,
            currentTime: 0,
            duration: start.duration ?? 0,
          });
          get()._loadClip(start, true);
        },

        togglePlay: () => {
          const s = get();
          if (!s.currentClip) {
            // Resume last clip from queue if available
            const resume = s.queue.find((c) => c.id === s.lastClipId) ?? s.queue[0] ?? null;
            if (resume) {
              get()._loadClip(resume, true);
            }
            return;
          }
          const audio = getAudio();
          if (s.isPlaying) {
            audio.pause();
          } else {
            audio.play().catch(() => {
              set({ isPlaying: false });
            });
          }
        },

        stop: () => {
          const a = getAudio();
          a.pause();
          a.currentTime = 0;
          // Clearing currentClip signals "voice abandoned focus" to AudioManager.
          set({ isPlaying: false, currentTime: 0, currentClip: null });
        },

        seek: (time) => {
          const a = getAudio();
          if (!Number.isFinite(time)) return;
          const dur = a.duration || get().duration || 0;
          const t = Math.max(0, Math.min(time, dur));
          a.currentTime = t;
          set({ currentTime: t });
        },

        next: () => {
          const s = get();
          const idx = s.queue.findIndex((c) => c.id === s.currentClip?.id);
          const nextClip = s.queue[idx + 1] ?? null;
          if (nextClip) {
            set({ lastClipId: nextClip.id, currentTime: 0, duration: nextClip.duration ?? 0 });
            get()._loadClip(nextClip, true);
          }
        },

        previous: () => {
          const s = get();
          if (s.currentTime > 3) {
            getAudio().currentTime = 0;
            set({ currentTime: 0 });
            return;
          }
          const idx = s.queue.findIndex((c) => c.id === s.currentClip?.id);
          const prev = idx > 0 ? s.queue[idx - 1] : null;
          if (prev) {
            set({ lastClipId: prev.id, currentTime: 0, duration: prev.duration ?? 0 });
            get()._loadClip(prev, true);
          }
        },

        _loadClip: (clip, autoplay) => {
          const audio = getAudio();
          audio.pause();
          audio.removeAttribute('src');
          set({
            currentClip: clip,
            currentTime: 0,
            duration: clip.duration ?? 0,
            isPlaying: false,
          });
          // Validate URL before assigning — guard against malformed input.
          if (!clip.url || typeof clip.url !== 'string') {
            set({ currentClip: null });
            return;
          }
          try {
            audio.src = clip.url;
            audio.load();
            if (autoplay) {
              // Some browsers reject play() without user gesture; surface gracefully.
              audio.play().catch(() => {
                set({ isPlaying: false });
              });
            }
          } catch {
            set({ currentClip: null });
          }
        },
      };
    },
    {
      name: 'lunartide_voice_store',
      partialize: (state) => ({
        queue: state.queue,
        lastClipId: state.lastClipId,
      }),
    },
  ),
);

/* ── Convenience: play a clip from anywhere (chat, TTS, Suno hook) ── */
export function playVoiceClip(clip: VoiceClip): void {
  useVoiceStore.getState().playClip(clip);
}

/** True when a voice clip is loaded (playing or paused with progress). */
export function isVoiceActive(): boolean {
  const s = useVoiceStore.getState();
  return s.currentClip !== null;
}
