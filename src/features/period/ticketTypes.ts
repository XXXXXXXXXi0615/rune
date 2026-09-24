/**
 * Period Ticket types — derived presentation artifact for period records.
 *
 * GeneratedPeriodTicket is a SNAPSHOT of a PeriodRecord at generation time.
 * It never owns source data; it is derived and disposable.
 */

export const PERIOD_TICKET_TEMPLATE = 'boarding-pass-v1' as const;

export type PeriodTicketTemplate = typeof PERIOD_TICKET_TEMPLATE;

export interface PeriodTicketSnapshot {
  dateLabel: string;
  flowLabel?: string;
  moodLabel?: string;
  phaseLabel?: string;
  cycleDay?: number;
}

export interface GeneratedPeriodTicket {
  id: string;
  sourceRecordId: string;
  generatedAt: number;
  /** Stable serialization of source fields at generation time (stale detection). */
  sourceRevision: string;
  title: string;
  body: string;
  snapshot: PeriodTicketSnapshot;
  template: PeriodTicketTemplate;
  /** Schema version of the ticket artifact itself. */
  _schemaVersion?: number;
}
