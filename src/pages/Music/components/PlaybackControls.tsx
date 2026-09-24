import { useMusicStore } from '@/store/musicStore';
import { formatMusicTime } from '@/hooks/useAudioPlayer';

export function PlaybackControls({ trackCount }: { trackCount: number }) {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);
  const isLoading = useMusicStore((s) => s.isLoading);
  const error = useMusicStore((s) => s.error);
  const loopMode = useMusicStore((s) => s.loopMode);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const previous = useMusicStore((s) => s.previous);
  const next = useMusicStore((s) => s.next);
  const seek = useMusicStore((s) => s.seek);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const cycleLoopMode = useMusicStore((s) => s.cycleLoopMode);

  const safeCurrent = Number.isFinite(currentTime) ? currentTime : 0;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const metadataReady = safeDuration > 0;
  const hasTracks = trackCount > 0;
  const metadataLabel = error ? error.message : isLoading ? '正在载入音频资料' : '音频资料尚未载入';

  return (
    <div className="mc-playback" data-testid="bard-transport">
      <div className="mc-progress-row">
        <span className="mc-time">{metadataReady ? formatMusicTime(safeCurrent) : '—:—'}</span>
        <input type="range" className="mc-seek" min={0} max={safeDuration || 1} value={metadataReady ? safeCurrent : 0} disabled={!metadataReady} onChange={(e) => seek(Number(e.target.value))} aria-label="播放進度" aria-valuetext={metadataReady ? `${formatMusicTime(safeCurrent)} / ${formatMusicTime(safeDuration)}` : metadataLabel} />
        <span className="mc-time">{metadataReady ? formatMusicTime(safeDuration) : '—:—'}</span>
      </div>
      <div className="mc-controls-row">
        <button className="mc-ctrl" onClick={toggleShuffle} aria-label="隨機播放"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg></button>
        <button className="mc-ctrl" onClick={previous} disabled={!hasTracks} aria-label="上一首"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8}><polygon points="19 20 9 12 19 4" /><line x1="5" y1="19" x2="5" y2="5" /></svg></button>
        <button className="mc-ctrl mc-ctrl--play" onClick={togglePlay} aria-label={isPlaying ? '暫停' : '播放'}>
          {isPlaying
            ? <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}
        </button>
        <button className="mc-ctrl" onClick={next} disabled={!hasTracks} aria-label="下一首"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8}><polygon points="5 4 15 12 5 20" /><line x1="19" y1="5" x2="19" y2="19" /></svg></button>
        <button className={`mc-ctrl${loopMode !== 'off' ? ' active' : ''}`} onClick={cycleLoopMode} aria-label={loopMode === 'one' ? '單曲循環' : loopMode === 'all' ? '全部循環' : '不循環'}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
            {loopMode === 'one' && <text x="12" y="21" textAnchor="middle" fontSize="6" fill="currentColor" fontWeight="700">1</text>}
          </svg>
        </button>
      </div>
    </div>
  );
}
