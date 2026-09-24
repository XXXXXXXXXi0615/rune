/**
 * Global music store — survives page navigation.
 * Audio singleton at module level, never unmounted.
 */
import { create } from 'zustand'
import { ensureAudioEffectsGraph } from '@/features/music/audioEffectsGraph'
import { persist } from 'zustand/middleware'
import type { MusicTrack } from '@/types'
import { getAsset, savePortableAsset, deleteAsset } from '@/store/assets'
import { useAppStore } from '@/store/useAppStore'

/* ── Types ── */
export type LoopMode = 'off' | 'all' | 'one'

export type MusicPlaybackSource =
  | { type: 'library' }
  | { type: 'recent' }
  | { type: 'search'; query: string }
  | { type: 'playlist'; playlistId: string };

export interface MusicPlayHistoryEntry {
  trackId: string;
  lastPlayedAt: string;
  playCount: number;
  lastSource?: MusicPlaybackSource;
}

export interface RecentMusicTrack {
  id: string; title: string; displayName?: string; duration?: number; playedAt: number
}

export interface MusicPlaylist {
  id: string
  name: string
  description?: string
  customCover?: string
  trackIds: string[]
  createdAt: string
  updatedAt: string
}

interface MusicStoreState {
  /* persisted */
  tracks: MusicTrack[]
  currentTrackId: string | null
  volume: number
  shuffle: boolean
  loopMode: LoopMode
  favorites: string[]
  playHistory: MusicPlayHistoryEntry[]
  playbackSource: MusicPlaybackSource
  recentlyPlayed: RecentMusicTrack[]
  playlists: MusicPlaylist[]
  /* runtime (not persisted) */
  isPlaying: boolean
  currentTime: number
  duration: number
  isLoading: boolean
  error: { code: string; message: string } | null
  hasHydrated: boolean
  queueTrackIds: string[] | null
}

interface MusicStoreActions {
  uploadFiles: (files: FileList | File[]) => Promise<void>
  removeTrack: (id: string) => void
  renameTrack: (id: string, newName: string) => void
  replaceTrackAsset: (trackId: string, file: File) => Promise<{ oldAssetId?: string; newAssetId: string }>
  reloadTrack: (trackId: string) => Promise<void>
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
  playFromSource: (trackId: string, source: MusicPlaybackSource, queue: string[]) => void
  recordPlayback: (trackId: string) => void
  removePlayHistory: (trackId: string) => void
  clearPlayHistory: () => void
  setQueue: (trackIds: string[]) => void
  reorderQueue: (fromIdx: number, toIdx: number) => void
  removeFromQueue: (trackId: string) => void
  setTrackCustomCover: (trackId: string, dataUrl?: string) => void
  /* playlist actions */
  createPlaylist: (name: string, description?: string, trackIds?: string[], customCover?: string) => string
  updatePlaylist: (id: string, patch: Partial<Pick<MusicPlaylist, 'name' | 'description' | 'customCover'>>) => void
  deletePlaylist: (id: string) => void
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => void
  removeTracksFromPlaylist: (playlistId: string, trackIds: string[]) => void
  reorderPlaylistTracks: (playlistId: string, fromIdx: number, toIdx: number) => void
  setPlaylistQueue: (trackIds: string[]) => void
  clearPlaylistQueue: () => void
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
let _source: MediaElementAudioSourceNode | null = null
let _objectUrl: string | null = null
let _initialized = false

/* Dedup music_played activity logs — same track within 5 min */
let _lastMusicLogTime = 0
let _lastMusicLogTrackId: string | null = null
const MUSIC_LOG_DEDUP_MS = 300000

/* Debounce play-history recording — same track within 5 s */
let _lastHistoryTime = 0
let _lastHistoryTrackId: string | null = null
const HISTORY_DEBOUNCE_MS = 5000

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio()
    _audio.preload = 'metadata'
    try { (window as any).__e2e_musicAudio = _audio } catch {}
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
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return
  _audioCtx = new AudioContextConstructor()
  _analyser = _audioCtx.createAnalyser()
  _analyser.fftSize = 2048
  _analyser.smoothingTimeConstant = 0.88
  try {
    _source = _audioCtx.createMediaElementSource(getAudio())
    _source.connect(_analyser)
    ensureAudioEffectsGraph(_audioCtx, _analyser)
  } catch {
    // createMediaElementSource can only be called once per element.
    // If it throws, the existing graph is still valid — just ensure analyser → destination.
    ensureAudioEffectsGraph(_audioCtx, _analyser)
  }
}

/** Track whether the audio element has a loaded src ready to play */
let _audioReady = false
/** Track which track id was loaded into the audio element */
let _loadedTrackId: string | null = null
/** Monotonic sequence counter for loadIntoAudio race prevention */
let _loadSequence = 0

async function loadIntoAudio(track: MusicTrack) {
  const audio = getAudio()
  audio.pause()
  _audioReady = false
  _loadedTrackId = null
  if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null }
  audio.removeAttribute('src')

  ensureAnalyser()

  const sequence = ++_loadSequence

  // Wait for initial state flush so setState is visible before async continuation
  await Promise.resolve()

  // Guard: another load started after us
  if (sequence !== _loadSequence) return
  if (useMusicStore.getState().currentTrackId !== track.id) return

  let blob: Blob | null = null
  try {
    blob = await getAsset(track.assetId)
  } catch {
    // getAsset threw
    if (sequence !== _loadSequence) return
    useMusicStore.setState({ error: { code: 'ASSET_LOAD_FAILED', message: '音訊載入失敗。' }, isLoading: false })
    return
  }

  // Guard again after await — race may have changed state
  if (sequence !== _loadSequence) return
  if (useMusicStore.getState().currentTrackId !== track.id) return

  if (!blob) {
    useMusicStore.setState({ error: { code: 'ASSET_NOT_FOUND', message: '找不到音訊檔案。' }, isLoading: false })
    return
  }

  const objectUrl = URL.createObjectURL(blob)
  _objectUrl = objectUrl

  // Wait for real audio events — loadedmetadata, canplay, error, or timeout
  // Register listeners BEFORE setting src/load to avoid missing events
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        audio.removeEventListener('loadedmetadata', onReady);
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
      };

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const onReady = () => finish(resolve);
      const onError = () => finish(() => reject(new Error('ASSET_LOAD_FAILED')));

      const timeout = window.setTimeout(() => {
        finish(() => reject(new Error('ASSET_LOAD_TIMEOUT')));
      }, 8000);

      audio.addEventListener('loadedmetadata', onReady);
      audio.addEventListener('canplay', onReady);
      audio.addEventListener('error', onError);

      audio.src = objectUrl;
      audio.load();
    })

    // Success — verify this load is still current before committing state
    if (sequence !== _loadSequence) return
    if (useMusicStore.getState().currentTrackId !== track.id) return

    _audioReady = true
    _loadedTrackId = track.id
    useMusicStore.setState({ duration: audio.duration || track.duration || 0, isLoading: false, error: null })
  } catch (err: any) {
    // Failure — verify this load is still current before writing error
    if (sequence !== _loadSequence) return

    const code = err?.message === 'ASSET_LOAD_TIMEOUT' ? 'ASSET_LOAD_TIMEOUT' : 'ASSET_LOAD_FAILED'
    useMusicStore.setState({ error: { code, message: '音訊載入失敗。' }, isLoading: false })
  }
}

function getTracks(): MusicTrack[] { return useMusicStore.getState().tracks }
function getCurrentTrack(): MusicTrack | null {
  const s = useMusicStore.getState()
  return s.tracks.find(t => t.id === s.currentTrackId) ?? s.tracks[0] ?? null
}

function getQueueTracks(): MusicTrack[] {
  const s = useMusicStore.getState();
  if (s.queueTrackIds) {
    return s.queueTrackIds.map(id => s.tracks.find(t => t.id === id)).filter(Boolean) as MusicTrack[];
  }
  return s.tracks;
}

function chooseNextIndex(): number {
  const s = useMusicStore.getState()
  const trks = getQueueTracks()
  const track = s.tracks.find(t => t.id === s.currentTrackId)
  const idx = track ? trks.findIndex(t => t.id === track.id) : -1
  if (trks.length === 0) return -1
  if (s.shuffle && trks.length > 1) {
    let n = Math.floor(Math.random() * trks.length)
    if (n === idx) n = (n + 1) % trks.length
    return s.tracks.findIndex(t => t.id === trks[n].id);
  }
  if (idx < trks.length - 1) return s.tracks.findIndex(t => t.id === trks[idx + 1].id);
  return s.loopMode === 'all' ? s.tracks.findIndex(t => t.id === trks[0].id) : -1;
}

/* ── Init audio events once ── */
function initAudio() {
  if (_initialized) return
  _initialized = true
  const audio = getAudio()
  audio.addEventListener('timeupdate', () => useMusicStore.setState({ currentTime: audio.currentTime }))
  audio.addEventListener('loadedmetadata', () => useMusicStore.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }))
  audio.addEventListener('play', () => {
    useMusicStore.setState({ isPlaying: true })
    /* Record playback history (debounced) */
    const playingTrack = getCurrentTrack()
    if (playingTrack && (playingTrack.id !== _lastHistoryTrackId || Date.now() - _lastHistoryTime > HISTORY_DEBOUNCE_MS)) {
      _lastHistoryTime = Date.now()
      _lastHistoryTrackId = playingTrack.id
      useMusicStore.getState().recordPlayback(playingTrack.id)
    }
    /* Activity log: music_played (dedup same track within 5 min) */
    const track = getCurrentTrack()
    if (track && (track.id !== _lastMusicLogTrackId || Date.now() - _lastMusicLogTime > MUSIC_LOG_DEDUP_MS)) {
      _lastMusicLogTime = Date.now()
      _lastMusicLogTrackId = track.id
      try {
        useAppStore.getState().addActivityLog({
          type: 'music',
          title: 'music_played',
          detail: getTrackDisplayName(track),
          route: '/music',
          level: 'info',
        })
      } catch { /* store may not be ready */ }
    }
  })
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
  // Replace underscores with spaces
  const cleaned = raw.replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return isInternalId(cleaned) ? '' : cleaned;
}

function extractArtist(fileName: string): string | undefined {
  const raw = fileName.replace(/\.[^.]+$/, '') || fileName;
  // Try "Artist - Title" or "Artist — Title" pattern
  const dashMatch = raw.match(/^(.+?)\s+[-—–]\s+(.+)$/);
  if (dashMatch) {
    const artist = dashMatch[1].replace(/_/g, ' ').trim();
    if (artist.length > 0 && artist.length < 80 && !isInternalId(artist)) {
      return artist;
    }
  }
  return undefined;
}

function extractTitleFromName(fileName: string): string | undefined {
  const raw = fileName.replace(/\.[^.]+$/, '') || fileName;
  const dashMatch = raw.match(/^(.+?)\s+[-—–]\s+(.+)$/);
  if (dashMatch) {
    const title = dashMatch[2].replace(/_/g, ' ').trim();
    if (title.length > 0 && !isInternalId(title)) return title;
  }
  return undefined;
}

/** Resolve the display name for a track: displayName > title > fileName-normalized > '未命名音訊' */
export function getTrackDisplayName(track: { title: string; displayName?: string }): string {
  if (track.displayName && track.displayName.trim() && !isInternalId(track.displayName.trim())) return track.displayName.trim();
  const t = track.title?.trim();
  if (t && !isInternalId(t)) return t;
  return '未命名音訊';
}

/** Unified display title: normalize and clean filename-based names */
export function getTrackDisplayTitle(track: {
  displayName?: string; title?: string; fileName?: string;
}): string {
  if (track.displayName?.trim()) return track.displayName.trim();
  if (track.title?.trim() && track.title !== '未命名音訊') {
    const t = track.title.trim();
    const cleaned = t.replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (cleaned && !isInternalId(cleaned)) return cleaned;
  }
  if (track.fileName) {
    const noExt = track.fileName.replace(/\.[^.]+$/, '');
    const cleaned = noExt.replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (cleaned && !isInternalId(cleaned)) return cleaned;
  }
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
        playHistory: [] as MusicPlayHistoryEntry[],
        playbackSource: { type: 'library' } as MusicPlaybackSource,
        recentlyPlayed: [] as RecentMusicTrack[],
        playlists: [] as MusicPlaylist[],
        /* runtime */
        isPlaying: false, currentTime: 0, duration: 0, isLoading: false, error: null, hasHydrated: false, queueTrackIds: null,

        /* ── Actions ── */
        uploadFiles: async (files) => {
    const audio = getAudio()
    const arr = Array.from(files)
    const audioFiles = arr.filter(f => f.type.startsWith('audio/'))
    const unsupportedFiles: string[] = []
    const audioLikeFiles = arr.filter(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      return !f.type.startsWith('audio/') && ['mp3','m4a','wav','ogg','flac','aac','wma','opus','webm'].includes(ext)
    })
    if (audioFiles.length === 0 && audioLikeFiles.length === 0) {
      set({ error: { code: 'NO_AUDIO_FILES', message: '請選擇音訊檔案。' } }); return
    }
    set({ isLoading: true, error: null })
    const newTracks: MusicTrack[] = []
    const allFiles = [...audioFiles, ...audioLikeFiles]
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i]
      // Check format support
      const mimeType = file.type || 'audio/mpeg'
      const canPlay = audio.canPlayType(mimeType)
      if (canPlay === '') {
        // Try alternate MIME based on extension
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        const altMimeMap: Record<string, string> = {
          mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
          ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac',
          wma: 'audio/x-ms-wma', opus: 'audio/opus', webm: 'audio/webm',
        }
        const altMime = altMimeMap[ext]
        if (altMime && altMime !== mimeType && audio.canPlayType(altMime) !== '') {
          // Alternate works — proceed
        } else {
          unsupportedFiles.push(file.name)
          continue
        }
      }
      const id = crypto.randomUUID()
      const dur = await readDuration(file)
      const finalMimeType = file.type || 'audio/mpeg'

      // Try to extract title from filename, artist from "Artist - Title" pattern
      const extractedTitle = extractTitleFromName(file.name)
      const rawTitle = extractedTitle || formatTrackTitle(file.name)
      const artist = extractArtist(file.name)
      const displayName = rawTitle || '未命名音訊'

      let assetId = ''
      try { assetId = await savePortableAsset(file, finalMimeType) } catch { /* save failed, keep empty */ }

      const trackData: any = {
        id, title: displayName, displayName,
        fileName: file.name, fileSize: file.size, fileType: finalMimeType,
        assetId, duration: dur, createdAt: Date.now(),
      }
      if (artist) trackData.artist = artist
      newTracks.push(trackData)
    }
    if (unsupportedFiles.length > 0) {
      set(s => ({
        tracks: [...s.tracks, ...newTracks],
        currentTrackId: s.currentTrackId ?? newTracks[0]?.id ?? null,
        isLoading: false,
        error: { code: 'UNSUPPORTED_FORMAT', message: `這個音訊格式目前無法播放：${unsupportedFiles.map(f => f.split('.').pop()?.toUpperCase() || f).join('、')}` },
      }))
      return
    }
    set(s => ({
      tracks: [...s.tracks, ...newTracks],
      currentTrackId: s.currentTrackId ?? newTracks[0]?.id ?? null,
      isLoading: false,
    }))
  },

        removeTrack: (id) => {
          const s = get()
          const track = s.tracks.find(t => t.id === id)

          /* Stop playback if this is the current track */
          if (s.currentTrackId === id) {
            _audio?.pause()
            _audio?.removeAttribute('src')
            if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null }
            _audioReady = false
            _loadedTrackId = null
          }

          /* Remove from library, favorites, history, and IndexedDB blob */
          const next = s.tracks.filter(t => t.id !== id)
          const favs = s.favorites.filter(f => f !== id)
          const recent = s.recentlyPlayed.filter(r => r.id !== id)
          const history = s.playHistory.filter(h => h.trackId !== id)

          set(s => ({
            tracks: next,
            favorites: favs,
            recentlyPlayed: recent,
            playHistory: history,
            playlists: s.playlists.map(p => ({
              ...p,
              trackIds: p.trackIds.filter(tid => tid !== id),
              updatedAt: new Date().toISOString(),
            })),
            queueTrackIds: s.queueTrackIds ? s.queueTrackIds.filter(tid => tid !== id) : null,
            currentTrackId: s.currentTrackId === id ? (next[0]?.id ?? null) : s.currentTrackId,
            isPlaying: s.currentTrackId === id ? false : s.isPlaying,
            currentTime: 0,
            duration: 0,
          }))

          /* Clean up IndexedDB asset in background */
          if (track?.assetId) {
            deleteAsset(track.assetId).catch(() => {})
          }

          /* Clean up lyrics data */
          try { localStorage.removeItem(`lunartide_lyrics_${id}`); } catch {}
        },

        renameTrack: (id, newName) => {
          set(s => ({
            tracks: s.tracks.map(t => t.id === id ? { ...t, displayName: newName } : t),
          }));
        },

        replaceTrackAsset: async (trackId, file) => {
          const oldTrack = get().tracks.find(t => t.id === trackId);
          const oldAssetId = oldTrack?.assetId || undefined;
          const newAssetId = await savePortableAsset(file, file.type || 'audio/mpeg');
          let dur: number | undefined;
          try {
            dur = await readDuration(file);
          } catch (e) {
            deleteAsset(newAssetId).catch(() => {});
            throw e;
          }
          set({
            tracks: get().tracks.map(t => t.id === trackId
              ? { ...t, assetId: newAssetId, fileName: file.name, fileSize: file.size, fileType: file.type || 'audio/mpeg', duration: dur ?? t.duration }
              : t),
            error: null,
          })
          return { oldAssetId, newAssetId }
        },

        reloadTrack: async (trackId) => {
          const track = get().tracks.find(t => t.id === trackId);
          if (!track) return;
          set({ currentTrackId: trackId, error: null });
          if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null }
          _audioReady = false;
          _loadedTrackId = null;
          await loadIntoAudio(track);
        },

        togglePlay: () => {
          const s = get()
          if (s.isPlaying) {
            getAudio().pause()
          } else {
            ensureAnalyser()
            const track = getCurrentTrack()
            if (!track) return
            if (!_audioReady || _loadedTrackId !== track.id) {
              set({ error: { code: 'AUDIO_NOT_READY', message: '音訊尚未載入完成，請稍後再點擊播放。' } })
              set({ currentTrackId: track.id })
              void loadIntoAudio(track)
              return
            }
            if (_audioCtx && _audioCtx.state === 'suspended') {
              _audioCtx.resume().catch(() => {})
            }
            const audio = getAudio()
            audio.play().catch((err) => {
              console.error('[music-play-failed]', { trackId: track.id, errName: err.name, errMessage: err.message, mediaErrorCode: audio.error?.code ?? null })
              set({ error: { code: 'PLAY_FAILED', message: '播放未能開始，請再點一次' }, isPlaying: false })
            })
          }
        },

        play: async () => {
          ensureAnalyser()
          const track = getCurrentTrack()
          if (!track) return
          if (!_audioReady || _loadedTrackId !== track.id) {
            set({ currentTrackId: track.id, error: { code: 'AUDIO_NOT_READY', message: '音訊尚未載入完成，請稍後再試。' } })
            await loadIntoAudio(track)
            return
          }
          set({ error: null })
          if (_audioCtx && _audioCtx.state === 'suspended') {
            _audioCtx.resume().catch(() => {})
          }
          try {
            await getAudio().play()
          } catch (err: any) {
            console.error('[music-play-failed]', { trackId: track.id, errName: err.name, errMessage: err.message, mediaErrorCode: getAudio().error?.code ?? null })
            set({ error: { code: 'PLAY_FAILED', message: '播放未能開始，請再點一次' }, isPlaying: false })
          }
        },

        pause: () => { getAudio().pause() },

        previous: () => {
          const s = get()
          if (s.currentTime > 3 && (s.duration > 0 || getAudio().duration > 0)) {
            getAudio().currentTime = 0; set({ currentTime: 0 }); return
          }
          const trks = getQueueTracks()
          const track = s.tracks.find(t => t.id === s.currentTrackId)
          if (!track || trks.length === 0) return
          const idx = trks.findIndex(t => t.id === track.id)
          const prev = idx > 0 ? idx - 1 : trks.length - 1
          set({ currentTrackId: trks[prev].id })
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
        playFromSource: (trackId, source, queue) => set(s => ({
          currentTrackId: trackId,
          queueTrackIds: queue.filter(id => s.tracks.some(t => t.id === id)),
          playbackSource: source,
        })),
        recordPlayback: (trackId) => set(s => {
          const existing = s.playHistory.find(h => h.trackId === trackId)
          if (existing) {
            return {
              playHistory: s.playHistory.map(h =>
                h.trackId === trackId
                  ? { ...h, lastPlayedAt: new Date().toISOString(), playCount: h.playCount + 1, lastSource: s.playbackSource }
                  : h
              ),
            }
          }
          return {
            playHistory: [
              { trackId, lastPlayedAt: new Date().toISOString(), playCount: 1, lastSource: s.playbackSource },
              ...s.playHistory,
            ].slice(0, 100),
          }
        }),
        removePlayHistory: (trackId) => set(s => ({
          playHistory: s.playHistory.filter(h => h.trackId !== trackId),
        })),
        clearPlayHistory: () => set({ playHistory: [] }),
        setQueue: (trackIds) => set({ queueTrackIds: trackIds.filter(id => get().tracks.some(t => t.id === id)) }),
        reorderQueue: (fromIdx, toIdx) => set(s => {
          if (!s.queueTrackIds || fromIdx < 0 || fromIdx >= s.queueTrackIds.length || toIdx < 0 || toIdx >= s.queueTrackIds.length) return s
          const ids = [...s.queueTrackIds]
          const [moved] = ids.splice(fromIdx, 1)
          ids.splice(toIdx, 0, moved)
          return { queueTrackIds: ids }
        }),
        removeFromQueue: (trackId) => set(s => {
          const newIds = s.queueTrackIds ? s.queueTrackIds.filter(id => id !== trackId) : null
          const isCurrent = s.currentTrackId === trackId
          let next = {}
          if (isCurrent) {
            if (newIds && newIds.length > 0) {
              next = { currentTrackId: newIds[0] }
            } else {
              getAudio().pause()
              getAudio().removeAttribute('src')
              _audioReady = false
              _loadedTrackId = null
              next = { currentTrackId: null, isPlaying: false, currentTime: 0, duration: 0 }
            }
          }
          return { queueTrackIds: newIds, ...next }
        }),
        setTrackCustomCover: (trackId, dataUrl) => set(s => ({
          tracks: s.tracks.map(t => t.id === trackId ? { ...t, customCover: dataUrl } : t),
        })),

        /* ── Playlist Actions ── */
        createPlaylist: (name, description, trackIds, customCover) => {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          set(s => {
            const validIds = new Set(s.tracks.map(t => t.id));
            const raw = Array.isArray(trackIds) ? trackIds : [];
            const seen = new Set<string>();
            const deduped = raw.filter(tid => typeof tid === 'string' && validIds.has(tid) && !seen.has(tid) && seen.add(tid));
            return {
              playlists: [...s.playlists, {
                id, name: name.trim() || '未命名歌單',
                description: description?.trim() || undefined,
                customCover,
                trackIds: deduped,
                createdAt: now, updatedAt: now,
              }],
            };
          });
          return id;
        },

        updatePlaylist: (id, patch) => {
          set(s => ({
            playlists: s.playlists.map(p => p.id === id
              ? { ...p, ...patch, updatedAt: new Date().toISOString() }
              : p),
          }));
        },

        deletePlaylist: (id) => {
          set(s => ({
            playlists: s.playlists.filter(p => p.id !== id),
            playbackSource: s.playbackSource.type === 'playlist' && s.playbackSource.playlistId === id
              ? { type: 'library' }
              : s.playbackSource,
          }));
        },

        addTracksToPlaylist: (playlistId, trackIds) => {
          set(s => ({
            playlists: s.playlists.map(p => {
              if (p.id !== playlistId) return p;
              const existing = new Set(p.trackIds);
              const newIds = trackIds.filter(tid => !existing.has(tid));
              if (newIds.length === 0) return p;
              return { ...p, trackIds: [...p.trackIds, ...newIds], updatedAt: new Date().toISOString() };
            }),
          }));
        },

        removeTracksFromPlaylist: (playlistId, trackIds) => {
          const removeSet = new Set(trackIds);
          set(s => ({
            playlists: s.playlists.map(p => p.id === playlistId
              ? { ...p, trackIds: p.trackIds.filter(tid => !removeSet.has(tid)), updatedAt: new Date().toISOString() }
              : p),
          }));
        },

        reorderPlaylistTracks: (playlistId, fromIdx, toIdx) => {
          set(s => ({
            playlists: s.playlists.map(p => {
              if (p.id !== playlistId) return p;
              if (fromIdx < 0 || fromIdx >= p.trackIds.length) return p;
              if (toIdx < 0 || toIdx >= p.trackIds.length) return p;
              const ids = [...p.trackIds];
              const [moved] = ids.splice(fromIdx, 1);
              ids.splice(toIdx, 0, moved);
              return { ...p, trackIds: ids, updatedAt: new Date().toISOString() };
            }),
          }));
        },

        setPlaylistQueue: (trackIds) => set({ queueTrackIds: trackIds.filter(id => get().tracks.some(t => t.id === id)) }),
        clearPlaylistQueue: () => set({ queueTrackIds: null }),

        _syncTime: (t) => set({ currentTime: t }),
        _syncDuration: (d) => set({ duration: d }),
        _syncPlaying: (p) => set({ isPlaying: p }),
      }
    },
    {
      name: 'lunartide_music_store',
    onRehydrateStorage: () => (state) => {
      if (state) {
        let changed = false;
        state.hasHydrated = true;

        /* Detect keys missing from persisted state (Zustand default merge fills them,
           but localStorage still lacks them — force save so they persist). */
        try {
          const raw = localStorage.getItem('lunartide_music_store');
          const persisted = raw ? JSON.parse(raw)?.state ?? {} : {};
          if (!('playHistory' in persisted)) { state.playHistory = []; changed = true; }
          if (!('playbackSource' in persisted)) { state.playbackSource = { type: 'library' }; changed = true; }
          if (!('playlists' in persisted)) { state.playlists = []; changed = true; }
        } catch {}

        /* Migration: recentlyPlayed → playHistory */
        if (Array.isArray(state.recentlyPlayed) && state.recentlyPlayed.length > 0 && (!Array.isArray(state.playHistory) || state.playHistory.length === 0)) {
          state.playHistory = state.recentlyPlayed.map(r => ({
            trackId: r.id,
            lastPlayedAt: new Date(r.playedAt).toISOString(),
            playCount: 1,
          }))
          changed = true
        }
        if (!Array.isArray(state.playHistory)) { state.playHistory = []; changed = true; }
        if (!state.playbackSource || typeof state.playbackSource !== 'object') { state.playbackSource = { type: 'library' }; changed = true; }
        if (!Array.isArray(state.playlists)) { state.playlists = []; changed = true; }
        /* Playlist trackIds are canonical business data. Never prune unresolved IDs
           during hydration: an IndexedDB asset or track migration may complete later. */
        if (Array.isArray(state.playlists)) {
          state.playlists = state.playlists.map((p: any) => ({
            id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
            name: typeof p.name === 'string' ? p.name : '未命名歌單',
            description: typeof p.description === 'string' ? p.description : undefined,
            customCover: typeof p.customCover === 'string' ? p.customCover : undefined,
            trackIds: Array.isArray(p.trackIds) ? p.trackIds.filter((id: unknown) => typeof id === 'string') : [],
            createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
            updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
          }));
        }
        // If state was cleaned, persist to localStorage
        if (changed) {
          setTimeout(() => {
            const s = useMusicStore.getState();
            const toSave = {
              state: { tracks: s.tracks, currentTrackId: s.currentTrackId, volume: s.volume, shuffle: s.shuffle, loopMode: s.loopMode, favorites: s.favorites, playHistory: s.playHistory, playbackSource: s.playbackSource, playlists: s.playlists },
              version: 0,
            };
            try { localStorage.setItem('lunartide_music_store', JSON.stringify(toSave)); } catch {}
          }, 200);
        }
      }
    },
      partialize: (state) => ({
        tracks: state.tracks,
        currentTrackId: state.currentTrackId,
        volume: state.volume,
        shuffle: state.shuffle,
        loopMode: state.loopMode,
        favorites: state.favorites,
        playHistory: state.playHistory,
        playbackSource: state.playbackSource,
        playlists: state.playlists,
      }),
    }
  )
)

/* ── React to currentTrackId changes ── */
useMusicStore.subscribe((state, prev) => {
  if (state.currentTrackId === prev.currentTrackId) return;

  useMusicStore.setState({ error: null });

  const id = state.currentTrackId;
  if (!id) {
    _audioReady = false;
    _loadedTrackId = null;
    return;
  }

  const track = state.tracks.find(t => t.id === id);
  if (!track) return;

  if (_audioReady && _loadedTrackId === track.id) {
    const audio = getAudio();
    useMusicStore.setState({
      duration: audio.duration || track.duration || 0,
      isLoading: false,
      error: null,
    });
    return;
  }

  useMusicStore.setState({
    isLoading: true,
    error: null,
  });

  void loadIntoAudio(track);
})

/* ── Sync volume ── */
useMusicStore.subscribe((state, prev) => {
  if (state.volume !== prev.volume && _audio) {
    _audio.volume = state.volume
  }
})
