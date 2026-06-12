import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMusicStore, getTrackDisplayName } from '@/store/musicStore';
import { formatMusicTime } from '@/hooks/useAudioPlayer';

const LS_KEY = 'lunartide_music_player_position_v1';
const THRESHOLD = 3;

interface Pos { x: number; y: number }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function loadPos(): Pos | null {
  try { const r = localStorage.getItem(LS_KEY); if (r) return JSON.parse(r); } catch {}
  return null;
}
function savePos(p: Pos) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {} }

export function MiniPlayer() {
  // ── ALL hooks first (no conditional calls) ──
  const nav = useNavigate();
  const loc = useLocation();
  const tracks = useMusicStore(s => s.tracks);
  const cid = useMusicStore(s => s.currentTrackId);
  const playing = useMusicStore(s => s.isPlaying);
  const cur = useMusicStore(s => s.currentTime);
  const dur = useMusicStore(s => s.duration);
  const toggle = useMusicStore(s => s.togglePlay);
  const pv = useMusicStore(s => s.previous);
  const nx = useMusicStore(s => s.next);

  const saved = loadPos();
  const [pos, setPos] = useState<Pos>(saved || { x: 8, y: window.innerHeight - 148 });
  const [dragging, setDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  const draggingRef = useRef(false);
  const dsRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { draggingRef.current = dragging; }, [dragging]);
  useEffect(() => { if (!saved) { const np = { x: 8, y: window.innerHeight - 148 }; setPos(np); savePos(np); } }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dsRef.current = { sx: e.clientX, sy: e.clientY, px: posRef.current.x, py: posRef.current.y, moved: false };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dsRef.current) return;
      const dx = e.clientX - dsRef.current.sx, dy = e.clientY - dsRef.current.sy;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      dsRef.current.moved = true;
      if (!draggingRef.current) setDragging(true);
      const pw = barRef.current?.offsetWidth || 280, ph = barRef.current?.offsetHeight || 48;
      const np = { x: clamp(dsRef.current.px + dx, 0, Math.max(0, window.innerWidth - pw)), y: clamp(dsRef.current.py + dy, 0, Math.max(0, window.innerHeight - ph - 72)) };
      posRef.current = np; setPos(np);
    };
    const onUp = () => { if (dsRef.current?.moved) savePos(posRef.current); dsRef.current = null; setDragging(false); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, []);

  const reset = useCallback(() => { const np = { x: 8, y: window.innerHeight - 148 }; setPos(np); posRef.current = np; savePos(np); }, []);

  // ── Only hide on music page ──
  if (loc.pathname === '/music') return null;

  const track = (tracks || []).find(t => t.id === cid) ?? null;
  const hasTrack = !!track;
  const pct = hasTrack && dur > 0 ? (cur / dur) * 100 : 0;
  const name = hasTrack ? getTrackDisplayName(track) : '♪ 尚未載入音訊';
  const time = hasTrack ? `${formatMusicTime(cur)} / ${formatMusicTime(dur || track.duration || 0)}` : '點擊前往音樂庫';

  return (
    <div ref={barRef} style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 60,
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 16,
      background: 'color-mix(in srgb, var(--surface-3, #2d2328) 92%, transparent)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
      maxWidth: 'calc(100vw - 16px)', width: 'fit-content',
      opacity: dragging ? 0.92 : 1, userSelect: 'none', touchAction: 'none',
    }}>
      {/* Grip */}
      <div onPointerDown={onPointerDown} style={{
        cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none',
        fontSize: 12, color: 'var(--text-3)', padding: '4px 2px',
        display: 'flex', alignItems: 'center', lineHeight: 1, letterSpacing: 1,
        opacity: 0.7, flexShrink: 0, userSelect: 'none',
      }} title="拖動移動播放器" aria-label="拖動移動播放器">⋮⋮</div>

      {/* Progress */}
      {hasTrack && (
        <div style={{ position: 'absolute', top: 0, left: 10, right: 10, height: 2, background: 'var(--border)', borderRadius: 1 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 1, transition: 'width 0.2s linear' }} />
        </div>
      )}

      {/* Info */}
      <div onClick={() => { if (!dsRef.current?.moved) nav('/music'); }}
        style={{ display: 'flex', flexDirection: 'column', minWidth: 0, cursor: 'pointer', flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
          {name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          {time}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button onClick={pv} disabled={!hasTrack} aria-label="上一首" style={bs}><svg viewBox="0 0 24 24" width="12" height="12"><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" /><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" /></svg></button>
        <button onClick={toggle} disabled={!hasTrack} aria-label={playing ? '暫停' : '播放'}
          style={{ ...bs, background: hasTrack && playing ? 'var(--accent)' : 'var(--surface-2)', color: hasTrack && playing ? '#fff' : 'var(--text-2)', width: 26, height: 26, opacity: hasTrack ? 1 : 0.4 }}>
          {playing ? <svg viewBox="0 0 24 24" width="10" height="10"><rect x="6" y="5" width="3.5" height="14" rx="1" fill="currentColor" /><rect x="14.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24" width="10" height="10"><polygon points="6 4 18 12 6 20 6 4" fill="currentColor" /></svg>}
        </button>
        <button onClick={nx} disabled={!hasTrack} aria-label="下一首" style={bs}><svg viewBox="0 0 24 24" width="12" height="12"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" /><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" /></svg></button>
        <button onClick={reset} aria-label="重置位置" title="重置位置" style={{ ...bs, opacity: 0.3, marginLeft: 2 }}><svg viewBox="0 0 24 24" width="9" height="9"><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="12" cy="5" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /></svg></button>
      </div>
    </div>
  );
}

const bs: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 };
