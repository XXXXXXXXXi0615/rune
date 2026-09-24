const QUICK_PRESETS = [15, 25, 40, 60];
const MIN_DURATION = 5;
const MAX_DURATION = 120;

interface TideboundDurationControlProps {
  minutes: number;
  onChange: (minutes: number) => void;
  compact?: boolean;
}

function clamp(n: number): number {
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, Number.isFinite(n) ? Math.round(n) : 25));
}

export function TideboundDurationControl({ minutes, onChange, compact }: TideboundDurationControlProps) {
  const safe = clamp(minutes);

  return (
    <div className={`tb-duration${compact ? ' tb-duration--compact' : ''}`}>
      <div className="tb-duration-stepper">
        <button
          type="button"
          className="tb-stepper-btn"
          onClick={() => onChange(clamp(safe - 5))}
          aria-label="减少 5 分钟"
          disabled={safe <= MIN_DURATION}
        >−</button>
        <span className="tb-duration-value">{safe} 分</span>
        <button
          type="button"
          className="tb-stepper-btn"
          onClick={() => onChange(clamp(safe + 5))}
          aria-label="增加 5 分钟"
          disabled={safe >= MAX_DURATION}
        >+</button>
      </div>
      {!compact && (
        <div className="tb-duration-presets">
          {QUICK_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              className={`tb-preset-chip${safe === m ? ' tb-preset-chip--active' : ''}`}
              onClick={() => onChange(m)}
            >{m}</button>
          ))}
        </div>
      )}
    </div>
  );
}
