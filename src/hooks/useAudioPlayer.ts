/**
 * Thin wrapper around the global musicStore.
 * Provided for backward compatibility — Music.tsx uses this API.
 * Audio lifecycle is now managed by musicStore (module-level singleton).
 */
import { useMemo, useRef } from 'react'
import { useMusicStore, type LoopMode, type RecentMusicTrack, getMusicAnalyser } from '@/store/musicStore'
import type { MusicTrack } from '@/types'

export type { LoopMode, RecentMusicTrack }

export function formatMusicTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function useAudioPlayer() {
  /* Create a dummy audioRef for useAudioVisualizer compatibility.
   * The real Audio element lives inside musicStore's module scope. */
  const audioRef = useRef<HTMLAudioElement | null>(null)

  /* Subscribe to store slices */
  const tracks = useMusicStore(s => s.tracks)
  const currentTrackId = useMusicStore(s => s.currentTrackId)
  const isPlaying = useMusicStore(s => s.isPlaying)
  const isLoading = useMusicStore(s => s.isLoading)
  const currentTime = useMusicStore(s => s.currentTime)
  const duration = useMusicStore(s => s.duration)
  const volume = useMusicStore(s => s.volume)
  const shuffle = useMusicStore(s => s.shuffle)
  const loopMode = useMusicStore(s => s.loopMode)
  const favorites = useMusicStore(s => s.favorites)
  const recentlyPlayed = useMusicStore(s => s.recentlyPlayed)
  const error = useMusicStore(s => s.error)

  /* Actions */
  const uploadFiles = useMusicStore(s => s.uploadFiles)
  const togglePlay = useMusicStore(s => s.togglePlay)
  const play = useMusicStore(s => s.play)
  const pause = useMusicStore(s => s.pause)
  const previous = useMusicStore(s => s.previous)
  const next = useMusicStore(s => s.next)
  const stop = useMusicStore(s => s.stop)
  const seek = useMusicStore(s => s.seek)
  const setVolume = useMusicStore(s => s.setVolume)
  const toggleShuffle = useMusicStore(s => s.toggleShuffle)
  const cycleLoopMode = useMusicStore(s => s.cycleLoopMode)
  const toggleFavorite = useMusicStore(s => s.toggleFavorite)
  const selectTrack = useMusicStore(s => s.selectTrack)
  const removeTrack = useMusicStore(s => s.removeTrack)

  /* Derived */
  const currentTrack = useMemo<MusicTrack | null>(() => {
    return tracks.find(t => t.id === currentTrackId) ?? tracks[0] ?? null
  }, [currentTrackId, tracks])

  const currentIndex = useMemo(() => {
    return currentTrack ? tracks.findIndex(t => t.id === currentTrack.id) : -1
  }, [currentTrack, tracks])

  return {
    audioRef,
    tracks, currentTrack, currentIndex,
    isPlaying, isLoading, currentTime,
    duration: duration || currentTrack?.duration || 0,
    volume, shuffle, loopMode,
    favorites, recentlyPlayed, error,
    uploadFiles, play, pause, togglePlay,
    previous, next, stop, seek, setVolume,
    toggleShuffle, cycleLoopMode, toggleFavorite,
    selectTrack, removeTrack,
  }
}
