import { useCallback } from 'react';

interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  onChange: (value: number) => void;
}

export function NumberStepper({
  value,
  min = 0,
  max = 999,
  step = 1,
  label,
  onChange,
}: NumberStepperProps) {
  const dec = useCallback(() => {
    onChange(Math.max(min, value - step));
  }, [value, min, step, onChange]);

  const inc = useCallback(() => {
    onChange(Math.min(max, value + step));
  }, [value, max, step, onChange]);

  return (
    <div className="cal-field">
      {label && <label>{label}</label>}
      <div className="cal-stepper">
        <button type="button" className="cal-stepper-btn" onClick={dec} disabled={value <= min} aria-label="減少">−</button>
        <span className="cal-stepper-value">{value}</span>
        <button type="button" className="cal-stepper-btn" onClick={inc} disabled={value >= max} aria-label="增加">+</button>
      </div>
    </div>
  );
}
