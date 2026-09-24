import type { TideboundMode } from './types';

export interface TideboundModeDef {
  key: TideboundMode;
  label: string;
  desc: string;
  minutes: number;
}

export const TIDEBOUND_MODES: TideboundModeDef[] = [
  { key: 'espresso', label: 'Espresso', desc: '硬啟動', minutes: 5 },
  { key: 'flow', label: 'Flow', desc: '守約', minutes: 25 },
  { key: 'deep_work', label: 'Deep Work', desc: '深度', minutes: 50 },
  { key: 'night', label: 'Night', desc: '夜間短守約', minutes: 8 },
];

interface TideboundModeGridProps {
  selectedMode: TideboundMode | null;
  onSelect: (mode: TideboundMode, minutes: number) => void;
}

export function TideboundModeGrid({ selectedMode, onSelect }: TideboundModeGridProps) {
  return (
    <div className="tb-mode-grid">
      {TIDEBOUND_MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          className={`tb-mode-card${selectedMode === m.key ? ' tb-mode-card--active' : ''}`}
          onClick={() => onSelect(m.key, m.minutes)}
        >
          <span className="tb-mode-card-label">{m.label}</span>
          <small className="tb-mode-card-desc">{m.desc}</small>
          <small className="tb-mode-card-time">{m.minutes} 分</small>
        </button>
      ))}
    </div>
  );
}
