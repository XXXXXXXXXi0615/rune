import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FocusIsland } from '@/components/layout/FocusIsland';
import { MusicIsland } from '@/components/music/MusicIsland';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useMusicStore } from '@/store/musicStore';
import { useFocusCareerStore } from '@/store/useFocusCareerStore';
import { useAppStore } from '@/store/useAppStore';

const ISLAND_GAP = 8; // px gap between island bottom and page content

export function TopIslandHost() {
  const pathname = useLocation().pathname;
  const islandState = useFocusIslandStore((state) => state.state);
  const focusStatus = useFocusSessionStore((state) => state.status);
  const tick = useFocusSessionStore((state) => state.tick);
  const tracks = useMusicStore((state) => state.tracks);
  const currentTrackId = useMusicStore((state) => state.currentTrackId);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const focusSessions = useAppStore((state) => state.focusSessionLog || []);
  const islandRef = useRef<HTMLDivElement>(null);

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentTrackId) ?? null,
    [tracks, currentTrackId],
  );
  const focusActive = focusStatus === 'running' || focusStatus === 'paused';
  const trackEnded = duration > 0 && currentTime >= duration - 0.25;
  const musicActive = Boolean(currentTrack) && !trackEnded && (isPlaying || currentTime > 0);
  const musicRoute = pathname.startsWith('/music');
  const immersiveRoute = pathname === '/gacha';
  const canRenderFocus = islandState !== 'hidden' && islandState !== 'window';
  const showMusic = !focusActive && musicActive && !musicRoute && islandState !== 'window';
  const showFocus = canRenderFocus && !immersiveRoute;
  const hostVisible = showMusic;

  useEffect(() => {
    if (focusStatus !== 'running') return;
    const timer = window.setInterval(() => tick(), 1000);
    return () => window.clearInterval(timer);
  }, [focusStatus, tick]);

  useEffect(() => {
    useFocusCareerStore.getState().migrateLegacySessions(focusSessions);
  }, [focusSessions]);

  useEffect(() => {
    const reconcile = () => {
      const session = useFocusSessionStore.getState();
      const career = useFocusCareerStore.getState();
      career.rolloverToday();
      if (session.sessionId && session.status === 'running' && session.phase === 'focus' && session.sessionCategory === 'focus') {
        career.checkpoint(session.sessionId, Date.now(), true);
      }
    };
    const onVisibility = () => reconcile();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', reconcile);
    window.addEventListener('focus', reconcile);
    reconcile();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', reconcile);
      window.removeEventListener('focus', reconcile);
    };
  }, []);

  useEffect(() => {
    // Phase 1.1B Final: Dynamic island offset via ResizeObserver — no magic 48px
    const updateOffset = () => {
      const el = islandRef.current?.querySelector('.music-island');
      if (!el || !hostVisible) {
        document.documentElement.style.setProperty('--focus-island-offset', '0px');
        return;
      }
      const rect = el.getBoundingClientRect();
      const offset = rect.height + ISLAND_GAP;
      document.documentElement.style.setProperty('--focus-island-offset', `${offset}px`);
    };
    // Run immediately
    updateOffset();
    // Observe the island wrapper for size changes
    const observer = new ResizeObserver(updateOffset);
    if (islandRef.current) observer.observe(islandRef.current);
    window.addEventListener('resize', updateOffset, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateOffset);
      document.documentElement.style.setProperty('--focus-island-offset', '0px');
    };
  }, [hostVisible]);

  return <>
    {showFocus && <FocusIsland hideIdleOrb={pathname === '/'} />}
    {showMusic && <div ref={islandRef}><MusicIsland /></div>}
  </>;
}
