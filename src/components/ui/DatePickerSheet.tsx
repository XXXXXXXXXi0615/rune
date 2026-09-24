import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, type WheelColumnSpec } from './WheelPicker';

/* ════════════════════════════════════════
   DATE PICKER BOTTOM SHEET
   iOS-style wheel picker: year / month / day
   ════════════════════════════════════════ */

interface DatePickerSheetProps {
  isOpen: boolean;
  value: string;       // YYYY-MM-DD
  title?: string;
  compact?: boolean;    // lighter overlay (Timekeeper use)
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

export function DatePickerSheet({
  isOpen,
  value,
  title = '選擇日期',
  compact = false,
  onConfirm,
  onCancel,
}: DatePickerSheetProps) {
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(isOpen);
    if (isOpen) {
      const d = value ? new Date(value + 'T00:00:00') : new Date();
      if (!isNaN(d.getTime())) {
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
        setDay(d.getDate());
      } else {
        const now = new Date();
        setYear(now.getFullYear());
        setMonth(now.getMonth() + 1);
        setDay(now.getDate());
      }
    }
  }, [isOpen, value]);

  // Auto-correct day when month/year reduces available days
  useEffect(() => {
    if (!isOpen || !ready) return;
    const maxDay = new Date(year, month, 0).getDate();
    if (day > maxDay) setDay(maxDay);
  }, [isOpen, ready, year, month, day]);

  // ── All hooks must be called unconditionally, BEFORE any early return ──

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 21 }, (_, i) => String(currentYear - 5 + i)), [currentYear]);
  const monthsItems = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);

  // Use safe defaults when not ready, so the useMemo deps produce valid values.
  const activeYear = ready ? year : currentYear;
  const activeMonth = ready ? month : new Date().getMonth() + 1;
  const activeDay = ready ? day : new Date().getDate();

  const maxDay = new Date(activeYear, activeMonth, 0).getDate();
  const safeDay = Math.min(activeDay, maxDay);
  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0')), [maxDay]);

  const columns: WheelColumnSpec[] = useMemo(() => [
    { items: years, selectedIndex: Math.max(0, years.indexOf(String(activeYear))), onChange: (i) => setYear(parseInt(years[i], 10)) },
    { items: monthsItems, selectedIndex: Math.max(0, activeMonth - 1), onChange: (i) => setMonth(i + 1) },
    { items: days, selectedIndex: Math.max(0, safeDay - 1), onChange: (i) => setDay(i + 1) },
  ], [years, monthsItems, days, activeYear, activeMonth, safeDay]);

  // ── Early return AFTER all hooks ──
  if (!isOpen || !ready) return null;

  function handleConfirm() {
    const mm = String(month).padStart(2, '0');
    const dd = String(safeDay).padStart(2, '0');
    onConfirm(`${year}-${mm}-${dd}`);
    onCancel();
  }

  return createPortal(
    <div className={`wheel-sheet-overlay${compact ? ' wheel-sheet-overlay--compact' : ''}`} onClick={onCancel}>
      <div className={`wheel-sheet${compact ? ' wheel-sheet--compact' : ''}`} onClick={(e) => e.stopPropagation()}>
        {!compact && <div className="wheel-sheet-handle" />}
        <h3 className="wheel-sheet-title">{title}</h3>
        <WheelPicker columns={columns} separators={['/', '/']} masks={false} highlight={false} />
        <div className="wheel-sheet-actions">
          <button type="button" className="wheel-btn-cancel" onClick={onCancel}>取消</button>
          <button type="button" className="wheel-btn-confirm" onClick={handleConfirm}>確認</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
