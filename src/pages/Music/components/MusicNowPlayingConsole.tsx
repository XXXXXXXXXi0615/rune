import { useEffect, useState } from 'react';
import { useMusicStore } from '@/store/musicStore';
import { useMusicEffectsStore } from '@/store/useMusicEffectsStore';
import { CompanionListeningRail } from './CompanionListeningRail';
import { PlayerConsolePane } from './PlayerConsolePane';
import { LyricsPane } from './LyricsPane';
import { TideEqConsolePane } from './TideEqConsolePane';
import { PlaybackControls } from './PlaybackControls';

type Mode = 'player' | 'lyrics' | 'eq';

export function MusicNowPlayingConsole({ track, onCoverClick }: { track: any; onCoverClick: () => void }) {
  const [mode, setMode] = useState<Mode>('player');
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const tracks = useMusicStore((state) => state.tracks);
  const playbackSource = useMusicStore((state) => state.playbackSource);
  const loadResolvedForContext = useMusicEffectsStore((state) => state.loadResolvedForContext);
  const playlistId = playbackSource.type === 'playlist' ? playbackSource.playlistId : undefined;
  useEffect(() => {
    loadResolvedForContext(track.id, playlistId);
  }, [loadResolvedForContext, playlistId, track.id]);
  return <div className="hifi-console" data-testid="music-hifi-console">
    <header className="hifi-console__header">
      <div className="hifi-console__brand">
        <strong>BARD</strong>
        <span>RUNE AUDIO SYSTEM · Rune 聲場</span>
        <small>Balanced Audio Resonance Deck</small>
      </div>
      <div className="hifi-console__device-status" role="status" aria-label={isPlaying ? 'BARD 正在播放' : 'BARD 已就绪'}>
        <i className={isPlaying ? 'is-active' : ''} aria-hidden="true" />
        <span>{isPlaying ? '播放中' : '已就绪'}</span>
      </div>
    </header>
    <CompanionListeningRail playing={isPlaying} />
    <nav className="hifi-mode-switcher" role="tablist" aria-label="控制台模式">
      {([['player','播放'],['lyrics','歌词'],['eq','TIDE EQ']] as [Mode,string][]).map(([id,label]) => <button key={id} role="tab" aria-selected={mode === id} className="im-pager-nav-btn" onClick={() => setMode(id)}>{label}</button>)}
    </nav>
    <section className={`hifi-console__display hifi-console__display--${mode}`}>
      {mode === 'player' && <PlayerConsolePane track={track} onCoverClick={onCoverClick} />}
      {mode === 'lyrics' && <LyricsPane trackId={track.id} title={track.title || track.displayName || ''} />}
      {mode === 'eq' && <TideEqConsolePane trackId={track.id} playlistId={playlistId} />}
    </section>
    <footer className="hifi-console__footer" data-testid="bard-console-footer">
      <div className="hifi-console__footer-divider" aria-hidden="true" />
      <PlaybackControls trackCount={tracks.length} />
    </footer>
  </div>;
}
