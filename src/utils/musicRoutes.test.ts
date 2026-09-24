import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTrackDisplayTitle, useMusicStore } from '@/store/musicStore';
import { isMusicRoute } from './musicRoutes';

const tracks = [
  { id: 'a', title: 'A', fileName: 'A.mp3', fileSize: 1, fileType: 'audio/mpeg', assetId: 'asset-a', duration: 20, createdAt: 1 },
  { id: 'b', title: 'B', artist: 'Artist', fileName: 'B.mp3', fileSize: 1, fileType: 'audio/mpeg', assetId: 'asset-b', duration: 30, createdAt: 2 },
];

beforeEach(() => useMusicStore.setState({ tracks, playlists: [{ id: 'p', name: 'P', trackIds: ['a', 'b'], createdAt: 'x', updatedAt: 'x' }], queueTrackIds: null, currentTrackId: 'a', favorites: [], playHistory: [], shuffle: false, loopMode: 'off' }));

describe('Music Phase 1 canonical contract', () => {
  it('keeps the only persistent playback Audio owner in musicStore', () => {
    const store = readFileSync(resolve(process.cwd(), 'src/store/musicStore.ts'), 'utf8');
    const wrapper = readFileSync(resolve(process.cwd(), 'src/hooks/useAudioPlayer.ts'), 'utf8');
    expect(store).toContain('let _audio: HTMLAudioElement | null = null');
    expect(store).toContain('_audio = new Audio()');
    expect(wrapper).not.toMatch(/new Audio\(\)/);
    expect(wrapper).toContain('The real Audio element lives inside musicStore');
  });
  it('keeps queue mutation separate from playlist membership', () => {
    useMusicStore.getState().setQueue(['b', 'a']);
    useMusicStore.getState().reorderQueue(0, 1);
    expect(useMusicStore.getState().queueTrackIds).toEqual(['a', 'b']);
    expect(useMusicStore.getState().playlists[0].trackIds).toEqual(['a', 'b']);
  });
  it('supports optional artist records and stable title fallback', () => {
    expect(tracks[0].artist).toBeUndefined();
    expect(getTrackDisplayTitle(tracks[0])).toBe('A');
    expect(tracks[1].artist).toBe('Artist');
  });
  it('recognizes the complete Music route family only', () => {
    expect(['/music', '/music/library', '/music/listen/a'].every(isMusicRoute)).toBe(true);
    expect(isMusicRoute('/musical')).toBe(false);
  });
});
