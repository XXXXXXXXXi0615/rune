// ================================================================
// CountdownSection — shared list rendering for TIDECOUNT events
//   - Card shows: title, target date, day count, recurrence, pin
//   - Three-dot menu: edit / copy / pin / convert to TIDEQUEST / delete (confirm)
//   - Used by:
//       1. /calendar (Day Inspector 倒數日 board)
//       2. HomeCountdownWidget (secondary list)
//
// Calendar C3 (B + F): the ⋯ menu and the delete confirmation are rendered
// through `createPortal` into `document.body` and positioned by
// `useAnchoredPopover`. Both used to be children of the countdown card, so the
// Day Inspector's scroller (and the `overflow: hidden` app frame) clipped them —
// the ⋯ menu lost 169px off the bottom of the panel and the inline confirmation
// painted on top of the card's own title. Neither is a descendant of the card
// any more, so neither can be clipped or resize the card.
//
// Calendar C4 (date-scoped projection): when `scopeDate` is set the list is
// restricted to the events whose occurrence falls on that canonical day, and the
// card renders the D0 presentation (`<date> · 今天`) instead of a day count —
// on its own target date "還有 0 天" is meaningless. Omitting `scopeDate` keeps
// the global list behaviour for Home and /calendar/countdowns.
// ================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type CountdownEvent,
  buildCountdownSnapshot,
  resolveCountdownDisplay,
  sortCountdownEvents,
} from '@/features/countdown/countdownEngine';
import { useCountdownStore } from '@/features/countdown/useCountdownStore';
import { countdownOccursOnDate } from '@/features/countdown/countdownSelectors';
import { CountdownCover } from './countdownVisuals';
import { useQuestStore } from '@/store/useQuestStore';
import { useNow } from '@/hooks/useNow';
import { useAnchoredPopover } from '@/hooks/useAnchoredPopover';
import { AnchoredPopoverSurface } from '@/components/common/AnchoredPopoverSurface';

export type CountdownFilter = 'all' | 'upcoming' | 'today' | 'elapsed' | 'anniversary';

interface CountdownSectionProps {
  events?: CountdownEvent[];
  filter?: CountdownFilter;
  emptyHint?: string;
  onCreate?: () => void;
  onEdit?: (event: CountdownEvent) => void;
  showCreateButton?: boolean;
  navigateOnOpen?: boolean;
  limit?: number;
  /**
   * C4 — restrict the list to the events occurring on this canonical
   * `YYYY-MM-DD` day and render the D0 presentation. Omit for the global list.
   */
  scopeDate?: string;
}

const FILTER_LABEL: Record<CountdownFilter, string> = {
  all: '全部',
  upcoming: '即將到來',
  today: '今天',
  elapsed: '已過去',
  anniversary: '紀念日',
};

function filterEvents(events: CountdownEvent[], filter: CountdownFilter, now: Date): CountdownEvent[] {
  if (filter === 'all') return events;
  return events.filter((event) => {
    const d = resolveCountdownDisplay(event, now);
    if (filter === 'upcoming') return d.mode === 'upcoming';
    if (filter === 'today') return d.mode === 'today';
    if (filter === 'elapsed') return d.mode === 'elapsed';
    if (filter === 'anniversary') return event.direction === 'since' || event.recurrence.type === 'yearly';
    return true;
  });
}

export function CountdownSection({
  events: eventsOverride,
  filter = 'all',
  emptyHint = '把生日、紀念日、續訂或重要日子放進這裡。',
  onCreate,
  onEdit,
  showCreateButton = true,
  navigateOnOpen = true,
  limit,
  scopeDate,
}: CountdownSectionProps) {
  const navigate = useNavigate();
  const now = useNow('minute');
  const allEvents = useCountdownStore((s) => s.events);
  const deleteEvent = useCountdownStore((s) => s.deleteEvent);
  const togglePinned = useCountdownStore((s) => s.togglePinnedToHome);
  const addEvent = useCountdownStore((s) => s.addEvent);
  const createQuest = useQuestStore((s) => s.createQuest);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  // The ⋯ trigger the open popover is anchored to. Captured from the click
  // event, because a row's ref callback does not re-run when `menuId` changes.
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const events = eventsOverride ?? allEvents;
  // C4 — a scoped list is filtered by occurrence on the selected day, not by the
  // chip filters (which only exist on the global page).
  const scoped = Boolean(scopeDate);
  const filtered = useMemo(() => {
    const list = scopeDate
      ? events.filter((event) => countdownOccursOnDate(event, scopeDate))
      : filterEvents(events, filter, now);
    const sorted = sortCountdownEvents(list, now, 'nearest');
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }, [events, filter, now, limit, scopeDate]);

  const snapshot = useMemo(() => buildCountdownSnapshot(filtered, now), [filtered, now]);

  const menuEvent = useMemo(() => (menuId ? filtered.find((e) => e.id === menuId) ?? null : null), [filtered, menuId]);
  const confirmEvent = useMemo(
    () => (confirmingId ? filtered.find((e) => e.id === confirmingId) ?? null : null),
    [filtered, confirmingId],
  );

  const closeMenu = useCallback((returnFocus = false) => {
    setMenuId(null);
    if (returnFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const closeConfirm = useCallback((returnFocus = false) => {
    setConfirmingId(null);
    if (returnFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const menu = useAnchoredPopover({ open: menuEvent !== null, anchorRef: triggerRef, align: 'end', gap: 6, onRequestClose: () => closeMenu(true) });
  const confirm = useAnchoredPopover({ open: confirmEvent !== null, anchorRef: triggerRef, align: 'end', gap: 6, onRequestClose: () => closeConfirm(true) });

  // Focus management — menu focuses its first item, the destructive
  // confirmation focuses 取消 (the safe choice) so Enter can never delete by accident.
  useEffect(() => {
    if (!menuEvent) return;
    const frame = window.requestAnimationFrame(() => menuItemRefs.current[0]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [menuEvent]);
  useEffect(() => {
    if (!confirmEvent) return;
    const frame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [confirmEvent]);

  const onMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    const items = menuItemRefs.current.filter((node): node is HTMLButtonElement => node !== null);
    if (items.length === 0) return;
    const index = items.findIndex((node) => node === document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); items[items.length - 1]?.focus(); }
  }, []);

  const handleOpen = useCallback((event: CountdownEvent) => {
    if (navigateOnOpen) {
      navigate(`/calendar?date=${event.targetAt}&action=countdown&id=${event.id}`);
    } else if (onEdit) {
      onEdit(event);
    }
  }, [navigate, navigateOnOpen, onEdit]);

  const handleCopy = useCallback((event: CountdownEvent) => {
    addEvent({
      title: `${event.title} 副本`,
      targetAt: event.targetAt,
      targetTime: event.targetTime,
      direction: event.direction,
      recurrence: event.recurrence,
      includeTargetDay: event.includeTargetDay,
      showTime: event.showTime,
      colorToken: event.colorToken,
      iconId: event.iconId,
      coverAssetId: event.coverAssetId,
    });
    closeMenu();
  }, [addEvent, closeMenu]);

  const handleCreateQuest = useCallback((event: CountdownEvent) => {
    const dueDate = event.targetAt;
    const dueTime = event.targetTime || undefined;
    const dueAt = dueTime ? new Date(`${dueDate}T${dueTime}:00`).toISOString() : new Date(`${dueDate}T23:59:00`).toISOString();
    // QuestStore recurrence only supports daily/weekly/monthly; map monthly→monthly,
    // yearly→none (TIDEQUEST tasks with yearly recurrence are out of scope here).
    const recurrence = event.recurrence.type === 'monthly' ? { frequency: 'monthly' as const, interval: 1 } : undefined;
    createQuest({
      title: `為「${event.title}」準備`,
      description: `由 TIDECOUNT 倒數自動建立`,
      priority: 'medium',
      status: 'available',
      dueAt,
      recurrence,
      source: 'manual',
    });
    closeMenu();
  }, [createQuest, closeMenu]);

  const confirmDelete = useCallback(() => {
    if (!confirmEvent) return;
    deleteEvent(confirmEvent.id);
    closeConfirm(true);
  }, [confirmEvent, deleteEvent, closeConfirm]);

  // C4 — a scoped section with nothing bound to the selected day renders
  // nothing at all. The caller hides the whole section (no large empty state).
  if (scoped && filtered.length === 0) return null;

  return (
    <div className="countdown-section" data-testid="countdown-section" data-scope={scoped ? scopeDate : undefined}>
      {filtered.length === 0 ? (
        <div className="countdown-section-empty">
          <p>{emptyHint}</p>
          {showCreateButton && (
            <button type="button" className="countdown-section-create-btn" onClick={onCreate}>
              建立第一個倒數
            </button>
          )}
        </div>
      ) : (
        <ul className="countdown-section-list">
          {filtered.map((event) => {
            const snap = snapshot.find((s) => s.id === event.id);
            const display = resolveCountdownDisplay(event, now);
            const isMenuOpen = menuId === event.id;
            return (
              <li
                key={event.id}
                className={`countdown-section-item mode-${display.mode}${event.pinnedToHome ? ' is-pinned' : ''}${scoped ? ' is-scoped' : ''}`}
                data-event-id={event.id}
              >
                <button type="button" className="countdown-section-main" onClick={() => handleOpen(event)}>
                  <CountdownCover event={event} size={56} className="countdown-section-cover" />
                  {scoped ? (
                    // On the target date the day count is 0 by construction, so the
                    // card shows the D0 state instead of "還有 0 天".
                    <div className="countdown-section-days is-scope-today" data-scope-state="today">
                      <span className="countdown-section-unit">今天</span>
                    </div>
                  ) : (
                    <div className="countdown-section-days">
                      <span className="countdown-section-num">{display.dayCount}</span>
                      <span className="countdown-section-unit">{display.mode === 'elapsed' ? '天' : display.mode === 'today' ? '今天' : '天'}</span>
                    </div>
                  )}
                  <div className="countdown-section-meta">
                    <strong>{event.title}</strong>
                    <small>
                      {scoped ? scopeDate : display.nextOccurrenceAt}
                      {event.targetTime ? ` · ${event.targetTime}` : ''}
                      {' · '}{scoped ? '今天' : display.label}
                      {event.recurrence.type !== 'none' ? ` · ${event.recurrence.type === 'yearly' ? '每年' : '每月'}` : ''}
                    </small>
                  </div>
                </button>
                <div className="countdown-section-actions">
                  <button
                    type="button"
                    className={`countdown-section-pin${event.pinnedToHome ? ' active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); togglePinned(event.id); }}
                    aria-label={event.pinnedToHome ? '取消釘選' : '釘選到首頁'}
                    title={event.pinnedToHome ? '取消釘選' : '釘選到首頁'}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="17" x2="12" y2="22" />
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="countdown-section-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerRef.current = e.currentTarget;
                      if (isMenuOpen) closeMenu();
                      else { setConfirmingId(null); setMenuId(event.id); }
                    }}
                    aria-label="更多操作"
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {menuEvent && (
        <AnchoredPopoverSurface
          popoverRef={menu.popoverRef}
          position={menu.position}
          className="countdown-section-menu"
          role="menu"
          aria-label={`${menuEvent.title} 的操作`}
          onKeyDown={onMenuKeyDown}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <button ref={(node) => { menuItemRefs.current[0] = node; }} type="button" role="menuitem" onClick={() => { if (onEdit) onEdit(menuEvent); else handleOpen(menuEvent); closeMenu(); }}>編輯</button>
          <button ref={(node) => { menuItemRefs.current[1] = node; }} type="button" role="menuitem" onClick={() => handleCopy(menuEvent)}>複製</button>
          <button ref={(node) => { menuItemRefs.current[2] = node; }} type="button" role="menuitem" onClick={() => { togglePinned(menuEvent.id); closeMenu(); }}>
            {menuEvent.pinnedToHome ? '取消釘選' : '釘選到首頁'}
          </button>
          <button ref={(node) => { menuItemRefs.current[3] = node; }} type="button" role="menuitem" onClick={() => handleCreateQuest(menuEvent)}>建立 TIDEQUEST 準備</button>
          <button
            ref={(node) => { menuItemRefs.current[4] = node; }}
            type="button"
            role="menuitem"
            className="countdown-section-menu-danger"
            // `triggerRef` already points at this row's ⋯ button (captured when the
            // menu opened), so the confirmation anchors to the same trigger.
            onClick={() => { setConfirmingId(menuEvent.id); closeMenu(); }}
          >刪除</button>
        </AnchoredPopoverSurface>
      )}

      {confirmEvent && (
        <AnchoredPopoverSurface
          popoverRef={confirm.popoverRef}
          position={confirm.position}
          className="countdown-section-confirm"
          data-testid="countdown-delete-confirm"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="countdown-delete-confirm-title"
          aria-describedby="countdown-delete-confirm-body"
        >
          <strong id="countdown-delete-confirm-title">{`刪除「${confirmEvent.title}」？`}</strong>
          <p id="countdown-delete-confirm-body">此動作無法復原。</p>
          <div className="countdown-section-confirm-actions">
            <button ref={cancelButtonRef} type="button" onClick={() => closeConfirm(true)}>取消</button>
            <button type="button" className="countdown-section-confirm-danger" onClick={confirmDelete}>刪除</button>
          </div>
        </AnchoredPopoverSurface>
      )}
    </div>
  );
}

export const COUNTDOWN_FILTERS: { value: CountdownFilter; label: string }[] = (
  ['all', 'upcoming', 'today', 'elapsed', 'anniversary'] as CountdownFilter[]
).map((value) => ({ value, label: FILTER_LABEL[value] }));
