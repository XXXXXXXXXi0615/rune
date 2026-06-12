import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { t } from '@/i18n';

export interface ChatInputHandle {
  insertEmoji: (emoji: string) => void;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  onToggleEmoji: () => void;
  onAttach: () => void;
  emojiOpen: boolean;
  isBusy: boolean;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ onSend, onToggleEmoji, onAttach, emojiOpen, isBusy }, ref) {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const resize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = '44px';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, []);

    useEffect(() => {
      resize();
    }, [text, resize]);

    // Expose insertEmoji to parent via ref
    useImperativeHandle(ref, () => ({
      insertEmoji: (emoji: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        const newText = text.slice(0, start) + emoji + text.slice(end);
        setText(newText);
        setTimeout(() => {
          el.focus();
          const pos = start + emoji.length;
          el.selectionStart = el.selectionEnd = pos;
        }, 0);
      },
    }), [text]);

    const handleSend = () => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;
      onSend(trimmed);
      setText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const canSend = text.trim().length > 0 && !isBusy;

    return (
      <div className="chat-input-area">
        {/* Attach */}
        <button className="btn-icon" onClick={onAttach} aria-label={t('chat.attach')}>
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 17, height: 17 }}>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        {/* Textarea */}
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.inputLabel')}
            rows={1}
          />
        </div>

        {/* Emoji toggle */}
        <button className="btn-icon" onClick={onToggleEmoji} aria-label={t('chat.emoji')}>
          {emojiOpen ? (
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 17, height: 17 }}>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          ) : (
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 17, height: 17 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          )}
        </button>

        {/* Send */}
        <button
          className={`chat-send-btn ${canSend ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          aria-label={t('chat.send')}
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    );
  }
);
