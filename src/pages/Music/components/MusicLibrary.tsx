import { useMemo, useState } from 'react';
import { getTrackDisplayTitle, useMusicStore, type MusicPlaybackSource } from '@/store/musicStore';
import { MusicCover, resolveMusicCoverSource } from './MusicCover';

type Props = { onImport: () => void; onPlay: (id: string, source: MusicPlaybackSource, queue: string[]) => void; onMore: (event: React.MouseEvent, id: string) => void; onDelete: (id: string) => void };
const duration = (value?: number) => value && Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '--:--';

export function MusicLibrary({ onImport, onPlay, onMore, onDelete }: Props) {
  const tracks = useMusicStore((s) => s.tracks);
  const history = useMusicStore((s) => s.playHistory);
  const favorites = useMusicStore((s) => s.favorites);
  const toggleFavorite = useMusicStore((s) => s.toggleFavorite);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => tracks.filter((track) => `${getTrackDisplayTitle(track)} ${track.artist || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [query, tracks]);
  const recent = useMemo(() => history.map((entry) => tracks.find((track) => track.id === entry.trackId)).filter(Boolean).slice(0, 8), [history, tracks]);
  const favoriteTracks = useMemo(() => favorites.map((id) => tracks.find((track) => track.id === id)).filter(Boolean), [favorites, tracks]);
  const added = useMemo(() => [...tracks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8), [tracks]);
  const row = (track: NonNullable<(typeof tracks)[number]>, source: MusicPlaybackSource, queue: string[]) => <div className="rune-library__row" key={`${source.type}-${track.id}`}>
    <button className="rune-library__track" onClick={() => onPlay(track.id, source, queue)}><MusicCover id={track.id} src={resolveMusicCoverSource(track as unknown as Record<string, unknown>)} /><span><strong>{getTrackDisplayTitle(track)}</strong><small>{track.artist || '本地音樂'} · {duration(track.duration)}</small></span></button>
    <button onClick={() => toggleFavorite(track.id)} aria-label={favorites.includes(track.id) ? '取消收藏' : '加入收藏'}>{favorites.includes(track.id) ? '♥' : '♡'}</button>
    <button onClick={(event) => onMore(event, track.id)} aria-label="更多操作">•••</button>
    <button onClick={() => onDelete(track.id)} aria-label="刪除歌曲">×</button>
  </div>;
  return <section className="rune-library" data-testid="music-library">
    <header><div><p>MUSIC LIBRARY</p><h2>音樂庫</h2><span>{tracks.length} 首本地音樂</span></div><button onClick={onImport}>＋ 匯入音樂</button></header>
    <label className="rune-library__search"><span>搜尋</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋歌曲或藝人" /></label>
    {query ? <section><h3>搜尋結果</h3>{filtered.map((track) => row(track, { type: 'search', query }, filtered.map((item) => item.id)))}</section> : <>
      {recent.length > 0 && <section data-library-section="recent"><h3>最近播放</h3>{recent.map((track) => track && row(track, { type: 'recent' }, recent.map((item) => item!.id)))}</section>}
      {favoriteTracks.length > 0 && <section><h3>收藏</h3>{favoriteTracks.map((track) => track && row(track, { type: 'library' }, favoriteTracks.map((item) => item!.id)))}</section>}
      {added.length > 0 && <section><h3>最近加入</h3>{added.map((track) => row(track, { type: 'library' }, added.map((item) => item.id)))}</section>}
      <section><h3>全部歌曲</h3>{tracks.length ? tracks.map((track) => row(track, { type: 'library' }, tracks.map((item) => item.id))) : <div className="lm-empty"><p>還沒有音樂</p><span>匯入本地音訊，建立你的共聽室。</span><button className="lm-empty-btn" onClick={onImport}>匯入音訊</button></div>}</section>
    </>}
  </section>;
}
