import { useCallback, useEffect, useRef, useState } from 'react';

function PlayerIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function LyricsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h10M4 18h8" />
    </svg>
  );
}

const SWIPE_THRESHOLD = 0.28;
const VELOCITY_THRESHOLD = 0.3;
const EDGE_EXCLUDE = 24;

interface DragInfo {
  startX: number;
  startY: number;
  startPage: 'player' | 'lyrics';
  viewportWidth: number;
}

interface MoveRecord {
  x: number;
  t: number;
}

export function ImmersivePlayerPager({
  playerPane,
  lyricsPane,
}: {
  playerPane: React.ReactNode;
  lyricsPane: React.ReactNode;
}) {
  const [page, setPage] = useState<'player' | 'lyrics'>('player');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pageRef = useRef(page);
  pageRef.current = page;

  const dragInfo = useRef<DragInfo | null>(null);
  const movesRef = useRef<MoveRecord[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  const pageIdx = page === 'player' ? 0 : 1;

  const commitSwipe = useCallback((toRight: boolean) => {
    const current = pageRef.current;
    if (toRight && current === 'lyrics') setPage('player');
    else if (!toRight && current === 'player') setPage('lyrics');
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input[type="range"]')) return;
    if (target.closest('.im-lyrics-inner')) return;
    if (target.closest('button, [role="button"], a, [role="link"], select, textarea')) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.clientX - rect.left < EDGE_EXCLUDE) return;
    if (rect.right - e.clientX < EDGE_EXCLUDE) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPage: pageRef.current,
      viewportWidth: rect.width,
    };
    movesRef.current = [{ x: e.clientX, t: performance.now() }];
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragInfo.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = Math.abs(e.clientY - d.startY);

    if (dy > Math.abs(dx) * 1.3) {
      setDragOffset(0);
      dragInfo.current = null;
      setIsDragging(false);
      return;
    }

    movesRef.current.push({ x: e.clientX, t: performance.now() });
    if (movesRef.current.length > 6) movesRef.current.shift();

    const fromPlayer = d.startPage === 'player';
    const clamped = fromPlayer ? Math.min(0, dx) : Math.max(0, dx);
    setDragOffset(clamped);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragInfo.current;
    if (!d) return;

    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    const currentOffset = e.clientX - d.startX;
    const fromPlayer = d.startPage === 'player';
    const clampedOffset = fromPlayer ? Math.min(0, currentOffset) : Math.max(0, currentOffset);

    const moves = movesRef.current;
    let velocity = 0;
    if (moves.length >= 2) {
      const first = moves[0];
      const last = moves[moves.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.x - first.x) / dt;
    }

    const thresholdPx = d.viewportWidth * SWIPE_THRESHOLD;
    const absOffset = Math.abs(clampedOffset);
    const shouldSwipe = absOffset > thresholdPx || Math.abs(velocity) > VELOCITY_THRESHOLD;

    setDragOffset(0);
    setIsDragging(false);

    if (shouldSwipe) {
      commitSwipe(clampedOffset < 0);
    }

    dragInfo.current = null;
    movesRef.current = [];
  }, [commitSwipe]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    if (!dragInfo.current) return;
    setDragOffset(0);
    setIsDragging(false);
    dragInfo.current = null;
    movesRef.current = [];
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPage('player');
      else if (e.key === 'ArrowRight') setPage('lyrics');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const translateX = dragOffset !== 0 ? dragOffset : -(pageIdx * 100);

  return (
    <div className="im-page-pager">
      <div className="im-pager-nav">
        <button
          className={`im-pager-nav-btn${page === 'player' ? ' active' : ''}`}
          onClick={() => setPage('player')}
          aria-label="播放頁"
          title="播放"
        >
          <PlayerIcon />
        </button>
        <button
          className={`im-pager-nav-btn${page === 'lyrics' ? ' active' : ''}`}
          onClick={() => setPage('lyrics')}
          aria-label="歌詞頁"
          title="歌詞"
        >
          <LyricsIcon />
        </button>
      </div>
      <div className="im-pager-indicator">
        <span className={`im-pager-dot${pageIdx === 0 ? ' active' : ''}`} />
        <span className={`im-pager-dot${pageIdx === 1 ? ' active' : ''}`} />
      </div>

      <div
        className="im-pager-viewport"
        ref={viewportRef}
        data-dragging={isDragging ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="im-pager-track"
          style={{ transform: `translate3d(${translateX}%, 0, 0)` }}
        >
          <div className="im-pager-pane">{playerPane}</div>
          <div className="im-pager-pane">{lyricsPane}</div>
        </div>
      </div>
    </div>
  );
}
