/**
 * ticketStorage — independent Period Ticket persistence.
 *
 * Decision (Phase 3B §12): Option B — a separate but explicit
 * period-generated-artifact store. PeriodStorage stays the sole canonical
 * PeriodRecord owner; this module only persists derived presentation tickets.
 *
 * Relationship contract (§13):
 * - A ticket is a derived artifact of exactly one PeriodRecord (sourceRecordId).
 * - Deleting the source record deletes its ticket (caller-driven cascade via
 *   deleteTicketsForRecord — see PeriodRecordSheet / PeriodPage delete paths).
 * - A ticket is never written back into a PeriodRecord.
 */
import type { PeriodRecord } from '@/utils/periodStorage';
import { loadPeriodRecords } from '@/utils/periodStorage';
import { PERIOD_TICKET_TEMPLATE, type GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import { getPeriodMoodLabel } from '@/features/period/periodLabels';
import { generatePeriodJournal, type PeriodGenerationContext } from '@/features/period/generation/generatePeriodJournal';

const TICKET_STORAGE_KEY = 'lunartide_period_tickets_v1';
const TICKET_SCHEMA_VERSION = 1;
const TICKETS_UPDATED_EVENT = 'period-tickets-updated';

/** Deterministic ticket id per source record → one active ticket per record. */
export function ticketIdForRecord(recordId: string): string {
  return `period_ticket_${recordId}`;
}

/**
 * Stable source revision — a serialization of only the fields the ticket
 * snapshot depends on. Two records with identical relevant content produce
 * the same revision.
 */
export function sourceRevisionOf(record: PeriodRecord): string {
  return JSON.stringify({
    startDate: record.startDate,
    endDate: record.endDate,
    flowLevel: record.flowLevel ?? '',
    mood: record.mood ?? '',
    symptomRawText: record.symptomRawText ?? '',
    notes: record.notes ?? '',
    symptoms: record.symptoms ?? [],
  });
}

export function loadGeneratedPeriodTickets(): GeneratedPeriodTicket[] {
  try {
    const raw = localStorage.getItem(TICKET_STORAGE_KEY);
    if (raw) {
      const tickets = JSON.parse(raw) as GeneratedPeriodTicket[];
      return tickets.filter((ticket) => Boolean(ticket && ticket.id && ticket.sourceRecordId));
    }
  } catch { /* corrupt or legacy values fall back safely */ }
  return [];
}

function persistAll(tickets: GeneratedPeriodTicket[]): void {
  try {
    localStorage.setItem(TICKET_STORAGE_KEY, JSON.stringify(tickets));
  } catch { /* storage full or unavailable — best-effort for destructive ops */ }
  window.dispatchEvent(new Event(TICKETS_UPDATED_EVENT));
}

/** Strict write — surfaces quota/severe failures to the caller (Phase 3C contract). */
function persistStrict(tickets: GeneratedPeriodTicket[]): void {
  localStorage.setItem(TICKET_STORAGE_KEY, JSON.stringify(tickets));
  window.dispatchEvent(new Event(TICKETS_UPDATED_EVENT));
}

/** Upsert by id; enforces the one-ticket-per-source invariant. Throws on write failure. */
export function saveGeneratedPeriodTicket(ticket: GeneratedPeriodTicket): void {
  const tickets = loadGeneratedPeriodTickets()
    .filter((existing) => existing.id !== ticket.id && existing.sourceRecordId !== ticket.sourceRecordId);
  tickets.push({ ...ticket, _schemaVersion: TICKET_SCHEMA_VERSION });
  persistStrict(tickets);
}

export function deleteGeneratedPeriodTicket(id: string): void {
  persistAll(loadGeneratedPeriodTickets().filter((ticket) => ticket.id !== id));
}

/**
 * Source-record delete contract: derived ticket dies with its source.
 * Called from the period record delete paths (PeriodRecordSheet.remove,
 * PeriodPage.handleDeletePeriod) — periodStorage itself stays untouched.
 */
export function deleteTicketsForRecord(recordId: string): void {
  persistAll(loadGeneratedPeriodTickets().filter((ticket) => ticket.sourceRecordId !== recordId));
}

export function findActiveTicketForRecord(recordId: string): GeneratedPeriodTicket | null {
  return loadGeneratedPeriodTickets()
    .filter((ticket) => ticket.sourceRecordId === recordId)
    .sort((a, b) => b.generatedAt - a.generatedAt)[0] ?? null;
}

/**
 * Phase 3D — Archive query surface.
 *
 * All archive helpers are PURE read-time views over the canonical storage key.
 * They never write, never create a second ticket store, and never delete
 * orphanable data during render. Orphan tickets (a ticket whose sourceRecordId
 * no longer resolves to a canonical PeriodRecord) are simply excluded from the
 * view and reported — not mutated.
 */

/**
 * Archive sort contract: startDate DESC, then createdAt DESC as the
 * deterministic tie-break (Phase 3D §4).
 */
export function compareArchiveTickets(a: GeneratedPeriodTicket, b: GeneratedPeriodTicket): number {
  const byStart = (b.snapshot.dateLabel).localeCompare(a.snapshot.dateLabel);
  if (byStart !== 0) return byStart;
  return b.generatedAt - a.generatedAt;
}

/**
 * Load all tickets and exclude orphans (source record no longer exists).
 * Returns the clean list and the count of orphans encountered — without
 * mutating storage (Phase 3D §10).
 */
export function loadArchiveTickets(): { tickets: GeneratedPeriodTicket[]; orphanCount: number } {
  const tickets = loadGeneratedPeriodTickets();
  const records = loadPeriodRecords();
  const recordIds = new Set(records.map((record) => record.id));
  const clean: GeneratedPeriodTicket[] = [];
  let orphans = 0;
  for (const ticket of tickets) {
    if (recordIds.has(ticket.sourceRecordId)) clean.push(ticket);
    else orphans += 1;
  }
  clean.sort(compareArchiveTickets);
  return { tickets: clean, orphanCount: orphans };
}

/** Group archive tickets by YYYY then MM, each group sorted newest first. */
export function groupTicketsByYearMonth(tickets: GeneratedPeriodTicket[]): Record<string, Record<string, GeneratedPeriodTicket[]>> {
  const groups: Record<string, Record<string, GeneratedPeriodTicket[]>> = {};
  for (const ticket of tickets) {
    const [year = '', month = ''] = ticket.snapshot.dateLabel.split('/');
    if (!year || !month) continue;
    (groups[year] ??= {});
    (groups[year][month] ??= []).push(ticket);
  }
  for (const year of Object.keys(groups)) {
    for (const month of Object.keys(groups[year])) {
      groups[year][month].sort(compareArchiveTickets);
    }
  }
  return groups;
}

/**
 * Deterministic rotation per ticket (Phase 3D §5) — derived only from the
 * ticket id so the archive layout is stable across reloads. Clamped to ±3deg.
 */
export function ticketStackRotation(ticketId: string, maxDeg = 3): number {
  let hash = 7;
  for (let i = 0; i < ticketId.length; i += 1) {
    hash = (hash * 31 + ticketId.charCodeAt(i)) >>> 0;
  }
  return ((hash % 1000) / 1000 - 0.5) * 2 * maxDeg;
}

/** Stale when the source record's relevant fields changed after generation. */
export function isTicketStale(ticket: GeneratedPeriodTicket, record: PeriodRecord): boolean {
  return sourceRevisionOf(record) !== ticket.sourceRevision;
}

function formatDateLabel(startDate: string): string {
  const [y = '', m = '', d = ''] = startDate.split('-');
  return y && m && d ? `${y}/${m}/${d}` : startDate;
}

/**
 * Build (and persist-ready) a new ticket snapshot for a source record.
 * Same sourceRecordId → same ticket id → regeneration replaces, never appends.
 */
export function buildGeneratedPeriodTicket(record: PeriodRecord, ctx: PeriodGenerationContext = {}): GeneratedPeriodTicket {
  const generated = generatePeriodJournal(record, ctx);
  const snapshot = {
    dateLabel: formatDateLabel(record.startDate),
    flowLabel: record.flowLevel?.trim() || undefined,
    moodLabel: recordedMoodLabel(record),
    phaseLabel: ctx.phaseLabel,
    cycleDay: ctx.cycleDay,
  };
  return {
    id: ticketIdForRecord(record.id),
    sourceRecordId: record.id,
    generatedAt: Date.now(),
    sourceRevision: sourceRevisionOf(record),
    title: generated.title,
    body: generated.body,
    snapshot,
    template: PERIOD_TICKET_TEMPLATE,
    _schemaVersion: TICKET_SCHEMA_VERSION,
  };
}

/**
 * Phase 3C — post-save auto-generation seam.
 * Called ONLY after a successful canonical record commit, and ONLY for
 * brand-new records. Throws on failure (caller shows the non-blocking
 * 「票根暫時未生成」notice); never touches periodStorage.
 */
export function autoGenerateTicketForRecord(record: PeriodRecord, ctx: PeriodGenerationContext = {}): GeneratedPeriodTicket {
  const ticket = buildGeneratedPeriodTicket(record, ctx);
  saveGeneratedPeriodTicket(ticket);
  return ticket;
}

function recordedMoodLabel(record: PeriodRecord): string | undefined {
  if (!record.mood) return undefined;
  const label = getPeriodMoodLabel(record.mood);
  return label === '未記錄' ? undefined : label;
}
