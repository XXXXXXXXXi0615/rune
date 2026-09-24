/**
 * WheelPicker — iOS-style scroll picker.
 *
 * Single unified API: <WheelPicker columns={[...]} />
 * Internally uses WheelColumnCore for each column.
 * Supports optional masks, highlight bar, and column separators.
 */
import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import './WheelPicker.css';

export interface WheelColumnSpec {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
}

interface WheelPickerProps {
  columns: WheelColumnSpec[];
  height?: number;
  itemHeight?: number;
  /** Separator strings rendered between columns, e.g. ['/', '/'] for date or [':'] for time */
  separators?: string[];
  /** Show top/bottom fade masks (default true) */
  masks?: boolean;
  /** Show center highlight bar (default true) */
  highlight?: boolean;
}

const ITEM_HEIGHT_DEFAULT = 44;
const VISIBLE_ITEMS = 5;

export function WheelPicker({
  columns,
  height = 216,
  itemHeight = ITEM_HEIGHT_DEFAULT,
  separators,
  masks = true,
  highlight = true,
}: WheelPickerProps) {
  const bare = !masks && !highlight;

  const colElements: ReactNode[] = [];
  columns.forEach((col, ci) => {
    colElements.push(
      <WheelColumnCore
        key={ci}
        items={col.items}
        selectedIndex={col.selectedIndex}
        onChange={col.onChange}
        ariaLabel={col.ariaLabel}
        pickerHeight={height}
        itemHeight={itemHeight}
        renderItem={(item) => item}
      />,
    );
    if (separators && separators[ci]) {
      colElements.push(
        <span key={`sep-${ci}`} className="wheel-picker-separator">{separators[ci]}</span>,
      );
    }
  });

  return (
    <div className={`wheel-picker${bare ? ' wheel-picker--bare' : ''}`} style={{ height }}>
      {masks && <div className="wheel-picker-mask wheel-picker-mask--top" />}
      {masks && <div className="wheel-picker-mask wheel-picker-mask--bottom" />}
      {highlight && (
        <div
          className="wheel-picker-highlight"
          style={{ height: itemHeight, top: (height - itemHeight) / 2 }}
        />
      )}
      <div className="wheel-picker-columns">
        {colElements}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Core scroll column (shared by both APIs)
   ══════════════════════════════════════ */

function WheelColumnCore({
  items,
  selectedIndex,
  onChange,
  pickerHeight,
  itemHeight,
  renderItem,
  ariaLabel,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  pickerHeight: number;
  itemHeight: number;
  renderItem: (item: string, index: number) => ReactNode;
  ariaLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedIndex);
  const ignoreProgrammaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdProgrammaticScroll = useCallback(() => {
    ignoreProgrammaticScrollRef.current = true;
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = setTimeout(() => { ignoreProgrammaticScrollRef.current = false; }, 80);
  }, []);

  const halfVisible = Math.floor(VISIBLE_ITEMS / 2);
  const padPx = halfVisible * itemHeight;

  const indexFromScroll = useCallback(
    (scrollTop: number) => {
      const raw = Math.round(scrollTop / itemHeight);
      return Math.max(0, Math.min(raw, items.length - 1));
    },
    [items.length, itemHeight],
  );

  useEffect(() => {
    selectedRef.current = selectedIndex;
  }, [selectedIndex]);

  // Keep the visual snap point aligned when another column clamps this value.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      const nextTop = selectedIndex * itemHeight;
      selectedRef.current = selectedIndex;
      if (Math.abs(el.scrollTop - nextTop) > 1) {
        holdProgrammaticScroll();
        el.scrollTop = nextTop;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [holdProgrammaticScroll, itemHeight, padPx, selectedIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || ignoreProgrammaticScrollRef.current) return;
    const idx = indexFromScroll(el.scrollTop);
    if (idx === selectedRef.current) return;
    selectedRef.current = idx;
    onChange(idx);
  }, [indexFromScroll, onChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => () => {
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex = selectedRef.current;
    if (event.key === 'ArrowUp') nextIndex -= 1;
    else if (event.key === 'ArrowDown') nextIndex += 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else return;
    event.preventDefault();
    nextIndex = Math.max(0, Math.min(nextIndex, items.length - 1));
    if (nextIndex === selectedRef.current) return;
    selectedRef.current = nextIndex;
    if (scrollRef.current) {
      holdProgrammaticScroll();
      scrollRef.current.scrollTop = nextIndex * itemHeight;
    }
    onChange(nextIndex);
  }, [holdProgrammaticScroll, itemHeight, items.length, onChange]);

  return (
    <div className="wheel-picker-column" style={{ height: pickerHeight }}>
      <div
        ref={scrollRef}
        className="wheel-picker-scroll"
        style={{ height: pickerHeight }}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div style={{ height: padPx, flexShrink: 0 }} />
        {items.map((item, i) => (
          <div
            key={i}
            className={`wheel-picker-item${i === selectedIndex ? ' is-selected' : ''}`}
            style={{ height: itemHeight }}
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => {
              if (i === selectedRef.current) return;
              selectedRef.current = i;
              if (scrollRef.current) {
                holdProgrammaticScroll();
                scrollRef.current.scrollTop = i * itemHeight;
              }
              onChange(i);
            }}
          >
            {renderItem(item, i)}
          </div>
        ))}
        <div style={{ height: padPx, flexShrink: 0 }} />
      </div>
    </div>
  );
}
