import { useEffect, useMemo, useRef, useState } from 'react';
import { useCompanionBoardStore, type BoardItem } from '@/store/useCompanionBoardStore';
import './MoonBroadcastTicker.css';

function relativeAge(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '昨天' : `${days} 天前`;
}

/** 月潮播报 — a quiet ticker over text-only board entries.
 *  Pure visual projection: the duplicated animation track is aria-hidden and
 *  the semantic list lives in the Moments board panel. */
export function MoonBroadcastTicker({ onOpenItem }: { onOpenItem: (item: BoardItem) => void }) {
  const boardItems = useCompanionBoardStore((state) => state.boardItems);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // Text-only summaries, newest first.
  const entries = useMemo(() => boardItems
    .filter((item) => Boolean((item.note || item.title).trim()))
    .map((item) => ({ item, text: (item.note || item.title).trim(), age: relativeAge(item.createdAt) }))
    .sort((a, b) => b.item.createdAt - a.item.createdAt)
    .slice(0, 12), [boardItems]);

  const staticEntry = entries[0];
  const shouldAnimate = entries.length > 1 && !paused && !reducedMotion;

  if (entries.length === 0) {
    return <div className="moon-broadcast" data-testid="moon-broadcast" data-state="empty">
      <span className="moon-broadcast__title">月潮播報</span>
      <p className="moon-broadcast__static">還沒有留言。</p>
    </div>;
  }

  if (entries.length === 1 || reducedMotion) {
    return <div className="moon-broadcast" data-testid="moon-broadcast" data-state={reducedMotion && entries.length > 1 ? 'reduced' : 'single'}>
      <span className="moon-broadcast__title">月潮播報</span>
      <button
        type="button"
        className="moon-broadcast__static"
        data-testid="moon-broadcast-static"
        onClick={() => onOpenItem(staticEntry.item)}
      >
        「{staticEntry.text}」<small> · {staticEntry.age}</small>
      </button>
    </div>;
  }

  const track = [
    ...entries.map((entry) => ({ ...entry, key: `${entry.item.id}-a` })),
    ...entries.map((entry) => ({ ...entry, key: `${entry.item.id}-b` })),
  ];

  return <div
    className="moon-broadcast"
    data-testid="moon-broadcast"
    data-state={paused ? 'paused' : 'scrolling'}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={() => setPaused(false)}
    onTouchStart={() => setPaused(true)}
    onTouchEnd={() => setPaused(false)}
  >
    <span className="moon-broadcast__title">月潮播報</span>
    <div className="moon-broadcast__viewport">
      {/* Visible, semantic copy for assistive tech (single pass, no duplicates). */}
      <ul className="moon-broadcast__sr" data-testid="moon-broadcast-list">
        {entries.map((entry) => <li key={entry.item.id}>
          <button type="button" onClick={() => onOpenItem(entry.item)}>「{entry.text}」 · {entry.age}</button>
        </li>)}
      </ul>
      <div
        ref={trackRef}
        className="moon-broadcast__track"
        aria-hidden="true"
        data-animate={shouldAnimate ? 'true' : 'false'}
        style={{ animationDuration: `${Math.max(24, entries.length * 9)}s` }}
      >
        {track.map((entry) => <button key={entry.key} type="button" tabIndex={-1} onClick={() => onOpenItem(entry.item)}>
          「{entry.text}」<small> · {entry.age}</small>
        </button>)}
      </div>
    </div>
  </div>;
}
