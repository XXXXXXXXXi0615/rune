import { useRef, useEffect, useCallback, useState, useMemo } from 'react';

const ITEM_H = 40;
const VISIBLE_ITEMS = 5;
const BUFFER = 8;

function generateItems(min: number, max: number, step: number): number[] {
  const items: number[] = [];
  for (let v = min; v <= max; v += step) items.push(v);
  return items;
}

export function WheelPicker({ value, min, max, step = 1, unit, onChange }: {
  value: number; min: number; max: number; step?: number; unit: string;
  onChange: (val: number) => void;
}) {
  const items = useMemo(() => generateItems(min, max, step), [min, max, step]);
  const totalH = items.length * ITEM_H;
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(false);
  const [snappedIdx, setSnappedIdx] = useState(() => {
    const i = items.indexOf(value);
    return i >= 0 ? i : 0;
  });
  const [scrollTop, setScrollTop] = useState(0);

  const scrollTo = useCallback((idx: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    skipScroll.current = true;
    const top = idx * ITEM_H;
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
    setSnappedIdx(idx);
    setScrollTop(top);
    requestAnimationFrame(() => { skipScroll.current = false; });
  }, []);

  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx >= 0) scrollTo(idx, false);
  }, []);

  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx >= 0) scrollTo(idx, true);
  }, [value]);

  const onScroll = useCallback(() => {
    if (skipScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const st = el.scrollTop;
    setScrollTop(st);
    const idx = Math.round(st / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    setSnappedIdx(clamped);
    const v = items[clamped];
    if (v !== undefined && v !== value) onChange(v);
  }, [items, value, onChange]);

  /* Virtual range */
  const centerIdx = Math.round(scrollTop / ITEM_H);
  const halfVisible = Math.ceil(VISIBLE_ITEMS / 2) + BUFFER;
  const startIdx = Math.max(0, centerIdx - halfVisible);
  const endIdx = Math.min(items.length, centerIdx + halfVisible + 1);
  const visibleItems = useMemo(
    () => items.slice(startIdx, endIdx),
    [items, startIdx, endIdx]
  );
  const offsetY = startIdx * ITEM_H;
  const padHeight = 80; // (container height 200 - item height 40) / 2, for centering

  return (
    <div className="wp-col">
      <div className="wp-highlight" />
      <div className="wp-mask wp-mask--top" />
      <div className="wp-mask wp-mask--bottom" />
      <div ref={scrollRef} className="wp-scroll" onScroll={onScroll}>
        <div style={{ height: padHeight + offsetY, flexShrink: 0 }} />
        {visibleItems.map((v, i) => {
          const realIdx = startIdx + i;
          return (
            <div key={v} className={`wp-item${realIdx === snappedIdx ? ' snapped' : ''}`}
              aria-hidden={realIdx !== snappedIdx}>{v}</div>
          );
        })}
        <div style={{ height: padHeight + totalH - offsetY - visibleItems.length * ITEM_H, flexShrink: 0 }} />
      </div>
      <span className="wp-unit">{unit}</span>
    </div>
  );
}
