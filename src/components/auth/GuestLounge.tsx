import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ProviderConfig } from '@/types';
import {
  requestGuestReply,
  type GuestConversationMessage,
} from '@/features/auth/guestConversationAdapter';
import { resolveRuneOrbAvatarAsset } from '@/components/branding/runeBrandAssets';
import './GuestLounge.css';

type GuestLoungeStatus = 'idle' | 'replying' | 'error';

interface GuestLoungeProps {
  provider: ProviderConfig | null;
  onReturnToLogin: () => void;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 15-7-4.5 14-3.1-5.1L4 12Z" /><path d="m11.4 13.9 3.1-3.1" /></svg>;
}

function createSessionMessage(role: GuestConversationMessage['role'], content: string): GuestConversationMessage {
  return { id: crypto.randomUUID(), role, content };
}

export function GuestLounge({ provider, onReturnToLogin }: GuestLoungeProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<GuestConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<GuestLoungeStatus>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const returnToLogin = () => {
    setOpen(false);
    window.requestAnimationFrame(onReturnToLogin);
  };

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      // Keep every dialog control reachable even when the browser skips native buttons.
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (current <= 0 ? focusable.length - 1 : current - 1)
        : (current + 1) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => {
      if (provider) composerRef.current?.focus();
      else panelRef.current?.querySelector<HTMLButtonElement>('.guest-lounge-close')?.focus();
    });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open, provider]);

  useEffect(() => {
    if (!open || !messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages, open, status]);

  const send = async () => {
    const content = input.trim();
    if (!content || !provider || sendingRef.current) return;

    const guestMessage = createSessionMessage('guest', content);
    const nextMessages = [...messages, guestMessage];
    const controller = new AbortController();
    requestRef.current = controller;
    sendingRef.current = true;
    setInput('');
    setMessages(nextMessages);
    setStatus('replying');

    try {
      const reply = await requestGuestReply(provider, nextMessages, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, createSessionMessage('rune', reply)]);
      setStatus('idle');
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      sendingRef.current = false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const unavailable = !provider;
  const interactionLocked = unavailable || status === 'replying';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="guest-lounge-trigger"
        aria-haspopup="dialog"
        aria-controls="guest-lounge-panel"
        aria-expanded={open}
        data-testid="guest-lounge-trigger"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">☾</span>
        待客廳
      </button>

      {open ? (
        <div className="guest-lounge-layer" data-testid="guest-lounge-layer">
          <button className="guest-lounge-scrim" type="button" aria-label="關閉待客廳" onClick={close} />
          <section
            ref={panelRef}
            id="guest-lounge-panel"
            className="guest-lounge-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-lounge-title"
            data-testid="guest-lounge-panel"
            data-guest-status={unavailable ? 'unavailable' : status}
          >
            <header className="guest-lounge-header">
              <div>
                <p className="guest-lounge-eyebrow">Moon Gate reception</p>
                <h2 id="guest-lounge-title">Rune · 待客廳</h2>
              </div>
              <button type="button" className="guest-lounge-close" aria-label="關閉待客廳" onClick={close}>
                <CloseIcon />
              </button>
            </header>

            <div
              ref={messageListRef}
              className="guest-lounge-messages"
              data-testid="guest-lounge-messages"
              aria-live="polite"
              aria-busy={status === 'replying' || undefined}
            >
              <article className="guest-lounge-intro guest-lounge-message guest-lounge-message--rune">
                <span className="guest-lounge-speaker"><img src={resolveRuneOrbAvatarAsset()} alt="" />Rune</span>
                <p>門還沒有打開。<br />如果只是想坐一會，可以在這裡說幾句。</p>
              </article>
              <p className="guest-lounge-disclosure">本次對話不會保存。</p>

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`guest-lounge-message guest-lounge-message--${message.role}`}
                  data-testid="guest-lounge-message"
                  data-role={message.role}
                >
                  <span>{message.role === 'guest' ? 'Guest' : 'Rune'}</span>
                  <p>{message.content}</p>
                </article>
              ))}

              {status === 'replying' ? (
                <div className="guest-lounge-replying" data-testid="guest-lounge-replying">
                  <i /><i /><i />
                  <span>Rune 正在回應…</span>
                </div>
              ) : null}

              {unavailable || status === 'error' ? (
                <div className="guest-lounge-unavailable" role="status" data-testid="guest-lounge-unavailable">
                  <p><span className="guest-lounge-error-speaker">Rune </span>現在暫時不能在門外應答。</p>
                  <button type="button" onClick={returnToLogin}>← 返回登入</button>
                </div>
              ) : null}
            </div>

            {unavailable || status === 'error' ? (
              <div className="guest-lounge-terminal-footer" aria-disabled="true" data-testid="guest-lounge-terminal-footer">
                此刻無法傳送訊息
              </div>
            ) : (
              <form className="guest-lounge-composer" onSubmit={handleSubmit}>
                <label className="guest-lounge-sr-only" htmlFor="guest-lounge-input">傳訊息給 Rune</label>
                <textarea
                  ref={composerRef}
                  id="guest-lounge-input"
                  rows={2}
                  maxLength={2000}
                  value={input}
                  disabled={interactionLocked}
                  placeholder="在門外說幾句…"
                  data-testid="guest-lounge-input"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                />
                <button
                  type="submit"
                  aria-label="傳送"
                  data-guest-status={status === 'replying' ? 'sending' : status}
                  data-testid="guest-lounge-send"
                  disabled={interactionLocked || !input.trim()}
                >
                  <SendIcon />
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
