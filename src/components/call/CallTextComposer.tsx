import { useState } from 'react';

interface CallTextComposerProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

/** "Type to talk" composer inside a call. */
export function CallTextComposer({ disabled, onSend }: CallTextComposerProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="call-text-composer">
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
        placeholder="打字說話…"
        aria-label="通話訊息輸入"
        disabled={disabled}
        data-testid="call-text-input"
      />
      <button type="button" onClick={submit} disabled={disabled || !text.trim()} aria-label="送出通話訊息" data-testid="call-text-send">
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
