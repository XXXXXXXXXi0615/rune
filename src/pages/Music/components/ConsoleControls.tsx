import { useRef, useState } from 'react';

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export function MetalKnob({ label, value, min, max, step, unit, onChange, defaultValue = 0, formatValue, scaleLabels }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (value: number) => void; defaultValue?: number;
  formatValue?: (value: number) => string;
  scaleLabels?: [string, string, string];
}) {
  const start = useRef<{ y: number; value: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const commit = (next: number) => onChange(Math.round(clamp(next, min, max) / step) * step);
  const ratio = (value - min) / (max - min);
  const valueLabel = formatValue?.(value) ?? `${unit === 'dB' && value > 0 ? '+' : ''}${value.toFixed(step < 1 ? 1 : 0)}${unit ? ` ${unit}` : ''}`;
  return <div className="metal-knob-control">
    <div
      className="metal-knob"
      role="slider" tabIndex={0}
      aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueLabel}
      style={{ '--knob-angle': `${-135 + ratio * 270}deg` } as React.CSSProperties}
      onPointerDown={(event) => { start.current = { y: event.clientY, value }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (start.current) commit(start.current.value + (start.current.y - event.clientY) * step); }}
      onPointerUp={() => { start.current = null; }}
      onWheel={(event) => { event.preventDefault(); commit(value + (event.deltaY < 0 ? step : -step)); }}
      onDoubleClick={() => commit(defaultValue)}
      onKeyDown={(event) => {
        const fine = event.shiftKey ? step / 10 : step;
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); commit(value + fine); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); commit(value - fine); }
        if (event.key === 'Home') commit(min);
        if (event.key === 'End') commit(max);
      }}
    ><span className="metal-knob__cap"><i /></span></div>
    {scaleLabels && <span className="metal-knob__scale" aria-hidden="true"><i>{scaleLabels[0]}</i><i>{scaleLabels[1]}</i><i>{scaleLabels[2]}</i></span>}
    <strong>{label}</strong>
    {editing ? <input className="metal-knob__input" type="number" value={value} min={min} max={max} step={step} autoFocus onBlur={() => setEditing(false)} onChange={(event) => commit(Number(event.target.value))} /> : <button className="metal-knob__value" onClick={() => setEditing(true)}>{valueLabel}</button>}
  </div>;
}

export function VerticalEqFader({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="eq-fader">
    <span className="eq-fader__value">{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
    <input type="range" min="-12" max="12" step="0.5" value={value} onChange={(event) => onChange(Number(event.target.value))} onDoubleClick={() => onChange(0)} aria-label={`${label} EQ`} aria-valuetext={`${value.toFixed(1)} dB`} />
    <strong>{label}</strong>
  </label>;
}
