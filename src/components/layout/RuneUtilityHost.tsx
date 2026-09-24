import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RuneBrandLogo } from '@/components/branding/RuneBrandLogo';
import { resolveRuneOrbAvatarAsset } from '@/components/branding/runeBrandAssets';
import { AppIcon } from '@/components/icons/AppIcon';
import { getModuleById } from '@/features/navigation/appModuleRegistry';
import { resolveAppModuleIconName } from '@/features/navigation/appModuleIcon';
import type { AppModuleDefinition } from '@/features/navigation/types';
import {
  RUNE_ORBIT_PRIMARY_MODULE_IDS,
  RUNE_ORBIT_SECONDARY_MODULE_IDS,
  RUNE_ORBIT_SLOTS,
  resolveRuneOrbitOffset,
} from '@/features/navigation/runeOrbitMenu';
import { resolveNearestSafeDelta, resolvePetReservedRegions } from '@/features/desktopPet/PetSafeRegionResolver';
import { usePetRecede } from '@/hooks/usePetRecede';
import { useDrawerStore } from '@/store/useDrawerStore';
import { useModalStore } from '@/store/useModalStore';
import { useRuneUtilityStore } from '@/store/useRuneUtilityStore';
import {
  DEFAULT_RUNE_ORB_POSITION,
  RUNE_ORB_DRAG_THRESHOLD_PX,
  clampRuneOrbPointToBounds,
  classifyRuneOrbGesture,
  normalizedYFromTop,
  runeOrbRect,
  snapRuneOrbEdgeWithinBounds,
  topFromNormalizedY,
  type Point,
  type RuneOrbPosition,
} from '@/utils/runeOrbGeometry';
import './RuneUtilityHost.css';

const POSITION_KEY = 'lunartide-rune-orb-position-v1';
const ORB_SIZE = 56;
const INNER_SAFE_MARGIN = 16;

function resolveAppFrameBounds() {
  const rect = document.querySelector<HTMLElement>('#app')?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
  }
  return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
}

function loadPosition(): RuneOrbPosition {
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null') as Partial<RuneOrbPosition> | null;
    if ((value?.edge === 'left' || value?.edge === 'right') && typeof value.normalizedY === 'number') {
      return { edge: value.edge, normalizedY: Math.min(1, Math.max(0, value.normalizedY)) };
    }
  } catch { /* legacy or corrupt values fall back safely */ }
  return DEFAULT_RUNE_ORB_POSITION;
}

interface OrbitalSlotSpec {
  slot: typeof RUNE_ORBIT_SLOTS[number];
  module: AppModuleDefinition;
  offsetX: number;
  offsetY: number;
  slotDelayMs: number;
}

interface OrbitMenuProps {
  onSelect: (module: AppModuleDefinition) => void;
}

function OrbitMenu({ onSelect }: OrbitMenuProps) {
  const slots = useMemo<OrbitalSlotSpec[]>(() => {
    const moduleIds: readonly AppModuleDefinition['id'][] = [
      ...RUNE_ORBIT_PRIMARY_MODULE_IDS,
      ...RUNE_ORBIT_SECONDARY_MODULE_IDS,
    ];
    return RUNE_ORBIT_SLOTS.map((slot, index) => {
      const id = moduleIds[slot.index];
      const module = getModuleById(id);
      if (!module) return null;
      const offset = resolveRuneOrbitOffset(slot);
      // Inner ring reveals first (radial breath outward), outer slots stagger after.
      const slotDelayMs = index * 28;
      return {
        slot,
        module,
        offsetX: offset.offsetX,
        offsetY: offset.offsetY,
        slotDelayMs,
      };
    }).filter((entry): entry is OrbitalSlotSpec => entry !== null);
  }, []);

  const placeTooltip = (button: HTMLButtonElement) => {
    if (window.innerWidth <= 600) return;
    const label = button.querySelector<HTMLElement>('.rune-orb-slot__label');
    const bead = button.querySelector<HTMLElement>('.rune-orb-slot__bead');
    const app = document.querySelector<HTMLElement>('#app');
    const orb = document.querySelector<HTMLElement>('.rune-orb');
    if (!label || !bead || !app) return;
    label.style.removeProperty('--tooltip-x');
    label.style.removeProperty('--tooltip-y');
    const slotRect = button.getBoundingClientRect();
    const beadRect = bead.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    const angle = Number(button.dataset.orbitAngle ?? 180) * Math.PI / 180;
    const outward = { x: Math.cos(angle), y: -Math.sin(angle) };
    const directions = [outward, { x: -outward.x, y: -outward.y }, { x: -outward.y, y: outward.x }, { x: outward.y, y: -outward.x }];
    const orbRect = orb?.getBoundingClientRect();
    const blockers = [orbRect, ...Array.from(document.querySelectorAll<HTMLElement>('.rune-orb-slot__bead')).filter((node) => node !== bead).map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left + 12, right: rect.right - 12, top: rect.top + 12, bottom: rect.bottom - 12 } as DOMRect;
    })].filter((rect): rect is DOMRect => Boolean(rect));
    const intersects = (a: { left: number; right: number; top: number; bottom: number }, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const center = { x: beadRect.left + beadRect.width / 2, y: beadRect.top + beadRect.height / 2 };
    const candidates = directions.flatMap((direction) => [30, 50, 70].map((gap) => {
      const distance = gap + Math.abs(direction.x) * labelRect.width / 2 + Math.abs(direction.y) * labelRect.height / 2;
      const left = center.x + direction.x * distance - labelRect.width / 2;
      const top = center.y + direction.y * distance - labelRect.height / 2;
      const rect = { left, top, right: left + labelRect.width, bottom: top + labelRect.height };
      const valid = rect.left >= appRect.left + 4 && rect.right <= appRect.right - 4 && rect.top >= appRect.top + 4 && rect.bottom <= appRect.bottom - 4 && !blockers.some((blocker) => intersects(rect, blocker));
      return { left, top, valid };
    }));
    const choice = candidates.find((candidate) => candidate.valid) ?? candidates[0];
    label.style.setProperty('--tooltip-x', `${choice.left - slotRect.left}px`);
    label.style.setProperty('--tooltip-y', `${choice.top - slotRect.top}px`);
  };

  return (
    <div className="rune-orb-orbit" role="menu" aria-label="Rune 快捷工具">
      <svg className="rune-orb-orbit__track" aria-hidden="true" focusable="false" viewBox="-170 -170 340 340" width="340" height="340">
        <defs>
          <linearGradient id="rune-orbit-track-gradient" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="18%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="78%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Inner ring arc — 210° → 90° (left → up via "west"). sweep-flag 0 = visually CCW with y-down = traces through left side. */}
        <path
          className="rune-orb-orbit__arc rune-orb-orbit__arc--inner"
          d="M -79.672 46 A 92 92 0 0 0 0 -92"
          fill="none"
          stroke="url(#rune-orbit-track-gradient)"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        {/* Outer ring arc — 195° → 105°. Inner-gap orientation; mirrors the same CCW direction. */}
        <path
          className="rune-orb-orbit__arc rune-orb-orbit__arc--outer"
          d="M -135.230 36.231 A 140 140 0 0 0 -98.995 -98.995"
          fill="none"
          stroke="url(#rune-orbit-track-gradient)"
          strokeWidth="0.55"
          strokeLinecap="round"
        />
      </svg>
      {slots.map((entry) => {
        const { slot, module, offsetX, offsetY, slotDelayMs } = entry;
        const ringClass = slot.ring === 'inner' ? ' rune-orb-slot--inner' : ' rune-orb-slot--outer';
        return (
          <button
            key={slot.index}
            type="button"
            className={`rune-orb-slot${ringClass}`}
            data-orbit-slot={slot.index}
            data-orbit-ring={slot.ring}
            data-orbit-angle={slot.angleDeg}
            style={{
              ['--orbit-x' as string]: `${offsetX}px`,
              ['--orbit-y' as string]: `${offsetY}px`,
              ['--orbit-delay' as string]: `${slotDelayMs}ms`,
            }}
            onClick={() => onSelect(module)}
            onPointerEnter={(event) => placeTooltip(event.currentTarget)}
            onFocus={(event) => placeTooltip(event.currentTarget)}
            aria-label={`打開${module.label}`}
            role="menuitem"
          >
            <span className="rune-orb-slot__hit" aria-hidden="true">
              <span className="rune-orb-slot__bead"><AppIcon name={resolveAppModuleIconName(module.id)} size={18} /></span>
            </span>
            <span className="rune-orb-slot__label" aria-hidden="true">{module.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RuneMobileUtilityTrigger() {
  const open = useRuneUtilityStore((state) => state.mobileOpen);
  const toggle = useRuneUtilityStore((state) => state.toggleMobile);
  return <button type="button" className="rune-mobile-utility-trigger" onClick={toggle} aria-label="開啟 Rune 快捷工具" aria-expanded={open} aria-haspopup="dialog" data-pet-safe-region="interactive">
    <AppIcon name="orbit" size={22} />
  </button>;
}

export function RuneUtilityHost() {
  const navigate = useNavigate();
  const activeModal = useModalStore((state) => state.activeModal);
  const activeSheet = useModalStore((state) => state.activeSheet);
  const activeDrawer = useDrawerStore((state) => state.activeDrawer);
  const mobileOpen = useRuneUtilityStore((state) => state.mobileOpen);
  const closeMobile = useRuneUtilityStore((state) => state.closeMobile);
  const [desktop, setDesktop] = useState(() => window.innerWidth > 600);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [edgeHint, setEdgeHint] = useState<'left' | 'right' | null>(null);
  const [snapFeedback, setSnapFeedback] = useState(false);
  const [domBlocked, setDomBlocked] = useState(false);
  const [position, setPosition] = useState<Point>({ x: -200, y: -200 });
  const [savedPosition, setSavedPosition] = useState<RuneOrbPosition>(() => loadPosition());
  const pointerRef = useRef<{ id: number; start: Point; origin: Point; dragging: boolean } | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const blocked = Boolean(activeModal || activeSheet || activeDrawer || domBlocked);
  usePetRecede(expanded || mobileOpen);

  const resolvePoint = useCallback((preference: RuneOrbPosition): Point => {
    const frame = resolveAppFrameBounds();
    const base = clampRuneOrbPointToBounds({
      x: preference.edge === 'right' ? frame.right - ORB_SIZE - INNER_SAFE_MARGIN : frame.left + INNER_SAFE_MARGIN,
      y: frame.top + topFromNormalizedY(preference.normalizedY, frame.height, ORB_SIZE, INNER_SAFE_MARGIN),
    }, frame, ORB_SIZE, INNER_SAFE_MARGIN);
    const companionRect = document.querySelector<HTMLElement>('.companion-pet')?.getBoundingClientRect();
    const appInteractiveRects = Array.from(document.querySelectorAll<HTMLElement>('#app main :is(button, a[href], [role="button"])'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
    const reserved = [
      ...resolvePetReservedRegions(),
      ...appInteractiveRects,
      ...(companionRect && companionRect.width > 0 && companionRect.height > 0
        ? [{ left: companionRect.left, top: companionRect.top, right: companionRect.right, bottom: companionRect.bottom, width: companionRect.width, height: companionRect.height }]
        : []),
    ]
      .filter((rect) => rect.right > frame.left && rect.left < frame.right && rect.bottom > frame.top && rect.top < frame.bottom)
      .map((rect) => ({ ...rect, left: rect.left - frame.left, right: rect.right - frame.left, top: rect.top - frame.top, bottom: rect.bottom - frame.top }))
      .filter((rect) => rect.width < frame.width * 0.96 && rect.height < frame.height * 0.96);
    const localBase = { x: base.x - frame.left, y: base.y - frame.top };
    const localOrbRect = runeOrbRect(localBase, ORB_SIZE);
    const railReserved = reserved
      .filter((rect) => localOrbRect.right + 12 > rect.left && localOrbRect.left - 12 < rect.right)
      .map((rect) => ({ ...rect, left: 0, right: frame.width, width: frame.width }));
    const delta = resolveNearestSafeDelta(localOrbRect, frame.width, frame.height, railReserved, 12);
    return clampRuneOrbPointToBounds({ x: base.x + delta.dx, y: base.y + delta.dy }, frame, ORB_SIZE, INNER_SAFE_MARGIN);
  }, []);

  useEffect(() => {
    const recalc = () => {
      setDesktop(window.innerWidth > 600);
      setPosition(resolvePoint(savedPosition));
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', recalc);
    const frame = document.querySelector<HTMLElement>('#app');
    const frameObserver = frame ? new ResizeObserver(recalc) : null;
    if (frame) frameObserver?.observe(frame);
    let observedPet: Element | null = null;
    const petObserver = new MutationObserver(recalc);
    const observePet = () => {
      const pet = document.querySelector('.companion-pet');
      // Content can reflow while the Companion node remains unchanged.
      recalc();
      if (pet === observedPet) return;
      petObserver.disconnect();
      observedPet = pet;
      if (pet) petObserver.observe(pet, { attributes: true, attributeFilter: ['class', 'style'] });
      recalc();
    };
    const safeRegionObserver = new MutationObserver(observePet);
    safeRegionObserver.observe(document.body, { childList: true, subtree: true });
    observePet();
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
      window.visualViewport?.removeEventListener('resize', recalc);
      frameObserver?.disconnect();
      petObserver.disconnect();
      safeRegionObserver.disconnect();
    };
  }, [resolvePoint, savedPosition]);

  useEffect(() => {
    const update = () => setDomBlocked(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not(.rune-utility-sheet), .msg-popover-overlay, [data-testid="active-call-view"]')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (blocked) { setExpanded(false); closeMobile(); }
  }, [blocked, closeMobile]);

  useEffect(() => () => {
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false); orbRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const buttons = Array.from(hostRef.current?.querySelectorAll<HTMLButtonElement>('.rune-orb-slot') || []);
      if (!buttons.length) return;
      event.preventDefault();
      const active = document.activeElement as HTMLButtonElement | null;
      const activeIndex = active ? buttons.indexOf(active) : -1;
      // Iterate clockwise: index 0 (left-down) → 1 (left) → 2 (left-up) → 3 → 4 → 5 → 6 → 7 → back to 0.
      // ArrowLeft = CCW (decrement), ArrowRight = CW (increment).
      const total = buttons.length;
      const nextIndex = activeIndex < 0
        ? (event.key === 'ArrowLeft' ? total - 1 : 0)
        : (activeIndex + (event.key === 'ArrowLeft' ? -1 : 1) + total) % total;
      buttons[nextIndex]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  useEffect(() => {
    if (desktop || !mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMobile, desktop, mobileOpen]);

  useEffect(() => {
    if (!desktop || !expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && hostRef.current?.contains(target)) return;
      setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [desktop, expanded]);

  const selectAppModule = useCallback((module: AppModuleDefinition) => {
    setExpanded(false);
    closeMobile();
    navigate(module.route);
  }, [closeMobile, navigate]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: position, dragging: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (classifyRuneOrbGesture(pointer.start, { x: event.clientX, y: event.clientY }, RUNE_ORB_DRAG_THRESHOLD_PX) === 'drag') {
      pointer.dragging = true;
      setDragging(true);
    }
    if (!pointer.dragging) return;
    setExpanded(false);
    const frame = resolveAppFrameBounds();
    const nextPoint = clampRuneOrbPointToBounds({ x: pointer.origin.x + event.clientX - pointer.start.x, y: pointer.origin.y + event.clientY - pointer.start.y }, frame, ORB_SIZE, INNER_SAFE_MARGIN);
    setPosition(nextPoint);
    setEdgeHint(nextPoint.x <= frame.left + 72 ? 'left' : nextPoint.x >= frame.right - ORB_SIZE - 72 ? 'right' : null);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    setDragging(false);
    setEdgeHint(null);
    if (!pointer.dragging) { setExpanded((value) => !value); return; }
    const frame = resolveAppFrameBounds();
    const edge = snapRuneOrbEdgeWithinBounds(position.x + ORB_SIZE / 2, frame);
    const next: RuneOrbPosition = { edge, normalizedY: normalizedYFromTop(position.y - frame.top, frame.height, ORB_SIZE, INNER_SAFE_MARGIN) };
    localStorage.setItem(POSITION_KEY, JSON.stringify(next));
    setSavedPosition(next);
    setSnapFeedback(true);
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => setSnapFeedback(false), 160);
  };

  const presentationMode = expanded ? 'expanded' : 'closed';

  return <>
    {desktop && !blocked && <div ref={hostRef} className={`rune-orb-host${dragging ? ' is-dragging' : ''}${snapFeedback ? ' is-snap-feedback' : ''}`} style={{ left: position.x, top: position.y }} data-testid="rune-orb-host" data-edge={savedPosition.edge} data-presentation-mode={presentationMode} data-edge-hint={edgeHint || undefined} data-normalized-y={savedPosition.normalizedY.toFixed(4)}>
      <button ref={orbRef} type="button" className={`rune-orb${expanded ? ' is-expanded' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointerRef.current = null; setDragging(false); setEdgeHint(null); }} onClick={(event) => { if (event.detail === 0) setExpanded((value) => !value); }} aria-label="開啟 Rune 快捷工具" aria-expanded={expanded}>
        <span className="rune-orb__bead" aria-hidden="true" />
        <span className="rune-orb__avatar-viewport" aria-hidden="true">
          <img className="rune-orb__avatar" src={resolveRuneOrbAvatarAsset('neutral')} alt="" draggable="false" />
        </span>
      </button>
      {expanded && <OrbitMenu onSelect={selectAppModule} />}
    </div>}
    {!desktop && mobileOpen && !blocked && <div className="rune-utility-sheet-backdrop" onClick={closeMobile}>
      <section className="rune-utility-sheet" role="dialog" aria-modal="true" aria-label="Rune 快捷工具" onClick={(event) => event.stopPropagation()}>
        <div className="rune-utility-sheet__handle" />
        <header><RuneBrandLogo decorative /><span>應用</span></header>
        <OrbitMenu onSelect={selectAppModule} />
        <button type="button" className="rune-utility-sheet__close" onClick={closeMobile}>關閉</button>
      </section>
    </div>}
  </>;
}
