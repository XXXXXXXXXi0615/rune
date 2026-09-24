import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, type WheelColumnSpec } from './WheelPicker';
import { daysInMonth, splitDate, todayStr } from './pickerUtils';
import './WheelPicker.css';

interface DateWheelPickerProps {
  isOpen: boolean;
  value: string;
  title?: string;
  triggerRect?: DOMRect;
  allowClear?: boolean;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => String(MIN_YEAR + index));
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));

export function clampWheelDate(year: number, month: number, day: number) {
  const safeYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
  const safeMonth = Math.min(12, Math.max(1, month));
  return { year: safeYear, month: safeMonth, day: Math.min(daysInMonth(safeYear, safeMonth), Math.max(1, day)) };
}

function safeParts(value: string) {
  const parts = splitDate(value || todayStr());
  return clampWheelDate(parts.year, parts.month, parts.day);
}

export function DateWheelPicker({
  isOpen,
  value,
  title = '選擇日期',
  triggerRect,
  allowClear = false,
  onConfirm,
  onCancel,
}: DateWheelPickerProps) {
  const initial = safeParts(value);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

  useEffect(() => {
    if (!isOpen) return;
    const next = safeParts(value);
    setYear(next.year);
    setMonth(next.month);
    setDay(next.day);
    previousFocusRef.current = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, value]);

  useEffect(() => {
    const next = clampWheelDate(year, month, day);
    if (day !== next.day) setDay(next.day);
  }, [day, month, year]);

  const closeAndRestore = useCallback((callback: () => void) => {
    callback();
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  const confirm = useCallback(() => {
    const safeDay = Math.min(day, daysInMonth(year, month));
    closeAndRestore(() => onConfirm(`${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`));
  }, [closeAndRestore, day, month, onConfirm, year]);

  const cancel = useCallback(() => closeAndRestore(onCancel), [closeAndRestore, onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      } else if (event.key === 'Enter' && document.activeElement?.getAttribute('role') === 'listbox') {
        event.preventDefault();
        confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel, confirm, isOpen]);

  const maximumDay = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: maximumDay }, (_, index) => String(index + 1).padStart(2, '0')), [maximumDay]);
  const safeDay = Math.min(day, maximumDay);
  const columns: WheelColumnSpec[] = useMemo(() => [
    { ariaLabel: '年', items: YEARS, selectedIndex: year - MIN_YEAR, onChange: (index) => setYear(MIN_YEAR + index) },
    { ariaLabel: '月', items: MONTHS, selectedIndex: month - 1, onChange: (index) => setMonth(index + 1) },
    { ariaLabel: '日', items: days, selectedIndex: safeDay - 1, onChange: (index) => setDay(index + 1) },
  ], [days, month, safeDay, year]);

  if (!isOpen) return null;

  let style: React.CSSProperties | undefined;
  if (!isMobile && triggerRect) {
    const width = 348;
    const height = 350;
    const left = Math.max(12, Math.min(triggerRect.left, window.innerWidth - width - 12));
    const preferredTop = triggerRect.bottom + 8;
    const top = preferredTop + height <= window.innerHeight - 12
      ? preferredTop
      : Math.max(12, triggerRect.top - height - 8);
    style = { position: 'fixed', left, top, width, zIndex: 1900 };
  }

  const dialog = (
    <div
      ref={dialogRef}
      className={`date-wheel-picker ${isMobile ? 'date-wheel-picker--sheet' : 'date-wheel-picker--popover'}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="date-wheel-picker"
      data-presentation={isMobile ? 'bottom-sheet' : 'popover'}
      data-value={`${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`}
      onClick={(event) => event.stopPropagation()}
    >
      {isMobile && <div className="date-wheel-picker__handle" aria-hidden="true" />}
      <header>
        <span>DATE</span>
        <h3>{title}</h3>
      </header>
      <div className="date-wheel-picker__labels" aria-hidden="true"><span>年</span><span>月</span><span>日</span></div>
      <WheelPicker columns={columns} separators={['', '']} height={220} itemHeight={44} />
      <div className="cal-picker-actions">
        {allowClear && <button type="button" className="cal-picker-btn cal-picker-btn--clear" onClick={() => closeAndRestore(() => onConfirm(''))}>清除</button>}
        <button type="button" className="cal-picker-btn cal-picker-btn--cancel" onClick={cancel}>取消</button>
        <button type="button" className="cal-picker-btn cal-picker-btn--confirm" onClick={confirm}>確認</button>
      </div>
    </div>
  );

  return createPortal(
    <div className="date-wheel-picker__overlay" onClick={cancel} data-mobile={isMobile || undefined}>
      {dialog}
    </div>,
    document.body,
  );
}
