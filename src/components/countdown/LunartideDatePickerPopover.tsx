// ================================================================
// LunartideDatePickerPopover — custom calendar popover
// Desktop only (fine pointer). Touch devices use native pickers.
// ================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  value: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'];

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function firstDayOfMonth(y: number, m: number): number {
  return new Date(y, m - 1, 1).getDay(); // 0=Sun
}

function buildWeeks(year: number, month: number): Array<{ day: number; monthOffset: -1 | 0 | 1; date: string } | null> {
  const cells: Array<{ day: number; monthOffset: -1 | 0 | 1; date: string } | null> = [];
  const first = firstDayOfMonth(year, month);
  const days = daysInMonth(year, month);
  const prevDays = daysInMonth(year, month - 1 === 0 ? 12 : month - 1);

  let py = month - 1 === 0 ? year - 1 : year;
  let pm = month - 1 === 0 ? 12 : month - 1;
  for (let i = 0; i < first; i++) {
    const pDay = prevDays - first + i + 1;
    cells.push({ day: pDay, monthOffset: -1, date: `${String(py).padStart(4, '0')}-${String(pm).padStart(2, '0')}-${String(pDay).padStart(2, '0')}` });
  }

  for (let d = 1; d <= days; d++) {
    cells.push({ day: d, monthOffset: 0, date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  let ny = month + 1 > 12 ? year + 1 : year;
  let nm = month + 1 > 12 ? 1 : month + 1;
  const total = cells.length;
  const needed = 42 - total;
  for (let d = 1; d <= needed; d++) {
    cells.push({ day: d, monthOffset: 1, date: `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  return cells;
}

export function LunartideDatePickerPopover({ isOpen, value, onSelect, onClose, anchorRef }: Props) {
  const todayStr = localToday();
  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayStr;

  const [year, setYear] = useState(() => parseInt(initial.slice(0, 4), 10));
  const [month, setMonth] = useState(() => parseInt(initial.slice(5, 7), 10));
  const [focusDate, setFocusDate] = useState(initial);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Sync year/month when value changes from outside
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setYear(parseInt(value.slice(0, 4), 10));
      setMonth(parseInt(value.slice(5, 7), 10));
      setFocusDate(value);
    }
  }, [value]);

  // Position relative to anchor
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const anchor = anchorRef.current;
    const rect = anchor.getBoundingClientRect();
    const pw = 280;
    const ph = 350;
    const gap = 8;
    let top = rect.bottom + gap;
    const left = Math.min(rect.left, window.innerWidth - pw - 8);
    if (top + ph > window.innerHeight - 8) {
      top = rect.top - ph - gap;
      if (top < 8) top = Math.max(8, window.innerHeight - ph - 8);
    }
    if (top < 8) top = 8;
    setPos({ top, left: Math.max(8, left) });
  }, [isOpen]);

  // Click away
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [isOpen, onClose]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': e.preventDefault(); onClose(); break;
        case 'ArrowLeft': e.preventDefault(); moveFocus(-1, 0); break;
        case 'ArrowRight': e.preventDefault(); moveFocus(1, 0); break;
        case 'ArrowUp': e.preventDefault(); moveFocus(0, -7); break;
        case 'ArrowDown': e.preventDefault(); moveFocus(0, 7); break;
        case 'PageUp': e.preventDefault(); prevMonth(); break;
        case 'PageDown': e.preventDefault(); nextMonth(); break;
        case 'Enter': case ' ': e.preventDefault(); selectFocused(); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, focusDate, year, month]);

  const moveFocus = useCallback((dx: number, dy: number) => {
    const [fy, fm, fd] = focusDate.split('-').map(Number);
    const cur = new Date(fy, fm - 1, fd);
    cur.setDate(cur.getDate() + dx + dy);
    const ny = cur.getFullYear();
    const nm = cur.getMonth() + 1;
    setYear(ny);
    setMonth(nm);
    setFocusDate(`${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
  }, [focusDate]);

  const selectFocused = useCallback(() => {
    if (focusDate) {
      onSelect(focusDate);
      onClose();
    }
  }, [focusDate, onSelect, onClose]);

  const prevMonth = useCallback(() => {
    setMonth((m) => { if (m === 1) { setYear((y) => y - 1); return 12; } return m - 1; });
  }, []);
  const nextMonth = useCallback(() => {
    setMonth((m) => { if (m === 12) { setYear((y) => y + 1); return 1; } return m + 1; });
  }, []);

  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="cde-popover"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-modal="false"
      aria-label="選擇日期"
    >
      {/* Header */}
      <div className="cde-popover-head">
        <button type="button" className="cde-popover-nav" onClick={prevMonth} aria-label="上一月">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="cde-popover-month">{year} 年 {MONTH_LABELS[month - 1]}</span>
        <button type="button" className="cde-popover-nav" onClick={nextMonth} aria-label="下一月">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Weekdays */}
      <div className="cde-popover-weekdays" ref={gridRef}>
        {WEEKDAYS.map((w) => <span key={w} className="cde-popover-wd">{w}</span>)}
      </div>

      {/* Grid */}
      <div className="cde-popover-grid" role="grid" aria-label="日期網格">
        {weeks.map((cell, i) => {
          if (!cell) return <span key={i} className="cde-popover-cell cde-popover-cell--empty" />;
          const isSelected = cell.date === value;
          const isToday = cell.date === todayStr;
          const isOutside = cell.monthOffset !== 0;
          const isFocused = cell.date === focusDate;

          return (
            <button
              key={`${cell.monthOffset}-${cell.day}`}
              type="button"
              className={`cde-popover-cell${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${isOutside ? ' outside' : ''}${isFocused ? ' focused' : ''}`}
              onClick={() => { onSelect(cell.date); onClose(); }}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${cell.date}${isToday ? ' 今天' : ''}`}
              tabIndex={isFocused ? 0 : -1}
            >
              <span className="cde-popover-cell-num">{cell.day}</span>
              {isToday && <span className="cde-popover-cell-today-dot" />}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="cde-popover-foot">
        <button type="button" className="cde-popover-foot-btn" onClick={() => { onSelect(''); onClose(); }}>清除</button>
        <button type="button" className="cde-popover-foot-btn primary" onClick={() => { onSelect(todayStr); onClose(); }}>今天</button>
      </div>
    </div>,
    document.body,
  );
}
