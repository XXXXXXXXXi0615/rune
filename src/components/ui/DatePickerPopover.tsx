import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, type WheelColumnSpec } from './WheelPicker';
import * as P from './pickerUtils';
import './WheelPicker.css';

interface DatePickerPopoverProps {
  isOpen: boolean;
  value: string;
  triggerRect?: DOMRect;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

type Mode = 'grid' | 'yearmonth';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const YRS = Array.from({ length: 201 }, (_, i) => String(1900 + i));
const MOS = Array.from({ length: 12 }, (_, i) => MONTH_NAMES[i]);

export function DatePickerPopover({
  isOpen,
  value,
  triggerRect,
  onConfirm,
  onCancel,
}: DatePickerPopoverProps) {
  const parsed = P.splitDate(value);
  const [mode, setMode] = useState<Mode>('grid');
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [selDay, setSelDay] = useState<number | null>(parsed.day);
  const [wheelYear, setWheelYear] = useState(parsed.year);
  const [wheelMonth, setWheelMonth] = useState(parsed.month);
  const popoverRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

  const days = useMemo(() => {
    const dim = P.daysInMonth(viewYear, viewMonth);
    const fdom = P.firstDayOfMonth(viewYear, viewMonth);
    const cells: Array<{ d: number; other: boolean }> = [];
    for (let i = 0; i < fdom; i++) cells.push({ d: 0, other: true });
    for (let d = 1; d <= dim; d++) cells.push({ d, other: false });
    while (cells.length % 7 !== 0) cells.push({ d: 0, other: true });
    return cells;
  }, [viewYear, viewMonth]);

  const today = P.todayStr();

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement;
    const timer = requestAnimationFrame(() => {
      popoverRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  // Reset mode when opening
  useEffect(() => {
    if (isOpen) {
      setMode('grid');
      const p = P.splitDate(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelDay(p.day);
      setWheelYear(p.year);
      setWheelMonth(p.month);
    }
  }, [isOpen, value]);

  const goPrevMonth = useCallback(() => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else setViewMonth(viewMonth - 1);
  }, [viewYear, viewMonth]);

  const goNextMonth = useCallback(() => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else setViewMonth(viewMonth + 1);
  }, [viewYear, viewMonth]);

  const selectDay = useCallback((d: number) => {
    setSelDay(d);
  }, []);

  const handleQuickDate = useCallback((offset: number) => {
    const d = P.addDays(P.todayStr(), offset);
    const p = P.splitDate(d);
    setViewYear(p.year);
    setViewMonth(p.month);
    setSelDay(p.day);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selDay !== null) {
      const mm = String(viewMonth).padStart(2, '0');
      const dd = String(selDay).padStart(2, '0');
      onConfirm(`${viewYear}-${mm}-${dd}`);
    } else {
      onConfirm('');
    }
  }, [selDay, viewYear, viewMonth, onConfirm]);

  const handleClear = useCallback(() => {
    setSelDay(null);
    onConfirm('');
  }, [onConfirm]);

  const openWheelMode = useCallback(() => {
    setWheelYear(viewYear);
    setWheelMonth(viewMonth);
    setMode('yearmonth');
  }, [viewYear, viewMonth]);

  const confirmWheel = useCallback(() => {
    setViewYear(wheelYear);
    setViewMonth(wheelMonth);
    setSelDay(Math.min(selDay ?? 1, P.daysInMonth(wheelYear, wheelMonth)));
    setMode('grid');
  }, [wheelYear, wheelMonth, selDay]);

  const wheelColumns: WheelColumnSpec[] = useMemo(() => {
    const yi = YRS.indexOf(String(wheelYear));
    const mi = MOS.indexOf(MONTH_NAMES[wheelMonth - 1]);
    return [
      { items: YRS, selectedIndex: yi >= 0 ? yi : 100, onChange: (i) => setWheelYear(parseInt(YRS[i], 10)) },
      { items: MOS, selectedIndex: mi >= 0 ? mi : 0, onChange: (i) => setWheelMonth(i + 1) },
    ];
  }, [wheelYear, wheelMonth]);

  if (!isOpen) return null;

  // Position desktop popover
  let popoverStyle: React.CSSProperties | undefined;
  if (!isMobile && triggerRect) {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const pw = 340;
    let left = triggerRect.left;
    if (left + pw > winW - 12) left = winW - pw - 12;
    if (left < 12) left = 12;
    let top = triggerRect.bottom + 6;
    if (top + 400 > winH) top = triggerRect.top - 400 - 6;
    popoverStyle = { position: 'fixed', left, top, width: pw, zIndex: 1800 };
  }

  const content = (
    <div className={isMobile ? 'cal-picker-sheet' : 'cal-picker-popover'} ref={popoverRef} style={!isMobile ? popoverStyle : undefined}>
      {mode === 'grid' ? (
        <>
          <div className="cal-date-header">
            <button type="button" className="cal-date-nav" onClick={goPrevMonth} aria-label="上一個月">◀</button>
            <button type="button" className="cal-date-title-btn" onClick={openWheelMode}>
              {viewYear} 年 {viewMonth} 月
            </button>
            <button type="button" className="cal-date-nav" onClick={goNextMonth} aria-label="下一個月">▶</button>
          </div>

          <div className="cal-date-weekdays">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="cal-date-grid">
            {days.map((cell, i) => {
              if (cell.other) return <div key={i} />;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(cell.d).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isSelected = cell.d === selDay && !isToday;
              return (
                <button
                  key={i}
                  type="button"
                  data-autofocus={i === 0 && cell.d === selDay ? true : undefined}
                  className={`cal-date-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                  onClick={() => selectDay(cell.d)}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>

          <div className="cal-date-quick">
            {[0, 1, 2].map((offset) => {
              const d = P.addDays(P.todayStr(), offset);
              const p = P.splitDate(d);
              const isActive = p.year === viewYear && p.month === viewMonth && p.day === selDay;
              return (
                <button
                  key={offset}
                  type="button"
                  className={`cal-date-chip${isActive ? ' active' : ''}`}
                  onClick={() => handleQuickDate(offset)}
                >
                  {['今天', '明天', '後天'][offset]}
                </button>
              );
            })}
          </div>

          <div className="cal-picker-actions">
            <button type="button" className="cal-picker-btn cal-picker-btn--clear" onClick={handleClear}>清除</button>
            <button type="button" className="cal-picker-btn cal-picker-btn--cancel" onClick={onCancel}>取消</button>
            <button type="button" className="cal-picker-btn cal-picker-btn--confirm" onClick={handleConfirm}>確定</button>
          </div>
        </>
      ) : (
        <>
          <div className="cal-date-header">
            <span className="cal-date-title">選擇年月</span>
          </div>
          <div style={{ padding: '0 16px', height: 200 }}>
            <WheelPicker columns={wheelColumns} separators={['/']} masks={false} highlight={false} />
          </div>
          <div className="cal-picker-actions">
            <button type="button" className="cal-picker-btn cal-picker-btn--cancel" onClick={() => setMode('grid')}>返回</button>
            <button type="button" className="cal-picker-btn cal-picker-btn--confirm" onClick={confirmWheel}>確認</button>
          </div>
        </>
      )}
    </div>
  );

  const backdrop = (
    <div className="cal-picker-overlay" onClick={onCancel}>
      {content}
    </div>
  );

  if (isMobile) {
    return createPortal(backdrop, document.body);
  }
  return createPortal(content, document.body);
}
