import { useEffect, useRef, useState } from 'react';

interface TimePickerPopupProps {
  value: string;       // HH:MM
  onSelect: (time: string) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function TimePickerPopup({ value, onSelect, onClose }: TimePickerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, m] = value && value.includes(':') ? value.split(':') : ['12', '00'];
  const [hour, setHour] = useState(h);
  const [minute, setMinute] = useState(m);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="time-picker-popup" ref={ref}>
      <div className="time-picker-columns">
        <div className="time-picker-col">
          {HOURS.map(hh => (
            <button
              key={hh}
              type="button"
              className={`time-picker-opt${hh === hour ? ' active' : ''}`}
              onClick={() => setHour(hh)}
            >
              {hh}
            </button>
          ))}
        </div>
        <span className="time-picker-colon">:</span>
        <div className="time-picker-col">
          {MINUTES.map(mm => (
            <button
              key={mm}
              type="button"
              className={`time-picker-opt${mm === minute ? ' active' : ''}`}
              onClick={() => setMinute(mm)}
            >
              {mm}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="time-picker-confirm"
        onClick={() => { onSelect(`${hour}:${minute}`); onClose(); }}
      >
        確認
      </button>
    </div>
  );
}
