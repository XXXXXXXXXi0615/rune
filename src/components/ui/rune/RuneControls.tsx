import classNames from 'classnames';
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import './RunePrimitives.css';

export type RuneButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function RuneButton({ variant = 'secondary', loading = false, disabled, className, children, type = 'button', ...props }: RuneButtonProps) {
  return <button type={type} className={classNames('rune-control rune-button', `rune-button--${variant}`, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <span className="rune-button__spinner" aria-hidden="true" />}{children}
  </button>;
}

export function RuneIconButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={classNames('rune-control rune-icon-button', className)} {...props}>{children}</button>;
}

export function RuneOrbButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={classNames('rune-control rune-orb-button', className)} {...props}>{children}</button>;
}

export interface RuneSegment { value: string; label: ReactNode; disabled?: boolean }
export function RuneSegmentedControl({ items, value, onChange, label }: { items: RuneSegment[]; value: string; onChange: (value: string) => void; label: string }) {
  const enabled = items.filter(item => !item.disabled);
  return <div className="rune-segmented" role="tablist" aria-label={label}>{items.map((item, index) => <button
    key={item.value} type="button" role="tab" className="rune-segmented__item" aria-selected={item.value === value}
    tabIndex={item.value === value ? 0 : -1} disabled={item.disabled} onClick={() => onChange(item.value)}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !enabled.length) return;
      event.preventDefault();
      const current = enabled.findIndex(candidate => candidate.value === item.value);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
      onChange(enabled[next].value);
      const targetIndex = items.findIndex(candidate => candidate.value === enabled[next].value);
      (event.currentTarget.parentElement?.children[targetIndex] as HTMLElement | undefined)?.focus();
    }}
  >{item.label}</button>)}</div>;
}

export function RuneSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="rune-control rune-switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span className="rune-switch__thumb" aria-hidden="true" /></button>;
}

export function RuneSlider({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <input type="range" className="rune-slider" aria-label={label} {...props} />;
}
