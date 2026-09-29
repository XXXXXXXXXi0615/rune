import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCompanionPetStore, type CompanionBreakpoint, type NormalizedPosition } from '@/store/useCompanionPetStore';
import { COMPANION_PET_PACKS, getCompanionVisual } from '@/features/companionPets/companionPetPacks';
import { AVAILABLE_COMPANION_PET_PACK_IDS } from '@/features/companionPets/companionPetAvailability';
import { CompanionPetVisual } from './CompanionPetVisual';
import { resolveAcceptedPetPosition, resolvePetReservedRegions, type PetRect, type PetResolutionContext } from '@/features/desktopPet/PetSafeRegionResolver';
import './CompanionPetHost.css';

const APP_PREVIEW_WIDTH = 430;
const LONG_PRESS_MS = 550;
/** Vertical space the dock reserves; mirrors the rendering `calc()` below. */
const handleInsetFor = (breakpoint: CompanionBreakpoint) => (breakpoint === 'mobile' ? 88 : 12);
const currentBreakpoint = (): CompanionBreakpoint => window.innerWidth < 768
  ? 'mobile'
  : window.innerWidth < 1100
    ? 'tablet'
    : 'desktop';
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const routeKeyOf = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname);

const companionViewport = () => {
  const browserWidth = window.visualViewport?.width ?? innerWidth;
  const width = Math.min(browserWidth, APP_PREVIEW_WIDTH);
  return { width, left: Math.max(0, (browserWidth - width) / 2), height: window.visualViewport?.height ?? innerHeight };
};

const pointToNormalizedPosition = (
  clientX: number,
  clientY: number,
  drag: DragState,
  breakpoint: CompanionBreakpoint,
  petSize: number,
): NormalizedPosition => {
  const bounds = companionViewport();
  return {
    x: clamp((clientX - bounds.left - drag.offsetX) / Math.max(1, bounds.width - petSize)),
    y: clamp((clientY - drag.offsetY) / Math.max(1, bounds.height - petSize - (breakpoint === 'mobile' ? 88 : 12))),
  };
};

/** Reserved page regions the companion must not sit on. */
const resolveReservedRegions = (): PetRect[] => {
  const menuRect = document.querySelector('.companion-menu')?.getBoundingClientRect();
  return resolvePetReservedRegions().filter((region) => {
    // The companion's own compact menu is not an obstacle.
    if (menuRect && region.left < menuRect.right && menuRect.left < region.right && region.top < menuRect.bottom && menuRect.top < region.bottom) return false;
    return region.width < window.innerWidth * 0.96 || region.height < window.innerHeight * 0.96;
  });
};

/** Geometry + obstacles for one accepted-position decision. */
const buildResolutionContext = (breakpoint: CompanionBreakpoint, petSize: number): PetResolutionContext => {
  const bounds = companionViewport();
  return {
    canvasLeft: bounds.left,
    canvasWidth: bounds.width,
    canvasHeight: bounds.height,
    bottomReserve: handleInsetFor(breakpoint),
    petSize,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    reserved: resolveReservedRegions(),
  };
};

interface DragState { pointerId: number; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean }
interface PalettePosition { left: number; top: number; sheet: boolean }

const resolvePalettePosition = (anchorX: number, anchorY: number): PalettePosition => {
  const width = Math.min(320, window.innerWidth - 24);
  const sheet = window.innerWidth < 768;
  // Reserve the picker's full compact height up-front so switching layers
  // cannot push the anchored surface below the viewport.
  const estimatedHeight = Math.min(sheet ? 300 : 420, window.innerHeight * .72);
  return {
    left: Math.max(12, Math.min(anchorX, window.innerWidth - width - 12)),
    top: sheet ? Math.max(12, window.innerHeight - estimatedHeight - 16) : Math.max(12, Math.min(anchorY, window.innerHeight - estimatedHeight - 12)),
    sheet,
  };
};

/**
 * Single global decorative companion display host (manual-only).
 * No AI, no autonomous movement, no idle planner. Placement, scale and
 * visibility are route-scoped user preferences; everything else is a
 * straight projection of the canonical companion pet store.
 */
export function CompanionPetHost() {
  const location = useLocation();
  const routeKey = routeKeyOf(location.pathname);
  const preferences = useCompanionPetStore((state) => state.preferences);
  const transientHidden = useCompanionPetStore((state) => state.transientHidden);
  const suppressionReasons = useCompanionPetStore((state) => state.suppressionReasons);
  const setRoutePresentation = useCompanionPetStore((state) => state.setRoutePresentation);
  const setTransientHidden = useCompanionPetStore((state) => state.setTransientHidden);
  const resetRoutePresentation = useCompanionPetStore((state) => state.resetRoutePresentation);
  const setSelectedVisual = useCompanionPetStore((state) => state.setSelectedVisual);
  const setSelectedPetPackId = useCompanionPetStore((state) => state.setSelectedPetPackId);
  const setPinned = useCompanionPetStore((state) => state.setPinned);
  const [breakpoint, setBreakpoint] = useState<CompanionBreakpoint>(() => currentBreakpoint());
  const [position, setLocalPosition] = useState<NormalizedPosition>(() => {
    const base = preferences.position[breakpoint];
    const route = preferences.routePresentation[routeKey];
    return { x: route?.x ?? base.x, y: route?.y ?? base.y };
  });
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState<PalettePosition | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const petRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragSessionRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const positionRef = useRef(position);
  const pack = COMPANION_PET_PACKS[preferences.selectedPetPackId];
  const routePresentation = preferences.routePresentation[routeKey];
  const hiddenOnRoute = routePresentation?.hidden === true;
  const selectedVisualId = preferences.selectedVisualByPack[pack.id] ?? String(pack.fallbackId);
  const visual = useMemo(() => getCompanionVisual(pack.id, selectedVisualId), [pack.id, selectedVisualId]);
  const routeScale = routePresentation?.scale;
  const scale = routeScale ?? preferences.scale;
  const petSize = (breakpoint === 'mobile' ? 64 : breakpoint === 'tablet' ? 78 : 88) * scale;
  const locked = preferences.pinned;
  const shouldRender = preferences.enabled
    && !preferences.manuallyHidden
    && !transientHidden
    && suppressionReasons.length === 0
    && !hiddenOnRoute;
  useLayoutEffect(() => { positionRef.current = position; }, [position]);

  /**
   * Single decision point for the accepted position: the requested drop is
   * resolved once, here, and the outcome is what gets rendered and persisted.
   * `resolveAcceptedPetPosition` is a fixed point, so the idle maintenance pass
   * below can never move an already accepted position again.
   */
  const acceptPosition = (requested: NormalizedPosition) => resolveAcceptedPetPosition(requested, buildResolutionContext(breakpoint, petSize));

  const dragRuntimeRef = useRef({ routeKey, breakpoint, petSize, shouldRender, setRoutePresentation, acceptPosition });
  useLayoutEffect(() => {
    dragRuntimeRef.current = { routeKey, breakpoint, petSize, shouldRender, setRoutePresentation, acceptPosition };
  });

  const routeX = routePresentation?.x;
  const routeY = routePresentation?.y;
  useEffect(() => {
    if (!shouldRender) return;
    const base = preferences.position[breakpoint];
    setLocalPosition({ x: routeX ?? base.x, y: routeY ?? base.y });
  }, [shouldRender, routeKey, routeX, routeY, breakpoint, preferences.position]);
  useEffect(() => {
    if (!shouldRender) return;
    const onResize = () => setBreakpoint(currentBreakpoint());
    onResize();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [shouldRender]);
  useEffect(() => {
    if (!transientHidden) return;
    const reveal = () => setTransientHidden(false);
    window.addEventListener('lunartide:show-companion', reveal);
    return () => window.removeEventListener('lunartide:show-companion', reveal);
  }, [setTransientHidden, transientHidden]);

  useEffect(() => {
    if (!shouldRender || dragging) return;
    let frame = 0;
    // Idle maintenance runs the exact same resolution the drop path ran, so it
    // is a no-op for a position that was already accepted on release. It only
    // ever moves the companion when the page geometry changed underneath it.
    const relocateIfNeeded = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = positionRef.current;
        const accepted = resolveAcceptedPetPosition(current, buildResolutionContext(breakpoint, petSize));
        if (Math.abs(accepted.x - current.x) < .0001 && Math.abs(accepted.y - current.y) < .0001) return;
        const next = { x: accepted.x, y: accepted.y };
        setLocalPosition(next);
        setRoutePresentation(routeKey, next);
      });
    };
    relocateIfNeeded();
    const observer = new MutationObserver(relocateIfNeeded);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pet-safe-region'] });
    window.addEventListener('resize', relocateIfNeeded, { passive: true });
    window.addEventListener('scroll', relocateIfNeeded, { passive: true, capture: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', relocateIfNeeded); window.removeEventListener('scroll', relocateIfNeeded, true); };
  }, [breakpoint, dragging, petSize, shouldRender, routeKey, setRoutePresentation]);

  const cancelLongPress = () => {
    if (longPressRef.current !== null) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
  };
  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (locked) { event.preventDefault(); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, startX: event.clientX, startY: event.clientY, moved: false };
    dragSessionRef.current = event.pointerId;
    cancelLongPress();
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      setMenu(resolvePalettePosition(rect.left, rect.bottom + 8));
      dragRef.current = null;
    }, LONG_PRESS_MS);
    setDragging(true);
  };
  const updateScale = (next: number) => setRoutePresentation(routeKey, { scale: Math.min(1.35, Math.max(.75, next)) });
  const onResizePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startScale = scale;
    const baseSize = breakpoint === 'mobile' ? 64 : breakpoint === 'tablet' ? 78 : 88;
    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      updateScale(startScale + Math.max(pointerEvent.clientX - startX, pointerEvent.clientY - startY) / baseSize);
    };
    const finish = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };
  // Window-level drag pipeline: setPointerCapture is unreliable across
  // engines for a custom floating layer. These listeners deliberately live
  // for the Host mount so pointer-move renders cannot create a release gap.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
        if (longPressRef.current !== null) {
          window.clearTimeout(longPressRef.current);
          longPressRef.current = null;
        }
      }
      drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
      const runtime = dragRuntimeRef.current;
      setLocalPosition(pointToNormalizedPosition(event.clientX, event.clientY, drag, runtime.breakpoint, runtime.petSize));
    };
    const finalizeDrag = (event: PointerEvent) => {
      if (dragSessionRef.current !== event.pointerId) return;
      const drag = dragRef.current;
      // Clearing first makes pointerup + pointercancel idempotent for a drag session.
      dragSessionRef.current = null;
      dragRef.current = null;
      if (longPressRef.current !== null) {
        window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      setDragging(false);
      if (!drag) return;
      const runtime = dragRuntimeRef.current;
      if (!runtime.shouldRender) return;
      // Requested drop → deterministic safe-region resolution → one accepted
      // position, rendered and persisted. Nothing rewrites it afterwards.
      const accepted = runtime.acceptPosition(pointToNormalizedPosition(event.clientX, event.clientY, drag, runtime.breakpoint, runtime.petSize));
      const next = { x: accepted.x, y: accepted.y };
      setLocalPosition(next);
      runtime.setRoutePresentation(runtime.routeKey, next);
      if (!drag.moved && runtime.breakpoint !== 'mobile') setMenu(resolvePalettePosition(event.clientX + 8, event.clientY + 8));
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', finalizeDrag);
    window.addEventListener('pointercancel', finalizeDrag);
    return () => {
      dragSessionRef.current = null;
      dragRef.current = null;
      if (longPressRef.current !== null) {
        window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finalizeDrag);
      window.removeEventListener('pointercancel', finalizeDrag);
    };
  }, []);

  useEffect(() => {
    if (shouldRender || dragSessionRef.current === null) return;
    dragSessionRef.current = null;
    dragRef.current = null;
    cancelLongPress();
    setDragging(false);
  }, [shouldRender]);

  useEffect(() => {
    if (shouldRender) return;
    setMenu(null);
    setPickerOpen(false);
  }, [shouldRender]);

  useEffect(() => {
    if (!menu) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPickerOpen(false);
      setMenu(null);
      requestAnimationFrame(() => petRef.current?.focus());
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || menu.sheet || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const left = Math.max(12, Math.min(menu.left, window.innerWidth - rect.width - 12));
    const top = Math.max(12, Math.min(menu.top, window.innerHeight - rect.height - 12));
    if (left !== menu.left || top !== menu.top) setMenu({ ...menu, left, top });
  }, [menu, pickerOpen]);

  if (!shouldRender) return null;

  const canvas = companionViewport();
  const style = {
    left: canvas.left + position.x * (canvas.width - petSize),
    top: `calc(${position.y} * (100dvh - ${petSize + (breakpoint === 'mobile' ? 88 : 12)}px))`,
    width: petSize,
    height: petSize,
    '--companion-user-scale': scale,
  } as React.CSSProperties;

  const closeMenu = () => { setPickerOpen(false); setMenu(null); window.setTimeout(() => petRef.current?.focus(), 0); };
  const hit = visual.hitBounds;
  const compactMenu = menu ? <div className="companion-menu-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
    <section ref={menuRef} className={`companion-menu${menu.sheet ? ' companion-menu--sheet' : ''}`} role="dialog" aria-label={pickerOpen ? '選擇展示角色' : 'Companion 顯示控制'} data-testid="companion-menu" data-picker-open={pickerOpen} data-pet-safe-region="interactive" style={menu.sheet ? undefined : { left: menu.left, top: menu.top }}>
      <header className="companion-menu__header">
        {pickerOpen ? <button type="button" className="companion-menu__back" onClick={() => setPickerOpen(false)} aria-label="返回顯示控制">‹</button> : <span className="companion-menu__thumbnail"><CompanionPetVisual visual={visual} reducedMotion={false} loading="eager" /></span>}
        <span className="companion-menu__heading"><strong>{pickerOpen ? '選擇展示角色' : visual.label}</strong><small>{pickerOpen ? pack.displayName : 'Companion'}</small></span>
        <button type="button" className="companion-menu__close" onClick={closeMenu} aria-label="關閉">×</button>
      </header>
      {pickerOpen ? <div className="companion-menu__picker" data-testid="companion-asset-picker">
        <div className="companion-menu__packs" role="radiogroup" aria-label="角色系列">
          {AVAILABLE_COMPANION_PET_PACK_IDS.map((id) => COMPANION_PET_PACKS[id]).map((candidate) => <button key={candidate.id} type="button" role="radio" aria-checked={pack.id === candidate.id} className={`companion-menu__pack${pack.id === candidate.id ? ' is-selected' : ''}`} onClick={() => setSelectedPetPackId(candidate.id)}>{candidate.displayName}</button>)}
        </div>
        <div className="companion-menu__visuals" role="radiogroup" aria-label={`${pack.displayName} 形象`}>
          {pack.visuals.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === visual.id} className={`companion-menu__visual${item.id === visual.id ? ' is-selected' : ''}`} onClick={() => { setSelectedVisual(pack.id, String(item.id)); closeMenu(); }}>
            <span className="companion-menu__preview"><CompanionPetVisual visual={item} reducedMotion={false} className="companion-palette-visual" loading="lazy" /></span><span>{item.label}</span>
          </button>)}
        </div>
      </div> : <div className="companion-menu__controls">
        <button type="button" className="companion-menu__change" onClick={() => setPickerOpen(true)}>更換形象</button>
        <div className="companion-menu__scale" role="group" aria-label="此頁大小">
          <span>此頁大小</span><button type="button" aria-label="縮小此頁桌寵" onClick={() => updateScale(scale - .05)}>−</button>
          <input type="range" min="0.75" max="1.35" step="0.05" value={scale} aria-label="此頁桌寵大小" onChange={(event) => updateScale(Number(event.target.value))} />
          <button type="button" aria-label="放大此頁桌寵" onClick={() => updateScale(scale + .05)}>＋</button><output>{Math.round(scale * 100)}%</output>
        </div>
        <div className="companion-menu__actions">
          <button type="button" data-testid="companion-lock-toggle" onClick={() => setPinned(!locked)}>{locked ? '解除鎖定' : '鎖定位置'}</button>
          <button type="button" onClick={() => { resetRoutePresentation(routeKey); closeMenu(); }}>重設此頁位置</button>
          <button type="button" className="is-quiet-danger" data-testid="companion-hide-route" onClick={() => { setRoutePresentation(routeKey, { hidden: true }); closeMenu(); }}>隱藏此頁</button>
        </div>
      </div>}
    </section>
  </div> : null;

  return createPortal(<div className="companion-pet-host companion-pet-host--manual" data-testid="companion-pet-host" data-companion-mode="manual-only" data-timer-owner="none" data-pet-pack={pack.id} data-companion-route={routeKey} data-companion-locked={locked ? 'true' : 'false'} data-companion-rendered-asset={visual.id} data-companion-position-x={position.x.toFixed(4)} data-companion-position-y={position.y.toFixed(4)}>
    <button
      ref={petRef}
      type="button"
      disabled={locked}
      className={`companion-pet${locked ? ' is-locked' : ''}${dragging ? ' is-dragging' : ' is-none'}`}
      style={style}
      aria-label={locked ? 'Companion 已鎖定為純展示' : 'Companion；拖曳移動，點擊或長按開啟顯示設定'}
      onPointerDown={onPointerDown}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelLongPress();
        dragRef.current = null;
        dragSessionRef.current = null;
        setDragging(false);
        setPickerOpen(false);
        setMenu(resolvePalettePosition(event.clientX, event.clientY));
      }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setMenu(resolvePalettePosition(rect.left, rect.bottom + 8)); } }}
    >
      <CompanionPetVisual visual={visual} reducedMotion={false} loading="eager" />
      {/* Only the painted character owns pointer input; the transparent rest of
          the box stays click-through for the page behind it. */}
      {!locked && <span
        aria-hidden="true"
        className="companion-pet__hit"
        data-testid="companion-hit"
        data-companion-hit-bounds={`${hit.left},${hit.top},${hit.right},${hit.bottom}`}
        style={{ left: `${hit.left * 100}%`, top: `${hit.top * 100}%`, width: `${(hit.right - hit.left) * 100}%`, height: `${(hit.bottom - hit.top) * 100}%` }}
      />}
      {!locked && <span className="companion-pet__resize-handle" data-testid="companion-resize-handle" aria-hidden="true" onPointerDown={onResizePointerDown} onClick={(event) => event.stopPropagation()} />}
    </button>
    {compactMenu}
  </div>, document.body);
}
