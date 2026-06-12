import { useAppStore } from '@/store/useAppStore';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDuration(sec?: number): string {
  if (!sec || !isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Playlist() {
  const tracks = useAppStore((s) => s.music.tracks);
  const currentTrackId = useAppStore((s) => s.music.currentTrackId);
  const setCurrentTrack = useAppStore((s) => s.setCurrentTrack);
  const deleteMusicTrack = useAppStore((s) => s.deleteMusicTrack);

  if (tracks.length === 0) return null;

  return (
    <div className="playlist-list">
      {tracks.map((track, i) => (
        <div
          key={track.id}
          className={`playlist-item${track.id === currentTrackId ? ' current' : ''}`}
          onClick={() => setCurrentTrack(track.id)}
        >
          <div className="playlist-item-num">{i + 1}</div>
          <div className="playlist-item-body">
            <div className="playlist-item-title">{track.title}</div>
            <div className="playlist-item-meta">
              {fmtDuration(track.duration)} {track.duration ? '·' : ''} {fmtSize(track.fileSize)}
            </div>
          </div>
          <button
            className="playlist-item-del"
            onClick={(e) => {
              e.stopPropagation();
              deleteMusicTrack(track.id);
            }}
            aria-label="Delete track"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
