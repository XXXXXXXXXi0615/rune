import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import './PeriodTicketReveal.css';

const REVEAL_LIFETIME_MS = 7000;

export function PeriodTicketReveal({ ticket, failed, onDismiss, onOpenTicket }: {
  ticket: GeneratedPeriodTicket | null;
  failed: boolean;
  onDismiss: () => void;
  onOpenTicket: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, REVEAL_LIFETIME_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Keyboard ownership: a topmost aria-modal dialog owns Escape while open.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);

  if (!ticket && !failed) return null;

  return createPortal(
    <aside className="period-ticket-reveal" ref={cardRef} data-testid="period-ticket-reveal" data-mode={failed ? 'failed' : 'ok'} aria-label="週期票根">
      {failed ? (
        <div className="period-ticket-reveal__failed">
          <span className="period-ticket-reveal__eyebrow">PERIOD TICKET</span>
          <p className="period-ticket-reveal__fail-message">紀錄已保存，票根暫時未生成</p>
          <button type="button" className="period-ticket-reveal__primary" onClick={onDismiss}>知道</button>
        </div>
      ) : ticket && (
        <div className="period-ticket-reveal__card">
          <div className="period-ticket-reveal__head">
            <span className="period-ticket-reveal__brandmark" aria-hidden="true">R</span>
            <span className="period-ticket-reveal__eyebrow">PERIOD TICKET</span>
            <button type="button" className="period-ticket-reveal__dismiss" aria-label="關閉票根提示" onClick={onDismiss}>×</button>
          </div>
          <div className="period-ticket-reveal__block">
            <strong>{ticket.snapshot.dateLabel}</strong>
            {ticket.snapshot.cycleDay != null && <span>CYCLE DAY {String(ticket.snapshot.cycleDay).padStart(2, '0')}</span>}
            {ticket.snapshot.phaseLabel && <span className="period-ticket-reveal__phase">{ticket.snapshot.phaseLabel}</span>}
          </div>
          <p className="period-ticket-reveal__preview">{ticket.body}</p>
          <div className="period-ticket-reveal__footer">
            <button type="button" className="period-ticket-reveal__primary" onClick={onOpenTicket}>查看票根</button>
          </div>
        </div>
      )}
    </aside>,
    document.body,
  );
}
