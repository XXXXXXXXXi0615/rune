import { useMemo } from 'react';
import type { MusicPlaylist, MusicPlaybackSource } from '@/store/musicStore';
import { getTrackDisplayTitle } from '@/store/musicStore';
import { MusicCover, resolveMusicCoverSource } from './MusicCover';

type Track = any;
export type MusicLibraryFilter = 'all' | 'tracks' | 'playlists' | 'albums' | 'artists';
export type MusicViewMode = 'adaptive' | 'compact' | 'list';

function artist(track: Track) { return track.artist || '本地音樂'; }

const LOCAL_MUSIC_GRADIENT_ID = 'lunartide-local-music';

export function MusicHomePage({ tracks, playlists, history, favorites, filter, viewMode, onFilter, onViewMode, onImport, onOpenSection, onOpenPlaylist, onPlayTrack }: {
  tracks: Track[];
  playlists: MusicPlaylist[];
  history: { trackId: string; lastPlayedAt: string; playCount: number }[];
  favorites: string[];
  filter: MusicLibraryFilter;
  viewMode: MusicViewMode;
  onFilter: (value: MusicLibraryFilter) => void;
  onViewMode: (value: MusicViewMode) => void;
  onImport: () => void;
  onOpenSection: (section: 'library' | 'recent' | 'playlists' | 'search') => void;
  onOpenPlaylist: (id: string) => void;
  onPlayTrack: (id: string, source: MusicPlaybackSource, queue: string[]) => void;
}) {
  const recentTracks = useMemo(() => [...history].sort((a, b) => Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt)).map(item => tracks.find(track => track.id === item.trackId)).filter(Boolean).slice(0, 6), [history, tracks]);
  const recentAdded = useMemo(() => [...tracks].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 6), [tracks]);
  const mostPlayed = useMemo(() => [...history].sort((a, b) => b.playCount - a.playCount)[0], [history]);
  const favoriteTracks = tracks.filter(track => favorites.includes(track.id));
  const mostPlayedTrack = tracks.find(t => t.id === mostPlayed?.trackId);

  const quick = [
    { id: 'liked', label: '我喜歡的音樂', meta: `${favoriteTracks.length} 首`, track: favoriteTracks[0], coverSrc: resolveMusicCoverSource(favoriteTracks[0]), action: () => onFilter('tracks') },
    { id: 'recent', label: '最近播放', meta: `${history.length} 筆紀錄`, track: recentTracks[0], coverSrc: resolveMusicCoverSource(recentTracks[0]), action: () => onOpenSection('recent') },
    { id: 'added', label: '最近加入', meta: `${recentAdded.length} 首最近音樂`, track: recentAdded[0], coverSrc: resolveMusicCoverSource(recentAdded[0]), action: () => onFilter('tracks') },
    { id: 'popular', label: '播放最多', meta: mostPlayed ? `${mostPlayed.playCount} 次播放` : '等待第一段播放', track: mostPlayedTrack, coverSrc: resolveMusicCoverSource(mostPlayedTrack), action: () => mostPlayed && onPlayTrack(mostPlayed.trackId, { type: 'recent' }, history.map(h => h.trackId)) },
    { id: 'local', label: '本地音樂', meta: `${tracks.length} 首`, track: undefined, coverSrc: undefined, fallbackId: LOCAL_MUSIC_GRADIENT_ID, action: () => onOpenSection('library') },
    { id: 'playlists', label: '你的歌單', meta: `${playlists.length} 個歌單`, track: undefined, coverSrc: playlists[0]?.customCover, fallbackId: playlists[0]?.id, action: () => onOpenSection('playlists') },
  ];

  const cards = filter === 'tracks' ? tracks : filter === 'playlists' ? [] : [...playlists, ...tracks];
  return (
    <div className="music-home">

      <section className="music-home__section">
        <div className="music-home__section-head"><div><h2>快速訪問</h2><p>常回去的音樂與收藏</p></div></div>
        <div className="music-quick-grid">
          {quick.map(item => (
            <button key={item.id} className="music-quick-card" onClick={item.action}>
              <MusicCover id={item.fallbackId || item.track?.id || item.id} src={item.coverSrc} />
              <span><strong>{item.label}</strong><small>{item.meta}</small></span>
              <span className="music-card-play" aria-hidden="true">▶</span>
            </button>
          ))}
        </div>
      </section>

      {tracks.length <= 3 && <section className="music-import-guide">
        <div><span className="music-import-guide__eyebrow">本機音樂</span><h2>將音樂帶進 Rune</h2><p>匯入本地音訊、建立歌單，讓這裡慢慢長成你的音樂空間。</p></div>
        <div className="music-import-guide__actions"><button onClick={onImport}>導入本地音樂</button><button onClick={() => onOpenSection('playlists')}>建立歌單</button></div>
      </section>}

      {recentTracks.length > 0 && <section className="music-home__section">
        <div className="music-home__section-head"><div><h2>最近播放</h2><p>接著剛才的聲音</p></div><button onClick={() => onOpenSection('recent')}>顯示全部</button></div>
        <div className="music-horizontal-cards">{recentTracks.map(track => <button key={track.id} className="music-media-card" onClick={() => onPlayTrack(track.id, { type: 'recent' }, recentTracks.map(t => t.id))}><MusicCover id={track.id} src={resolveMusicCoverSource(track)} /><strong>{getTrackDisplayTitle(track)}</strong><span>{artist(track)}</span></button>)}</div>
      </section>}

      <section className="music-home__section">
        <div className="music-home__section-head music-library-head"><div><h2>你的音樂庫</h2><p>歌曲、歌單與收藏放在同一處</p></div><div className="music-view-toggle" aria-label="顯示模式">{(['adaptive','compact','list'] as MusicViewMode[]).map(mode => <button key={mode} aria-pressed={viewMode === mode} onClick={() => onViewMode(mode)}>{mode === 'adaptive' ? '自適應' : mode === 'compact' ? '緊湊' : '列表'}</button>)}</div></div>
        <div className="music-filter-row" role="tablist">{([['all','全部'],['tracks','歌曲'],['playlists','歌單'],['albums','專輯'],['artists','藝人']] as [MusicLibraryFilter,string][]).map(([id,label]) => <button key={id} role="tab" aria-selected={filter === id} onClick={() => onFilter(id)}>{label}</button>)}</div>
        {cards.length === 0 ? <div className="lm-empty lm-empty--compact"><p>這個分類還沒有內容</p><span>匯入音樂或建立歌單後會出現在這裡。</span></div> :
          <div className={`adaptive-music-grid adaptive-music-grid--${viewMode}`}>
            {cards.slice(0, 18).map((item: any, index) => {
              const isPlaylist = Array.isArray(item.trackIds);
              return <button key={item.id} className={`adaptive-music-card adaptive-music-card--${viewMode === 'adaptive' && index % 7 === 0 ? 'wide' : 'small'}`} onClick={() => isPlaylist ? onOpenPlaylist(item.id) : onPlayTrack(item.id, { type: 'library' }, tracks.map(t => t.id))}>
                <MusicCover id={item.id} src={isPlaylist ? item.customCover : resolveMusicCoverSource(item)} />
                <span className="adaptive-music-card__meta"><strong>{isPlaylist ? item.name : getTrackDisplayTitle(item)}</strong><small>{isPlaylist ? `${item.trackIds.length} 首歌曲` : artist(item)}</small></span>
              </button>;
            })}
          </div>}
      </section>
    </div>
  );
}
