import { useCallback, type ReactNode, type Ref } from 'react';

interface PickerFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onOpen: () => void;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  children?: ReactNode;
  expanded?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}

export function PickerField({
  label,
  value,
  placeholder = '選擇',
  onOpen,
  disabled,
  error,
  errorText,
  children,
  expanded,
  buttonRef,
}: PickerFieldProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  }, [disabled, onOpen]);

  return (
    <div className="cal-field">
      <label>{label}</label>
      <button
        ref={buttonRef}
        type="button"
        className="cal-picker-field"
        role="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={expanded ?? !!children}
        onClick={disabled ? undefined : onOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className={value ? 'cal-picker-value' : 'cal-picker-placeholder'}>
          {value || placeholder}
        </span>
      </button>
      {error && errorText && <small style={{ color: 'var(--danger)', fontSize: 11 }}>{errorText}</small>}
      {children}
    </div>
  );
}
