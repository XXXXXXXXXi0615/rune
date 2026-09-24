import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, type WheelColumnSpec } from './WheelPicker';
import './WheelPicker.css';

interface DurationPickerProps {
  isOpen: boolean;
  value: number;
  triggerRect?: DOMRect;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}

const HOURS_ITEMS = Array.from({ length: 13 }, (_, i) => `${i} 小時`);
const MIN_ITEMS = ['0 分', '5 分', '10 分', '15 分', '20 分', '25 分', '30 分', '35 分', '40 分', '45 分', '50 分', '55 分'];
const MIN_VALS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function DurationPicker({
  isOpen,
  value,
  triggerRect,
  onConfirm,
  onCancel,
}: DurationPickerProps) {
  const initH = Math.floor(value / 60);
  const initM = value % 60;
  const nearestMin = MIN_VALS.reduce((a, b) => Math.abs(b - initM) < Math.abs(a - initM) ? b : a);
  const [hours, setHours] = useState(Math.min(initH, 12));
  const [minutes, setMinutes] = useState(nearestMin);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

  useEffect(() => {
    if (!isOpen) return;
    const h = Math.floor(value / 60);
    const m = value % 60;
    setHours(Math.min(h, 12));
    setMinutes(MIN_VALS.reduce((a, b) => Math.abs(b - m) < Math.abs(a - m) ? b : a));
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  const columns: WheelColumnSpec[] = useMemo(() => [
    { items: HOURS_ITEMS, selectedIndex: hours, onChange: (i) => setHours(i) },
    { items: MIN_ITEMS, selectedIndex: Math.max(0, MIN_VALS.indexOf(minutes)), onChange: (i) => setMinutes(MIN_VALS[i]) },
  ], [hours, minutes]);

  const handleConfirm = useCallback(() => {
    onConfirm(hours * 60 + minutes);
  }, [hours, minutes, onConfirm]);

  if (!isOpen) return null;

  let popoverStyle: React.CSSProperties | undefined;
  if (!isMobile && triggerRect) {
    const pw = 300;
    let left = triggerRect.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    if (left < 12) left = 12;
    let top = triggerRect.bottom + 6;
    if (top + 340 > window.innerHeight) top = triggerRect.top - 340 - 6;
    popoverStyle = { position: 'fixed', left, top, width: pw, zIndex: 1800 };
  }

  const content = (
    <div className={isMobile ? 'cal-picker-sheet' : 'cal-picker-popover'} ref={popoverRef} style={!isMobile ? popoverStyle : undefined}>
      <h3 className="cal-picker-title">自訂時長</h3>

      <div style={{ height: 180, padding: '0 12px' }}>
        <WheelPicker columns={columns} masks={false} highlight={false} />
      </div>

      <div className="cal-picker-actions">
        <button type="button" className="cal-picker-btn cal-picker-btn--cancel" onClick={onCancel}>取消</button>
        <button type="button" className="cal-picker-btn cal-picker-btn--confirm" onClick={handleConfirm}>確定</button>
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="cal-picker-overlay" onClick={onCancel}>{content}</div>,
      document.body,
    );
  }
  return createPortal(content, document.body);
}
