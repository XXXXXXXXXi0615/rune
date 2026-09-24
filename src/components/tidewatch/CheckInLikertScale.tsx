import type { GuidedOption } from '@/features/tidewatch/guidedAnswer';

interface CheckInLikertScaleProps {
  name: string;
  label: string;
  options: readonly GuidedOption[];
  value: number | null;
  onChange: (value: number) => void;
}

/** Stateless presentation control; canonical answer ownership remains in CheckInFloat. */
export function CheckInLikertScale({ name, label, options, value, onChange }: CheckInLikertScaleProps) {
  return <fieldset className="checkin-likert">
    <legend className="sr-only">{label}</legend>
    <span className="checkin-likert__endpoint" aria-hidden="true">{options[0]?.label}</span>
    <div className="checkin-likert__points">
      {options.map((option, index) => {
        const scaleValue = index + 1;
        return <label className="checkin-likert__point" key={option.label}>
          <input type="radio" name={name} value={scaleValue} checked={value === scaleValue} aria-checked={value === scaleValue} onChange={() => onChange(scaleValue)} aria-label={`${scaleValue} ${option.label}`} />
          <span className="checkin-likert__dot" aria-hidden="true"><i /></span>
        </label>;
      })}
    </div>
    <span className="checkin-likert__endpoint is-end" aria-hidden="true">{options.at(-1)?.label}</span>
  </fieldset>;
}
