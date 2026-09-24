import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './CallTextComposer.css';

interface CallTextComposerProps {
  open: boolean;
  isMobile: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

const MAX_LEN = 500;

/**
 * Compact in-call text composer.
 *
 * Desktop: floating panel anchored inside the call surface, directly above CallControls.
 * Mobile:  keyboard-safe bottom composer (visualViewport aware).
 *
 * Sending routes through the canonical Chat send action supplied by the host —
 * this component never touches any message store directly.
 */
export function CallTextComposer({ open, isMobile, onSubmit, onClose, disabled }: CallTextComposerProps) {
  const [value, setValue] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow 48 → 120
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, Math.max(24, el.scrollHeight))}px`;
  }, [value, open]);

  // Focus on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // visualViewport-aware bottom offset (mobile keyboard)
  useEffect(() => {
    if (!open || !isMobile) { setKeyboardInset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open, isMobile]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue('');
    // Stay open for continuous typing
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }, [onClose, submit]);

  if (!open) return null;

  return (
    <div
      className={`cc-textcomposer${isMobile ? ' is-mobile' : ''}`}
      data-testid="call-text-composer"
      style={isMobile && keyboardInset > 0 ? { bottom: `${keyboardInset}px` } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <form
        className="cc-textcomposer-bar"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <textarea
          ref={inputRef}
          className="cc-textcomposer-input"
          value={value}
          rows={1}
          maxLength={MAX_LEN}
          placeholder="輸入訊息…"
          aria-label="通話中輸入訊息"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="cc-textcomposer-send"
          data-testid="call-text-send"
          aria-label="發送訊息"
          title="發送"
          disabled={!value.trim() || disabled}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </form>
      <button
        type="button"
        className="cc-textcomposer-close"
        data-testid="call-text-close"
        aria-label="收起文字輸入"
        title="收起"
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
