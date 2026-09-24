import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import { PeriodTicketCard } from '@/components/period/PeriodTicketCard';
import './PeriodTicketEntry.css';

/** Shared full ticket dialog (used by the saved-state entry and the post-save reveal). */
export function PeriodTicketModal({ ticket, dirty, onClose }: {
  ticket: GeneratedPeriodTicket;
  dirty?: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="period-ticket-entry__overlay" onClick={onClose}>
      <section className="period-ticket-entry__modal" role="dialog" aria-modal="true" aria-label="今日票根" onClick={(event) => event.stopPropagation()}>
        <header className="period-ticket-entry__head">
          <span>{ticket.title}</span>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="關閉票根">×</button>
        </header>
        <div className="period-ticket-entry__scroll">
          <PeriodTicketCard ticket={ticket} dirty={dirty} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
