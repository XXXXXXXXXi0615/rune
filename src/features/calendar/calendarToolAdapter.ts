import { useAppStore } from '@/store/useAppStore';
import type { CalendarAuthor, CalendarChangeCursor, CalendarEvent, CalendarNote, CalendarPermissions } from '@/types';
import { localDateKey } from '@/utils/date';
import { ensureCalendarDaySnapshot, markCalendarDayDirty } from './calendarDayScene';
import { getAsset } from '@/store/assets';
import type { ContentPart } from '@/ai/types';

export type CalendarToolAction = 'list' | 'see' | 'create' | 'update' | 'delete' | 'comment';
export type CalendarToolErrorCode = 'permission_denied' | 'not_found' | 'conflict' | 'invalid_input' | 'budget_exceeded';

export interface CalendarToolError { ok: false; code: CalendarToolErrorCode; message: string }
export interface CalendarListResult { ok: true; events: CalendarEvent[]; notes: CalendarNote[]; newChanges: CalendarChangeCursor[]; revision: number }
export interface CalendarMutationResult { ok: true; event?: CalendarEvent; note?: CalendarNote; revision: number }

export type CalendarToolResult = CalendarToolError | CalendarListResult | CalendarMutationResult;

export interface CalendarToolInput {
  action: CalendarToolAction;
  from?: string;
  to?: string;
  date?: string;
  eventId?: string;
  noteId?: string;
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  precision?: CalendarEvent['precision'];
  eventType?: string;
  questId?: string;
  content?: string;
  expectedRevision?: number;
  newOnly?: boolean;
}

const defaultPermissions: CalendarPermissions = { read: true, create: false, update: false, delete: false, comment: true };
const activeEvents = () => (useAppStore.getState().customEvents || []).filter((event) => !event.deletedAt);
const activeNotes = () => (useAppStore.getState().calendarNotes || []).filter((note) => !note.deletedAt);
const revision = () => Math.max(0, ...(useAppStore.getState().calendarChanges || []).map((change) => change.revision));
const dateOfEvent = (event: CalendarEvent) => event.date || event.startsAt?.slice(0, 10) || '';

function recordChange(entityType: 'event' | 'note', entityId: string, changedBy: Exclude<CalendarAuthor, 'auto'>): number {
  const next = revision() + 1;
  const change: CalendarChangeCursor = { id: next, entityType, entityId, changedBy, changedAt: new Date().toISOString(), revision: next };
  useAppStore.setState((state) => ({ calendarChanges: [...(state.calendarChanges || []), change] }));
  return next;
}

function denied(capability: keyof CalendarPermissions): CalendarToolError | null {
  const permissions = useAppStore.getState().calendarPermissions || defaultPermissions;
  return permissions[capability] ? null : { ok: false, code: 'permission_denied', message: `calendar.${capability} is not permitted` };
}

function readRange(input: CalendarToolInput): { events: CalendarEvent[]; notes: CalendarNote[] } {
  const date = input.date;
  const from = input.from || date;
  const to = input.to || date;
  const events = activeEvents().filter((event) => {
    const key = dateOfEvent(event);
    if (input.eventId) return event.id === input.eventId;
    return (!from || key >= from) && (!to || key <= to);
  });
  const eventIds = new Set(events.map((event) => event.id));
  const notes = activeNotes().filter((note) => input.noteId ? note.id === input.noteId : (date ? note.dateKey === date : eventIds.has(note.eventId || '') || ((!from || note.dateKey >= from) && (!to || note.dateKey <= to))));
  return { events, notes };
}

/** Internal-first shared calendar domain adapter. MCP may wrap this contract later. */
export function executeCalendarTool(input: CalendarToolInput): CalendarToolResult {
  const state = useAppStore.getState();
  if (input.action === 'list' || input.action === 'see') {
    const error = denied('read'); if (error) return error;
    const range = readRange(input);
    const seen = state.lastSeenCalendarRevision || 0;
    const newChanges = (state.calendarChanges || []).filter((change) => change.revision > seen && change.changedBy === 'user');
    return { ok: true, ...range, newChanges: input.newOnly ? newChanges : newChanges, revision: revision() };
  }

  if (input.action === 'create') {
    const error = denied('create'); if (error) return error;
    if (!input.title || !input.startsAt) return { ok: false, code: 'invalid_input', message: 'title and startsAt are required' };
    const start = new Date(input.startsAt);
    if (Number.isNaN(start.getTime())) return { ok: false, code: 'invalid_input', message: 'startsAt must be ISO date/time' };
    const now = new Date().toISOString();
    const event: CalendarEvent = { id: crypto.randomUUID(), type: 'event', date: localDateKey(start), title: input.title.trim(), completed: false, description: input.description || '', isAllDay: input.precision === 'day' || input.startsAt.length === 10, startTime: input.startsAt.length > 10 ? input.startsAt.slice(11, 16) : undefined, endTime: input.endsAt?.slice(11, 16), author: 'lunaris', precision: input.precision || 'hour', eventType: input.eventType, questId: input.questId, revision: 1, createdAt: now, updatedAt: now };
    useAppStore.setState((current) => ({ customEvents: [event, ...(current.customEvents || [])] }));
    markCalendarDayDirty(event.date);
    return { ok: true, event, revision: recordChange('event', event.id, 'lunaris') };
  }

  if (input.action === 'comment') {
    const error = denied('comment'); if (error) return error;
    const content = input.content?.trim();
    const dateKey = input.date || (input.eventId ? dateOfEvent(activeEvents().find((event) => event.id === input.eventId)!) : '');
    if (!content || !dateKey) return { ok: false, code: 'invalid_input', message: 'content and date/eventId are required' };
    const dailyCount = activeNotes().filter((note) => note.author === 'lunaris' && note.dateKey === dateKey).length;
    if (dailyCount >= 3) return { ok: false, code: 'budget_exceeded', message: 'LUNARIS daily note budget reached' };
    const now = new Date().toISOString();
    const note: CalendarNote = { id: crypto.randomUUID(), dateKey, eventId: input.eventId, author: 'lunaris', content, createdAt: now, updatedAt: now };
    useAppStore.setState((current) => ({ calendarNotes: [note, ...(current.calendarNotes || [])] }));
    markCalendarDayDirty(note.dateKey);
    return { ok: true, note, revision: recordChange('note', note.id, 'lunaris') };
  }

  if (input.noteId && (input.action === 'update' || input.action === 'delete')) {
    const note = activeNotes().find((item) => item.id === input.noteId);
    if (!note) return { ok: false, code: 'not_found', message: 'note not found' };
    if (note.author !== 'lunaris') return { ok: false, code: 'permission_denied', message: 'LUNARIS may only modify its own notes' };
    const capability = input.action === 'delete' ? 'delete' : 'update';
    const error = denied(capability); if (error) return error;
    if (input.action === 'update' && !input.content?.trim()) return { ok: false, code: 'invalid_input', message: 'content is required' };
    const now = new Date().toISOString();
    const nextNote: CalendarNote = input.action === 'delete' ? { ...note, deletedAt: now, updatedAt: now } : { ...note, content: input.content!.trim(), updatedAt: now };
    useAppStore.setState((current) => ({ calendarNotes: (current.calendarNotes || []).map((item) => item.id === note.id ? nextNote : item) }));
    markCalendarDayDirty(note.dateKey);
    return { ok: true, note: nextNote, revision: recordChange('note', note.id, 'lunaris') };
  }

  const target = activeEvents().find((event) => event.id === input.eventId);
  if (!target) return { ok: false, code: 'not_found', message: 'event not found' };
  if (input.expectedRevision !== target.revision) return { ok: false, code: 'conflict', message: 'event changed; read again before writing' };
  const capability = input.action === 'delete' ? 'delete' : 'update';
  const error = denied(capability); if (error) return error;
  const now = new Date().toISOString();
  const nextEvent: CalendarEvent = input.action === 'delete'
    ? { ...target, deletedAt: now, updatedAt: now, revision: (target.revision || 1) + 1 }
    : { ...target, ...(input.title ? { title: input.title.trim() } : {}), ...(input.description !== undefined ? { description: input.description } : {}), updatedAt: now, revision: (target.revision || 1) + 1 };
  useAppStore.setState((current) => ({ customEvents: current.customEvents.map((event) => event.id === target.id ? nextEvent : event) }));
  markCalendarDayDirty(target.date);
  return { ok: true, event: nextEvent, revision: recordChange('event', target.id, 'lunaris') };
}

export function markCalendarChangesSeen(upToRevision = revision()): void {
  useAppStore.setState({ lastSeenCalendarRevision: upToRevision });
}

export async function executeCalendarSeeWithSnapshot(input: CalendarToolInput): Promise<{ result: CalendarToolResult; content: ContentPart[] }> {
  const dateKey = input.date || localDateKey(new Date());
  const result = executeCalendarTool({ ...input, action: 'see', date: dateKey });
  const ensured = await ensureCalendarDaySnapshot(dateKey);
  const snapshot = ensured.snapshot;
  const summary = JSON.stringify({ ...result, snapshot: { status: ensured.status, renderedAt: snapshot?.renderedAt, renderedRevision: snapshot?.renderedRevision, contentRevision: snapshot?.contentRevision, width: snapshot?.width, height: snapshot?.height } });
  const content: ContentPart[] = [{ type: 'text', text: summary }];
  if (snapshot) {
    const blob = await getAsset(snapshot.assetId);
    if (blob) {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      content.push({ type: 'image_url', image_url: { url: data } });
    }
  }
  return { result, content };
}

export function undoCalendarDelete(eventId: string): boolean {
  const event = useAppStore.getState().customEvents.find((item) => item.id === eventId && item.deletedAt);
  if (!event) return false;
  const now = new Date().toISOString();
  useAppStore.setState((state) => ({ customEvents: state.customEvents.map((item) => item.id === eventId ? { ...item, deletedAt: undefined, updatedAt: now, revision: (item.revision || 1) + 1 } : item) }));
  recordChange('event', eventId, 'user');
  return true;
}

export function toggleCalendarNoteLike(noteId: string, actor: 'user' | 'lunaris'): boolean {
  const note = activeNotes().find((item) => item.id === noteId);
  if (!note) return false;
  useAppStore.setState((state) => ({ calendarNotes: (state.calendarNotes || []).map((item) => item.id === noteId ? { ...item, [actor === 'user' ? 'likedByUser' : 'likedByLunaris']: !item[actor === 'user' ? 'likedByUser' : 'likedByLunaris'], updatedAt: new Date().toISOString() } : item) }));
  recordChange('note', noteId, actor);
  return true;
}
