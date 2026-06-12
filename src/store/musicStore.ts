/**
 * Global music store — survives page navigation.
 * Audio singleton at module level, never unmounted.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MusicTrack } from '@/types'
import { getAsset, saveAsset } from '@/store/assets'

/* ── Types ── */
export type LoopMode = 'off' | 'all' | 'one'

export interface RecentMusicTrack {
  id: string; title: string; displayName?: string; duration?: number; playedAt: number
}

interface MusicStoreState {
  /* persisted */
  tracks: MusicTrack[]
  currentTrackId: string | null
  volume: number
  shuffle: boolean
  loopMode: LoopMode
  favorites: string[]
  recentlyPlayed: RecentMusicTrack[]
  /* runtime (not persisted) */
  isPlaying: boolean
  currentTime: number
  duration: number
  isLoading: boolean
  error: string
}

interface MusicStoreActions {
  uploadFiles: (files: FileList | File[]) => Promise<void>
  removeTrack: (id: string) => void
  renameTrack: (id: string, newName: string) => void
  togglePlay: () => void
  play: () => Promise<void>
  pause: () => void
  previous: () => void
  next: () => void
  stop: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  cycleLoopMode: () => void
  toggleFavorite: (id: string) => void
  selectTrack: (id: string) => void
  _syncTime: (t: number) => void
  _syncDuration: (d: number) => void
  _syncPlaying: (p: boolean) => void
}

type MusicStore = MusicStoreState & MusicStoreActions
const MAX_RECENT = 20

/* ══════════════════════════════════════
   Module-level audio singleton
   ══════════════════════════════════════ */
let _audio: HTMLAudioElement | null = null
let _audioCtx: AudioContext | null = null
let _analyser: AnalyserNode | null = null
let _objectUrl: string | null = null
let _initialized = false

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio()
    _audio.preload = 'metadata'
  }
  return _audio
}

export function getMusicAnalyser(): { ctx: AudioContext; analyser: AnalyserNode } | null {
  if (!_audioCtx || !_analyser) return null
  return { ctx: _audioCtx, analyser: _analyser }
}

function ensureAnalyser() {
  if (_audioCtx) {
    // Resume suspended context (browser autoplay policy)
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {})
    }
    return
  }
  _audioCtx = new AudioContext()
  _analyser = _audioCtx.createAnalyser()
  _analyser.fftSize = 2048
  _analyser.smoothingTimeConstant = 0.88
  try {
    const source = _audioCtx.createMediaElementSource(getAudio())
    source.connect(_analyser)
    _analyser.connect(_audioCtx.destination)
  } catch {
    // Already connected — that's fine, reuse existing graph
    _analyser.connect(_audioCtx.destination)
  }
}

/** Track whether the audio element has a loaded src ready to play */
let _audioReady = false

function loadIntoAudio(track: MusicTrack) {
  const audio = getAudio()
  audio.pause()
  _audioReady = false
  if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null }
  audio.removeAttribute('src')

  getAsset(track.assetId).then(blob => {
    if (!blob) {
      useMusicStore.setState({ error: '找不到音訊檔案。', isLoading: false })
      _audioReady = false
      return
    }
    _objectUrl = URL.createObjectURL(blob)
    audio.src = _objectUrl
    audio.load()
    _audioReady = true
    useMusicStore.setState({ duration: track.duration ?? 0, isLoading: false })
  }).catch(() => {
    useMusicStore.setState({ error: '音訊載入失敗。', isLoading: false })
    _audioReady = false
  })
}

function getTracks(): MusicTrack[] { return useMusicStore.getState().tracks }
function getCurrentTrack(): MusicTrack | null {
  const s = useMusicStore.getState()
  return s.tracks.find(t => t.id === s.currentTrackId) ?? s.tracks[0] ?? null
}

function chooseNextIndex(): number {
  const s = useMusicStore.getState()
  const track = getCurrentTrack()
  const idx = track ? s.tracks.findIndex(t => t.id === track.id) : -1
  if (s.tracks.length === 0) return -1
  if (s.shuffle && s.tracks.length > 1) {
    let n = Math.floor(Math.random() * s.tracks.length)
    if (n === idx) n = (n + 1) % s.tracks.length
    return n
  }
  if (idx < s.tracks.length - 1) return idx + 1
  return s.loopMode === 'all' ? 0 : -1
}

/* ── Init audio events once ── */
function initAudio() {
  if (_initialized) return
  _initialized = true
  const audio = getAudio()
  audio.addEventListener('timeupdate', () => useMusicStore.setState({ currentTime: audio.currentTime }))
  audio.addEventListener('loadedmetadata', () => useMusicStore.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }))
  audio.addEventListener('play', () => useMusicStore.setState({ isPlaying: true }))
  audio.addEventListener('pause', () => useMusicStore.setState({ isPlaying: false }))
  audio.addEventListener('ended', () => {
    const s = useMusicStore.getState()
    if (s.loopMode === 'one') {
      audio.currentTime = 0
      audio.play().catch(() => {})
      return
    }
    const idx = chooseNextIndex()
    if (idx >= 0) {
      useMusicStore.setState({ currentTrackId: s.tracks[idx].id })
    } else {
      useMusicStore.setState({ isPlaying: false })
    }
  })
}

/* ── Helpers ── */
function isInternalId(name: string): boolean {
  // Detect internal IDs like Aud1780886379279, UUIDs, or purely numeric/hex names
  if (/^(Aud|Blob|File|audio|tmp)\d{10,}$/i.test(name)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) return true;
  if (/^\d{10,}$/.test(name)) return true;
  return false;
}

function formatTrackTitle(fileName: string): string {
  const raw = fileName.replace(/\.[^.]+$/, '') || fileName;
  return isInternalId(raw) ? '' : raw;
}

/** Resolve the display name for a track: displayName > title > '未命名音訊' */
export function getTrackDisplayName(track: { title: string; displayName?: string }): string {
  if (track.displayName && track.displayName.trim() && !isInternalId(track.displayName.trim())) return track.displayName.trim();
  const t = track.title?.trim();
  if (t && !isInternalId(t)) return t;
  return '未命名音訊';
}

function readDuration(file: Blob): Promise<number | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    const cleanup = () => { URL.revokeObjectURL(url); a.removeAttribute('src') }
    a.onloadedmetadata = () => { const d = Number.isFinite(a.duration) ? a.duration : undefined; cleanup(); resolve(d) }
    a.onerror = () => { cleanup(); resolve(undefined) }
    a.src = url
  })
}

/* ══════════════════════════════════════
   Store
   ══════════════════════════════════════ */
export const useMusicStore = create<MusicStore>()(
  persist(
    (set, get) => {
      initAudio()
      return {
        /* persisted */
        tracks: [],
        currentTrackId: null,
        volume: 0.8,
        shuffle: false,
        loopMode: 'off' as LoopMode,
        favorites: [] as string[],
        recentlyPlayed: [] as RecentMusicTrack[],
        /* runtime */
        isPlaying: false, currentTime: 0, duration: 0, isLoading: false, error: '',

        /* ── Actions ── */
        uploadFiles: async (files) => {
          const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/'))
          if (audioFiles.length === 0) { set({ error: '請選擇音訊檔案。' }); return }
          set({ isLoading: true, error: '' })
          try {
            // Build tracks immediately — set first file's audio src NOW for instant playback
            const newTracks: MusicTrack[] = []
            for (let i = 0; i < audioFiles.length; i++) {
              const file = audioFiles[i]
              const id = crypto.randomUUID()
              const dur = await readDuration(file)
              // Set the FIRST file as audio.src immediately so play() works right away
              if (i === 0) {
                if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null }
                _objectUrl = URL.createObjectURL(file)
                const audio = getAudio()
                audio.src = _objectUrl
                audio.load()
                audio.volume = get().volume
                _audioReady = true
              }
              // Save to IndexedDB in background for persistence
              saveAsset(file, file.type || 'audio/mpeg').then(assetId => {
                const t = newTracks.find(tr => tr.id === id)
                if (t) t.assetId = assetId
              }).catch(() => {})
              const rawTitle = formatTrackTitle(file.name);
              newTracks.push({ id, title: rawTitle, displayName: rawTitle, fileName: file.name, fileSize: file.size, fileType: file.type || 'audio/mpeg', assetId: '', duration: dur, createdAt: Date.now() })
            }
            set(s => ({ tracks: [...s.tracks, ...newTracks], currentTrackId: s.currentTrackId ?? newTracks[0]?.id ?? null, isLoading: false }))
          } catch { set({ error: '音訊匯入失敗。', isLoading: false }) }
        },

        removeTrack: (id) => {
          set(s => {
            const next = s.tracks.filter(t => t.id !== id)
            const favs = s.favorites.filter(f => f !== id)
            return { tracks: next, favorites: favs, currentTrackId: s.currentTrackId === id ? (next[0]?.id ?? null) : s.currentTrackId }
          })
        },

        renameTrack: (id, newName) => {
          set(s => ({
            tracks: s.tracks.map(t => t.id === id ? { ...t, displayName: newName } : t),
          }));
        },

        togglePlay: () => {
          const s = get()
          if (s.isPlaying) {
            getAudio().pause()
          } else {
            ensureAnalyser()
            const track = getCurrentTrack()
            if (!track) return
            // Guard: audio must have a loaded src
            if (!_audioReady) {
              set({ error: '音訊尚未載入完成，請稍後再點擊播放。' })
              // Trigger load
              set({ currentTrackId: track.id })
              loadIntoAudio(track)
              return
            }
            // Resume suspended AudioContext (browser autoplay policy)
            if (_audioCtx && _audioCtx.state === 'suspended') {
              _audioCtx.resume().catch(() => {})
            }
            const audio = getAudio()
            audio.play().catch(() => {
              set({ error: '播放失敗，請重新點擊播放。', isPlaying: false })
            })
            // update recently played (optimistic)
            set(state => {
              const next = [{ id: track.id, title: track.title, displayName: track.displayName, duration: track.duration, playedAt: Date.now() }, ...state.recentlyPlayed.filter(r => r.id !== track.id)].slice(0, MAX_RECENT)
              return { recentlyPlayed: next }
            })
          }
        },

        play: async () => {
          ensureAnalyser()
          const track = getCurrentTrack()
          if (!track) return
          if (!_audioReady) {
            set({ currentTrackId: track.id, error: '音訊尚未載入完成，請稍後再試。' })
            loadIntoAudio(track)
            return
          }
          set({ error: '' })
          if (_audioCtx && _audioCtx.state === 'suspended') {
            _audioCtx.resume().catch(() => {})
          }
          try {
            await getAudio().play()
            set(s => {
              const next = [{ id: track.id, title: track.title, displayName: track.displayName, duration: track.duration, playedAt: Date.now() }, ...s.recentlyPlayed.filter(r => r.id !== track.id)].slice(0, MAX_RECENT)
              return { recentlyPlayed: next }
            })
          } catch { set({ error: '播放失敗，請重新點擊播放。', isPlaying: false }) }
        },

        pause: () => { getAudio().pause() },

        previous: () => {
          const s = get()
          if (s.currentTime > 3 && (s.duration > 0 || getAudio().duration > 0)) {
            getAudio().currentTime = 0; set({ currentTime: 0 }); return
          }
          const track = getCurrentTrack()
          if (!track || s.tracks.length === 0) return
          const idx = s.tracks.findIndex(t => t.id === track.id)
          const prev = idx > 0 ? idx - 1 : s.tracks.length - 1
          set({ currentTrackId: s.tracks[prev].id })
        },

        next: () => {
          const idx = chooseNextIndex()
          const s = get()
          if (idx >= 0 && s.tracks[idx]) {
            set({ currentTrackId: s.tracks[idx].id })
          } else {
            getAudio().pause()
            set({ isPlaying: false })
          }
        },

        stop: () => {
          const a = getAudio()
          a.pause(); a.currentTime = 0
          set({ currentTime: 0, isPlaying: false })
        },

        seek: (time) => {
          const a = getAudio()
          if (!Number.isFinite(time)) return
          const dur = a.duration || get().duration || 0
          const t = Math.max(0, Math.min(time, dur))
          a.currentTime = t
          set({ currentTime: t })
        },

        setVolume: (v) => {
          const safe = Math.max(0, Math.min(1, v))
          getAudio().volume = safe
          set({ volume: safe })
        },

        toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
        cycleLoopMode: () => set(s => ({ loopMode: s.loopMode === 'off' ? 'all' : s.loopMode === 'all' ? 'one' : 'off' })),
        toggleFavorite: (id) => set(s => ({ favorites: s.favorites.includes(id) ? s.favorites.filter(f => f !== id) : [...s.favorites, id] })),
        selectTrack: (id) => set({ currentTrackId: id }),
        _syncTime: (t) => set({ currentTime: t }),
        _syncDuration: (d) => set({ duration: d }),
        _syncPlaying: (p) => set({ isPlaying: p }),
      }
    },
    {
      name: 'lunartide_music_store',
      partialize: (state) => ({
        tracks: state.tracks,
        currentTrackId: state.currentTrackId,
        volume: state.volume,
        shuffle: state.shuffle,
        loopMode: state.loopMode,
        favorites: state.favorites,
        recentlyPlayed: state.recentlyPlayed,
      }),
    }
  )
)

/* ── React to currentTrackId changes ── */
useMusicStore.subscribe((state, prev) => {
  if (state.currentTrackId !== prev.currentTrackId && state.currentTrackId) {
    const track = state.tracks.find(t => t.id === state.currentTrackId)
    if (track) {
      // Skip reload if audio is already ready (immediate upload path)
      if (_audioReady) {
        const audio = getAudio()
        useMusicStore.setState({ duration: audio.duration || track.duration || 0, isLoading: false, error: '' })
        return
      }
      useMusicStore.setState({ isLoading: true, error: '' })
      loadIntoAudio(track)
    }
  }
})

/* ── Sync volume ── */
useMusicStore.subscribe((state, prev) => {
  if (state.volume !== prev.volume && _audio) {
    _audio.volume = state.volume
  }
})
