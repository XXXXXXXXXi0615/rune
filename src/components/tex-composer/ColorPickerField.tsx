import { normalizeHex } from '@/features/tex-composer/escapeLatex';

export function ColorPickerField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const safe = normalizeHex(value) ? `#${normalizeHex(value)}` : '#D98162';
  return (
    <label className="tex-color-field">
      <span>{label}</span>
      <span className="tex-color-control">
        <input type="color" value={safe} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label={`${label}颜色选择`} />
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="#D98162" maxLength={7} />
      </span>
    </label>
  );
}
