import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  HOME_LAYOUT_VERSION,
  createDefaultHomeLayout,
  type HomeLayoutState,
  type HomeWidgetId,
  type HomeWidgetPreset,
} from '@/features/home/homeLayout';
import {
  cloneHomeLayout,
  isHomeLayoutDirty,
  moveVisibleDraftWidget,
  reorderVisibleDraftWidget,
  resetDraftHomeLayout,
  setDraftWidgetPreset,
  setDraftWidgetVisible,
} from '@/features/home/homeEditDraft';
import { homeWidgetLabel, homeWidgetPresetOptions } from '@/features/home/homeLayoutPresentation';
import {
  resolveAutoScrollStep,
  resolveInsertionIndex,
  resolveRowOffsets,
  type HomeWidgetRowMetrics,
} from '@/features/home/homeEditDrag';
import { useHomeWidgetLayoutStore } from '@/features/home/useHomeWidgetLayoutStore';
import { useCountdownStore } from '@/features/countdown/useCountdownStore';
import { RuneSegmentedControl, RuneSheet } from '@/components/ui/rune';
import { HomeWidgetShell } from './HomeWidgetShell';
import { MoonGlassClock } from './MoonGlassClock';
import { HomePresencePill } from './HomePresencePill';
import { RunePixelWorld } from './RunePixelWorld';
import { HomeMusicNowPlaying } from './HomeMusicNowPlaying';
import { HomeCountdownWidget } from './HomeCountdownWidget';
import './HomeWidgetStack.css';

/**
 * Phase 2B — Edit Home.
 *
 * Owner: this Home presentation layer. Edit mode is presentation-only state:
 * the canonical layout is cloned into a local draft, every edit mutates the
 * draft, and only 完成 writes through `commitLayout`. 取消 discards the draft
 * untouched, so entering, dragging, switching presets, hiding, and reset
 * persist nothing.
 */

const HOLD_MS = 560;
const HOLD_MOVE_TOLERANCE_PX = 9;

/** Long-press must never start on a real control or a registered safe region. */
const HOLD_BLOCKED_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="menu"]',
  '[data-pet-safe-region]',
  '[data-home-edit-no-hold]',
].join(', ');

interface DragSession {
  id: HomeWidgetId;
  pointerId: number;
  startY: number;
  pointerY: number;
  scrollOffset: number;
  fromIndex: number;
  targetIndex: number;
  rows: HomeWidgetRowMetrics[];
  shift: number;
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="5" cy="4" r="1.3" fill="currentColor" />
      <circle cx="11" cy="4" r="1.3" fill="currentColor" />
      <circle cx="5" cy="8" r="1.3" fill="currentColor" />
      <circle cx="11" cy="8" r="1.3" fill="currentColor" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="11" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
      <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2.5 9c2-3.2 4.4-4.8 6.5-4.8S13.5 5.8 15.5 9c-2 3.2-4.4 4.8-6.5 4.8S4.5 12.2 2.5 9Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 15 15 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M9 3.5v11M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function renderHomeWidgetContent(id: HomeWidgetId, preset: HomeWidgetPreset): ReactNode {
  switch (id) {
    case 'moon-clock':
      return <MoonGlassClock />;
    case 'daily-checkin':
      return null;
    case 'presence':
      return <HomePresencePill compact={preset === 'island'} />;
    case 'pixel-world':
      return <RunePixelWorld />;
    case 'music-now-playing':
      return <HomeMusicNowPlaying preset={preset === 'medium' ? 'medium' : 'island'} />;
    case 'countdown':
      return <HomeCountdownWidget />;
  }
}

export function HomeWidgetStack() {
  const canonicalWidgets = useHomeWidgetLayoutStore((state) => state.widgets);
  const commitLayout = useHomeWidgetLayoutStore((state) => state.commitLayout);
  // Calendar C2 — the countdown widget only exists on Home while the user has
  // pinned at least one CountdownEvent. The canonical layout entry stays
  // visible; the row itself is content-driven, so nothing pinned means no row
  // (never an empty dashboard card).
  const countdownHasPinned = useCountdownStore((state) => (state.events ?? []).some((event) => event.pinnedToHome));

  const [draft, setDraft] = useState<HomeLayoutState | null>(null);
  const [selectedId, setSelectedId] = useState<HomeWidgetId | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [drag, setDrag] = useState<DragSession | null>(null);

  const stackRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  const canonical = useMemo<HomeLayoutState>(
    () => ({ version: HOME_LAYOUT_VERSION, widgets: canonicalWidgets }),
    [canonicalWidgets],
  );
  const layout = draft ?? canonical;
  const editing = draft !== null;
  const widgets = layout.widgets;
  const homeWidgets = useMemo(() => widgets.filter((widget) => widget.id !== 'daily-checkin'), [widgets]);
  const visibleWidgets = useMemo(
    () => homeWidgets.filter((widget) => widget.visible && (widget.id !== 'countdown' || countdownHasPinned || draft !== null)),
    [homeWidgets, countdownHasPinned, draft],
  );
  const hiddenCount = homeWidgets.length - visibleWidgets.length;
  const dirty = editing && isHomeLayoutDirty(canonical, layout);
  const resetPending = isHomeLayoutDirty(createDefaultHomeLayout(), layout);

  const cancelHold = useCallback(() => {
    if (holdRef.current === null) return;
    window.clearTimeout(holdRef.current.timer);
    holdRef.current = null;
  }, []);

  const exitEdit = useCallback(() => {
    cancelHold();
    dragRef.current = null;
    setDrag(null);
    setDraft(null);
    setSelectedId(null);
    setHiddenOpen(false);
  }, [cancelHold]);

  const enterEdit = useCallback(() => {
    cancelHold();
    setDraft(cloneHomeLayout({
      version: HOME_LAYOUT_VERSION,
      widgets: useHomeWidgetLayoutStore.getState().widgets,
    }));
    setSelectedId(null);
  }, [cancelHold]);

  const applyDraft = useCallback((updater: (current: HomeLayoutState) => HomeLayoutState) => {
    setDraft((current) => (current ? updater(current) : current));
  }, []);

  const handleSave = useCallback(() => {
    if (dirty && draft) commitLayout(draft);
    exitEdit();
  }, [commitLayout, dirty, draft, exitEdit]);

  const handleReset = useCallback(() => {
    applyDraft(() => resetDraftHomeLayout());
    setSelectedId(null);
  }, [applyDraft]);

  /* ── Long-press entry ─────────────────────────────────────────────── */
  useEffect(() => cancelHold, [cancelHold]);

  useEffect(() => {
    const scrollOwner = document.querySelector<HTMLElement>('.app-main');
    if (!scrollOwner) return;
    const onScroll = () => cancelHold();
    scrollOwner.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollOwner.removeEventListener('scroll', onScroll);
  }, [cancelHold]);

  const onStackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest(HOLD_BLOCKED_SELECTOR)) return;
    cancelHold();
    const { clientX, clientY } = event;
    const timer = window.setTimeout(() => {
      holdRef.current = null;
      enterEdit();
    }, HOLD_MS);
    holdRef.current = { timer, x: clientX, y: clientY };
  };

  const onStackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hold = holdRef.current;
    if (hold === null) return;
    if (Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > HOLD_MOVE_TOLERANCE_PX) cancelHold();
  };

  /* ── Draft editing ────────────────────────────────────────────────── */
  const toggleSelected = (id: HomeWidgetId) => setSelectedId((current) => (current === id ? null : id));

  const hideWidget = (id: HomeWidgetId) => {
    applyDraft((current) => setDraftWidgetVisible(current, id, false));
    setSelectedId(null);
  };

  const moveWidget = (id: HomeWidgetId, direction: -1 | 1) => {
    applyDraft((current) => moveVisibleDraftWidget(current, id, direction));
  };

  const changePreset = (id: HomeWidgetId, preset: HomeWidgetPreset) => {
    applyDraft((current) => setDraftWidgetPreset(current, id, preset));
  };

  /* ── Drag reorder ─────────────────────────────────────────────────── */
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: HomeWidgetId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const stack = stackRef.current;
    if (!stack) return;
    const rowNodes = Array.from(stack.querySelectorAll<HTMLElement>('[data-home-widget-row]'));
    const rows = rowNodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    const fromIndex = visibleWidgets.findIndex((widget) => widget.id === id);
    if (fromIndex < 0 || !rows[fromIndex]) return;
    const gap = rows.length > 1 ? Math.max(0, rows[1].top - rows[0].bottom) : 0;
    const session: DragSession = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      pointerY: event.clientY,
      scrollOffset: 0,
      fromIndex,
      targetIndex: fromIndex,
      rows,
      shift: rows[fromIndex].height + gap,
    };
    dragRef.current = session;
    setDrag(session);
    cancelHold();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateDrag = useCallback((clientY: number) => {
    const session = dragRef.current;
    if (!session) return;
    const next: DragSession = {
      ...session,
      pointerY: clientY,
      targetIndex: resolveInsertionIndex(clientY + session.scrollOffset, session.rows, session.fromIndex),
    };
    dragRef.current = next;
    setDrag(next);
  }, []);

  const endDrag = useCallback((commit: boolean) => {
    const session = dragRef.current;
    if (!session) return;
    dragRef.current = null;
    setDrag(null);
    if (!commit || session.targetIndex === session.fromIndex) return;
    setDraft((current) => (current ? reorderVisibleDraftWidget(current, session.id, session.targetIndex) : current));
  }, []);

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const viewport = document.querySelector<HTMLElement>('.app-main');
    if (!viewport) return;
    let frame = 0;
    const tick = () => {
      const session = dragRef.current;
      if (session) {
        const rect = viewport.getBoundingClientRect();
        const step = resolveAutoScrollStep(session.pointerY, rect.top, rect.bottom);
        if (step !== 0) {
          const before = viewport.scrollTop;
          viewport.scrollTop = before + step;
          const applied = viewport.scrollTop - before;
          if (applied !== 0) {
            const moved: DragSession = {
              ...session,
              scrollOffset: session.scrollOffset + applied,
              targetIndex: resolveInsertionIndex(session.pointerY + session.scrollOffset + applied, session.rows, session.fromIndex),
            };
            dragRef.current = moved;
            setDrag(moved);
          }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [dragging]);

  const rowOffsets = drag && drag.targetIndex !== drag.fromIndex
    ? resolveRowOffsets(visibleWidgets.length, drag.fromIndex, drag.targetIndex, drag.shift)
    : null;

  return (
    <div
      ref={stackRef}
      className="home-fixed-zone home-widget-stack"
      data-testid="home-widget-stack"
      data-home-edit-mode={editing ? 'on' : 'off'}
      data-home-edit-dirty={editing ? (dirty ? 'true' : 'false') : undefined}
      onPointerDown={onStackPointerDown}
      onPointerMove={onStackPointerMove}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
    >
      {!editing && (
        <button type="button" className="home-widget-edit-entry" onClick={enterEdit}>
          編輯首頁
        </button>
      )}

      {visibleWidgets.map((widget, index) => {
        const label = homeWidgetLabel(widget.id);
        const selected = editing && selectedId === widget.id;
        const isDragged = drag?.id === widget.id;
        const offset = !isDragged && rowOffsets ? rowOffsets[index] ?? 0 : 0;
        const rowStyle: CSSProperties | undefined = isDragged
          ? { transform: `translate3d(0, ${drag.pointerY - drag.startY}px, 0)`, zIndex: 3 }
          : offset !== 0
            ? { transform: `translate3d(0, ${offset}px, 0)` }
            : undefined;
        return (
          <div
            key={widget.id}
            className="home-widget-row"
            data-home-widget-row
            data-widget-id={widget.id}
            data-home-widget-selected={selected ? 'true' : undefined}
            data-home-dragging={isDragged ? 'true' : undefined}
            style={rowStyle}
          >
            {editing && (
              <div className="hv-widget-bar" data-pet-safe-region="interactive">
                <button
                  type="button"
                  className="hv-drag-handle"
                  aria-label={`拖曳「${label}」調整順序`}
                  onPointerDown={(event) => beginDrag(event, widget.id)}
                  onPointerMove={(event) => updateDrag(event.clientY)}
                  onPointerUp={() => endDrag(true)}
                  onPointerCancel={() => endDrag(false)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    moveWidget(widget.id, event.key === 'ArrowUp' ? -1 : 1);
                  }}
                >
                  <GripIcon />
                </button>
                <button
                  type="button"
                  className="hv-widget-select"
                  aria-label={`調整「${label}」`}
                  aria-expanded={selected}
                  aria-controls={selected ? `hv-controls-${widget.id}` : undefined}
                  onClick={() => toggleSelected(widget.id)}
                >
                  <span className="hv-widget-name">{label}</span>
                  <ChevronIcon open={selected} />
                </button>
                <span className="hv-widget-order" aria-hidden="true">{index + 1}</span>
              </div>
            )}
            {editing && selected && (
              <div
                id={`hv-controls-${widget.id}`}
                className="hv-widget-controls"
                role="group"
                aria-label={`「${label}」設定`}
                data-pet-safe-region="interactive"
              >
                <button
                  type="button"
                  className="hv-ctl"
                  aria-label={`將「${label}」上移`}
                  disabled={index === 0}
                  onClick={() => moveWidget(widget.id, -1)}
                >上移</button>
                <button
                  type="button"
                  className="hv-ctl"
                  aria-label={`將「${label}」下移`}
                  disabled={index === visibleWidgets.length - 1}
                  onClick={() => moveWidget(widget.id, 1)}
                >下移</button>
                <RuneSegmentedControl
                  label={`「${label}」尺寸`}
                  items={homeWidgetPresetOptions(widget.id)}
                  value={widget.preset}
                  onChange={(value) => changePreset(widget.id, value as HomeWidgetPreset)}
                />
                <button
                  type="button"
                  className="hv-ctl hv-ctl--quiet"
                  aria-label={`隱藏「${label}」`}
                  disabled={visibleWidgets.length <= 1}
                  onClick={() => hideWidget(widget.id)}
                >
                  <EyeOffIcon />
                  <span>隱藏</span>
                </button>
              </div>
            )}
            {/* The countdown widget has no content while nothing is pinned: the
                edit row stays available, but no empty glass card is rendered. */}
            {!(widget.id === 'countdown' && !countdownHasPinned) && <HomeWidgetShell
              preset={widget.preset}
              material="bare"
              aria-label={label}
              data-home-widget-id={widget.id}
              data-home-widget-draft={editing ? 'true' : undefined}
            >
              {renderHomeWidgetContent(widget.id, widget.preset)}
            </HomeWidgetShell>}
          </div>
        );
      })}

      {editing && (
        <div className="hv-edit-bar" role="toolbar" aria-label="編輯首頁控制列" data-pet-safe-region="interactive">
          <button
            type="button"
            className="hv-bar-btn"
            aria-label={hiddenCount > 0 ? `已隱藏 ${hiddenCount} 個小工具` : '沒有已隱藏的小工具'}
            disabled={hiddenCount === 0}
            onClick={() => setHiddenOpen(true)}
          >
            <PlusIcon />
            <span>{hiddenCount > 0 ? `已隱藏 ${hiddenCount}` : '已隱藏'}</span>
          </button>
          <button
            type="button"
            className="hv-bar-btn"
            disabled={!resetPending}
            onClick={handleReset}
          >重設</button>
          <button type="button" className="hv-bar-btn" onClick={exitEdit}>取消</button>
          <button type="button" className="hv-bar-btn hv-bar-btn--primary" onClick={handleSave}>完成</button>
        </div>
      )}

      <RuneSheet open={editing && hiddenOpen} onClose={() => setHiddenOpen(false)} title="已隱藏的小工具">
        <ul className="hv-hidden-list">
          {homeWidgets.map((widget) => (
            <li key={widget.id} className="hv-hidden-item" data-hidden={widget.visible ? 'false' : 'true'}>
              <span className="hv-hidden-name">{homeWidgetLabel(widget.id)}</span>
              {widget.visible ? (
                <span className="hv-hidden-state">已顯示</span>
              ) : (
                <button
                  type="button"
                  className="hv-hidden-add"
                  aria-label={`加入「${homeWidgetLabel(widget.id)}」`}
                  onClick={() => applyDraft((current) => setDraftWidgetVisible(current, widget.id, true))}
                >
                  <PlusIcon />
                  <span>加入小工具</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </RuneSheet>
    </div>
  );
}
