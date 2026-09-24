import classNames from 'classnames';
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useId,
  useRef,
} from 'react';

export type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function AppButton({ variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...props }: AppButtonProps) {
  return (
    <button
      type={type}
      className={classNames('app-button', `app-button--${variant}`, `app-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="app-button__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export type AppInputProps = InputHTMLAttributes<HTMLInputElement> & { allowClear?: boolean };
export function AppInput({ className, allowClear, value, onChange, ...props }: AppInputProps) {
  const showClear = allowClear && value !== undefined && String(value).length > 0 && onChange;
  return (
    <span className={classNames('app-input-shell', className)}>
      <input className="app-input" value={value} onChange={onChange} {...props} />
      {showClear && (
        <button
          type="button"
          className="app-input__clear"
          aria-label="清除輸入"
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
        >×</button>
      )}
    </span>
  );
}

export function AppSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={classNames('app-select', className)} {...props}>{children}</select>;
}

export function AppSwitch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={classNames('app-switch', { 'is-checked': checked })}
      onClick={() => onChange(!checked)}
    >
      <span className="app-switch__knob" />
    </button>
  );
}

export function AppCheckbox({ checked, onChange, disabled, label }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label: ReactNode }) {
  const id = useId();
  return (
    <label className={classNames('app-checkbox', { 'is-disabled': disabled })} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="app-checkbox__mark" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function AppCard({ interactive, surface = 'paper', className, children, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'color'> & { interactive?: boolean; surface?: 'paper' | 'organic' | 'glass' }) {
  return <div className={classNames('app-card', `app-card--${surface}`, { 'app-card--interactive': interactive }, className)} {...props}>{children}</div>;
}

interface OverlayProps { open: boolean; title?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string }

export function useAppDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    window.requestAnimationFrame(() => panel?.querySelector<HTMLElement>(selector)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>(selector)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); returnFocusRef.current?.focus?.(); };
  }, [open, onClose]);
  return panelRef;
}

export function AppDialog({ open, title, onClose, children, footer, className }: OverlayProps) {
  const panelRef = useAppDialogBehavior(open, onClose);
  if (!open) return null;
  return (
    <div className="app-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className={classNames('app-dialog moon-paper-dialog', className)} role="dialog" aria-modal="true" aria-labelledby={title ? 'app-dialog-title' : undefined} tabIndex={-1}>
        {title && <header className="app-dialog__header"><h2 id="app-dialog-title">{title}</h2></header>}
        <div className="app-dialog__body">{children}</div>
        {footer && <footer className="app-dialog__footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function AppSheet({ open, title, onClose, children, footer, className }: OverlayProps) {
  const panelRef = useAppDialogBehavior(open, onClose);
  if (!open) return null;
  return (
    <div className="app-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className={classNames('app-sheet', className)} role="dialog" aria-modal="true" aria-labelledby={title ? 'app-sheet-title' : undefined} tabIndex={-1}>
        <span className="app-sheet__handle" aria-hidden="true" />
        {title && <header className="app-dialog__header"><h2 id="app-sheet-title">{title}</h2></header>}
        <div className="app-dialog__body">{children}</div>
        {footer && <footer className="app-dialog__footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function AppAccordion({ title, children, defaultOpen, className }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return <details className={classNames('app-accordion', className)} open={defaultOpen}><summary>{title}</summary><div>{children}</div></details>;
}

export interface AppTabItem { key: string; label: ReactNode; disabled?: boolean }
export function AppTabs({ items, activeKey, onChange, label, variant = 'pill' }: { items: AppTabItem[]; activeKey?: string; onChange?: (key: string) => void; label?: string; variant?: 'pill' | 'underline' }) {
  return (
    <div className={classNames('app-tabs', `app-tabs--${variant}`)} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          disabled={item.disabled}
          aria-selected={item.key === activeKey}
          tabIndex={item.key === activeKey || (!activeKey && index === 0) ? 0 : -1}
          onClick={() => onChange?.(item.key)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
            onChange?.(items[next].key);
            (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
          }}
        >{item.label}</button>
      ))}
    </div>
  );
}

export function AppToast(_message?: string, _type?: 'success' | 'info' | 'warning' | 'error') { return false; }
