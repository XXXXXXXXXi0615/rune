// ================================================================
// HomeCountdownWidget — Calendar C2
//
// Renders the CountdownEvents the user pinned to Home
// (`CountdownEvent.pinnedToHome`, the canonical field the editor's
// 「置頂到月潮首頁 / 顯示於首頁倒數 Widget」 toggle writes).
//
// - Reads the canonical countdown store; Home stores no event copy.
// - Up to HOME_COUNTDOWN_MAX events, ordered by the canonical countdown
//   ordering (`sortCountdownEvents(..., 'nearest')`).
// - Cover / icon / colour come from the shared `CountdownCover`, so the card
//   and this widget can never disagree.
// - Nothing pinned → renders nothing (no empty dashboard card).
// - Detail stays the existing popover (desktop) / bottom sheet (phone) with
//   編輯 · 取消置頂 · 查看全部倒數.
// ================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  type CountdownEvent,
  resolveCountdownDisplay,
  sortCountdownEvents,
} from '@/features/countdown/countdownEngine';
import { selectCountdownEvents, useCountdownStore } from '@/features/countdown/useCountdownStore';
import { useNow } from '@/hooks/useNow';
import { CountdownEditorSheet } from '@/components/countdown/CountdownEditorSheet';
import { CountdownCover } from '@/components/countdown/countdownVisuals';
import './HomeCountdownWidget.css';

/** Initial widget capacity — pinned events beyond this stay in Calendar only. */
export const HOME_COUNTDOWN_MAX = 3;

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function UnpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" />
    </svg>
  );
}

/* ── Detail content (shared by popover + sheet) ── */
function DetailContent({ event, onClose, onEdit, onUnpin }: {
  event: CountdownEvent;
  onClose: () => void;
  onEdit: () => void;
  onUnpin: () => void;
}) {
  const navigate = useNavigate();
  const now = useNow('minute');
  const display = useMemo(() => resolveCountdownDisplay(event, now), [event, now]);

  return (
    <div className="hcap-expansion" data-testid="countdown-expansion">
      <header className="hcap-expansion-header">
        <div className="hcap-expansion-title">
          <CountdownCover event={event} size={44} />
          <div>
            <strong>{event.title}</strong>
            <small>{display.nextOccurrenceAt}{event.targetTime ? ` · ${event.targetTime}` : ''}</small>
          </div>
        </div>
        <button type="button" className="hcap-expansion-close" onClick={onClose} aria-label="關閉">✕</button>
      </header>

      <div className="hcap-expansion-count">
        <span className={`hcap-expansion-num mode-${display.mode}`}>
          {display.mode === 'today' ? '今天' : display.dayCount}
        </span>
        <span className="hcap-expansion-label">{display.label}</span>
      </div>

      <div className="hcap-expansion-actions">
        <button type="button" className="hcap-expansion-btn" onClick={onEdit}>
          <EditIcon /> 編輯
        </button>
        <button type="button" className="hcap-expansion-btn" onClick={onUnpin}>
          <UnpinIcon /> 取消置頂
        </button>
        <button type="button" className="hcap-expansion-btn hcap-expansion-btn--secondary" onClick={() => { onClose(); navigate('/calendar?tab=countdowns'); }}>
          查看全部倒數
        </button>
      </div>
    </div>
  );
}

/* ── Desktop popover, anchored to the row that opened it ── */
function CountdownPopover({ event, anchor, onClose, onEdit, onUnpin }: {
  event: CountdownEvent;
  anchor: HTMLElement | null;
  onClose: () => void;
  onEdit: () => void;
  onUnpin: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchor) { setPos(null); return; }
    const rect = anchor.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left });
  }, [anchor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!pos) return null;

  return createPortal(
    <div className="hcap-popover-backdrop" onClick={onClose}>
      <div
        className="hcap-popover"
        style={{ position: 'fixed', top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="倒數詳情"
        data-testid="countdown-popover"
      >
        <DetailContent event={event} onClose={onClose} onEdit={onEdit} onUnpin={onUnpin} />
      </div>
    </div>,
    document.body,
  );
}

/* ── Mobile bottom sheet ── */
function CountdownBottomSheet({ event, onClose, onEdit, onUnpin }: {
  event: CountdownEvent;
  onClose: () => void;
  onEdit: () => void;
  onUnpin: () => void;
}) {
  useEffect(() => {
    document.body.classList.add('sheet-open');
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.classList.remove('sheet-open');
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  return createPortal(
    <div className="hcap-sheet-backdrop" onClick={onClose}>
      <div
        className="hcap-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="倒數詳情"
        data-testid="countdown-sheet"
      >
        <DetailContent event={event} onClose={onClose} onEdit={onEdit} onUnpin={onUnpin} />
      </div>
    </div>,
    document.body,
  );
}

/* ── Main widget ── */
export function HomeCountdownWidget() {
  const now = useNow('minute');
  const events = useCountdownStore(selectCountdownEvents);
  const togglePinnedToHome = useCountdownStore((s) => s.togglePinnedToHome);

  const [detail, setDetail] = useState<{ id: string; anchor: HTMLElement | null } | null>(null);
  const [editing, setEditing] = useState<CountdownEvent | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pinned = useMemo(
    () => sortCountdownEvents(events.filter((event) => event.pinnedToHome), now, 'nearest').slice(0, HOME_COUNTDOWN_MAX),
    [events, now],
  );

  const closeDetail = useCallback(() => setDetail(null), []);

  // Nothing pinned — the widget is absent instead of showing an empty card.
  if (pinned.length === 0) return null;

  const active = detail ? pinned.find((event) => event.id === detail.id) ?? null : null;

  return (
    <>
      <ul className="hcap-list" data-testid="home-countdown-widget" data-pinned-count={pinned.length}>
        {pinned.map((event) => {
          const display = resolveCountdownDisplay(event, now);
          const isActive = detail?.id === event.id;
          return (
            <li
              key={event.id}
              className={`hcap-item mode-${display.mode}${isActive ? ' is-active' : ''}`}
              data-event-id={event.id}
              data-mode={display.mode}
            >
              <button
                type="button"
                className="hcap-item-btn"
                aria-haspopup="dialog"
                aria-expanded={isActive}
                onClick={(nativeEvent) => setDetail({ id: event.id, anchor: nativeEvent.currentTarget })}
              >
                <CountdownCover event={event} size={40} />
                <span className="hcap-item-meta">
                  <strong>{event.title}</strong>
                  <small>
                    {display.nextOccurrenceAt}
                    {event.targetTime ? ` · ${event.targetTime}` : ''}
                    {' · '}{display.label}
                  </small>
                </span>
                <span className="hcap-item-count">
                  {display.mode === 'today'
                    ? <b className="hcap-item-today">今天</b>
                    : <><b>{display.dayCount}</b><i>{display.mode === 'elapsed' ? '天' : '天'}</i></>}
                  <ChevronRight />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {active && !isMobile && (
        <CountdownPopover
          event={active}
          anchor={detail?.anchor ?? null}
          onClose={closeDetail}
          onEdit={() => { setEditing(active); closeDetail(); }}
          onUnpin={() => { togglePinnedToHome(active.id); closeDetail(); }}
        />
      )}
      {active && isMobile && (
        <CountdownBottomSheet
          event={active}
          onClose={closeDetail}
          onEdit={() => { setEditing(active); closeDetail(); }}
          onUnpin={() => { togglePinnedToHome(active.id); closeDetail(); }}
        />
      )}
      {editing !== null && <CountdownEditorSheet event={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
