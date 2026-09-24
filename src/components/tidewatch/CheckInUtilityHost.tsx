import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useCheckInStore } from '@/features/tidewatch/checkInStore';
import { CHECKIN_NUDGE_SNOOZE_KEY, checkInSuppressionKey, minutesUntilTomorrow, shouldShowCheckInNudge } from '@/features/tidewatch/checkInNudgePolicy';
import { useDrawerStore } from '@/store/useDrawerStore';
import { useModalStore } from '@/store/useModalStore';
import { useTidewatchNudgeStore } from '@/store/useTidewatchNudgeStore';
import { CheckInFloat } from './CheckInFloat';
import { CheckInNudge } from './CheckInNudge';
import './CheckInNudge.css';
import './CheckInUtilityHost.css';

export type CheckInUtilityMode = 'idle' | 'nudge' | 'editing';
export type CheckInUtilityEdge = 'left' | 'right';
export interface CheckInUtilityPlacement { edge: CheckInUtilityEdge; anchorY: number }
export interface CheckInUtilityHostHandle { edit: () => void }
export interface RectLike { left: number; top: number; right: number; bottom: number }
export interface Point { x: number; y: number }

const SAFE_GAP = 14;
const ART_OVERHANG = 24;

export function resolveCheckInUtilityBounds(shell: RectLike, topSafeRect: RectLike | null, bottomSafeRects: RectLike[], size: { width: number; height: number }, viewportHeight: number) {
  const minX = shell.left + SAFE_GAP;
  const maxX = Math.max(minX, shell.right - SAFE_GAP - size.width);
  const minY = Math.max(shell.top + SAFE_GAP + ART_OVERHANG, (topSafeRect?.bottom ?? shell.top) + SAFE_GAP + ART_OVERHANG);
  const visibleBottomRects = bottomSafeRects.filter((rect) => rect.top < viewportHeight && rect.bottom > 0);
  const safeBottom = visibleBottomRects.length ? Math.min(...visibleBottomRects.map((rect) => rect.top)) - SAFE_GAP : Math.min(shell.bottom, viewportHeight) - SAFE_GAP;
  return { minX, maxX, minY, maxY: Math.max(minY, safeBottom - size.height), safeBottom };
}

export function clampCheckInUtilityPoint(point: Point, bounds: ReturnType<typeof resolveCheckInUtilityBounds>): Point {
  return { x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)), y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)) };
}

export function pointFromCheckInPlacement(placement: CheckInUtilityPlacement, bounds: ReturnType<typeof resolveCheckInUtilityBounds>, height: number): Point {
  return clampCheckInUtilityPoint({ x: placement.edge === 'right' ? bounds.maxX : bounds.minX, y: placement.anchorY - height }, bounds);
}

export function placementFromCheckInPoint(point: Point, bounds: ReturnType<typeof resolveCheckInUtilityBounds>, height: number): CheckInUtilityPlacement {
  const clamped = clampCheckInUtilityPoint(point, bounds);
  return { edge: Math.abs(clamped.x - bounds.minX) <= Math.abs(bounds.maxX - clamped.x) ? 'left' : 'right', anchorY: clamped.y + height };
}

export const CheckInUtilityHost = forwardRef<CheckInUtilityHostHandle>(function CheckInUtilityHost(_, ref) {
  const latest = useCheckInStore((state) => state.latest);
  const snoozedUntil = useTidewatchNudgeStore((state) => state.snoozedUntil);
  const snooze = useTidewatchNudgeStore((state) => state.snooze);
  const activeModal = useModalStore((state) => state.activeModal);
  const activeSheet = useModalStore((state) => state.activeSheet);
  const activeDrawer = useDrawerStore((state) => state.activeDrawer);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [placement, setPlacement] = useState<CheckInUtilityPlacement | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [edgeInsets, setEdgeInsets] = useState({ left: SAFE_GAP, right: SAFE_GAP });
  const rootRef = useRef<HTMLDivElement>(null);
  const placementRef = useRef<CheckInUtilityPlacement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Point } | null>(null);
  const dragPointRef = useRef<Point | null>(null);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => setDismissed(false), [latest?.id]);

  const overlayBlocked = activeModal != null || activeSheet != null || activeDrawer != null;
  const nudgeDue = !dismissed && shouldShowCheckInNudge({ latest, snoozedUntil, overlayBlocked, now });
  const mode: CheckInUtilityMode = editing ? 'editing' : nudgeDue ? 'nudge' : 'idle';

  const edit = useCallback(() => { setDismissed(true); setEditing(true); }, []);
  const idle = useCallback(() => setEditing(false), []);
  useImperativeHandle(ref, () => ({ edit }), [edit]);

  const measureBounds = useCallback(() => {
    const root = rootRef.current;
    const shell = document.querySelector<HTMLElement>('.tidewatch-shell');
    const utility = root?.firstElementChild as HTMLElement | null;
    if (!root || !utility || !shell) return null;
    const topSafe = document.querySelector<HTMLElement>('.tw-view-switch, .route-status-island, .top-island-host');
    const bottomSafeRects: RectLike[] = Array.from(document.querySelectorAll<HTMLElement>('.mobile-tab-bar, .mobile-dock-hide, .mobile-dock-reveal')).map((element) => element.getBoundingClientRect());
    const rootStyle = getComputedStyle(document.documentElement);
    const dockHeight = Number.parseFloat(rootStyle.getPropertyValue('--mtb-height')) || 66;
    const dockOffset = Number.parseFloat(rootStyle.getPropertyValue('--mtb-bottom-offset')) || 6;
    bottomSafeRects.push({ left: shell.getBoundingClientRect().left, right: shell.getBoundingClientRect().right, top: window.innerHeight - dockHeight - dockOffset - 48, bottom: window.innerHeight });
    return resolveCheckInUtilityBounds(shell.getBoundingClientRect(), topSafe?.getBoundingClientRect() ?? null, bottomSafeRects, utility.getBoundingClientRect(), window.innerHeight);
  }, []);

  const place = useCallback(() => {
    const root = rootRef.current;
    const bounds = measureBounds();
    if (!root || !bounds) return;
    const utility = root.firstElementChild as HTMLElement | null;
    if (!utility) return;
    const measuredSize = utility.getBoundingClientRect();
    setSize({ width: measuredSize.width, height: measuredSize.height });
    const shellRect = document.querySelector<HTMLElement>('.tidewatch-shell')!.getBoundingClientRect();
    setEdgeInsets({ left: shellRect.left + SAFE_GAP, right: window.innerWidth - shellRect.right + SAFE_GAP });
    const shared = placementRef.current ?? { edge: 'right' as const, anchorY: bounds.safeBottom };
    if (!placementRef.current) { placementRef.current = shared; setPlacement(shared); }
    setPosition(dragPoint ?? pointFromCheckInPlacement(shared, bounds, measuredSize.height));
  }, [dragPoint, measureBounds]);

  useLayoutEffect(() => {
    place();
    const root = rootRef.current;
    const utility = root?.firstElementChild;
    const observer = utility && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (utility) observer?.observe(utility);
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(place); });
    const onViewportChange = () => place();
    window.addEventListener('resize', onViewportChange);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', onViewportChange); };
  }, [mode, place]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const root = rootRef.current;
    if (!root || event.button !== 0) return;
    const rect = root.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: rect.left, y: rect.top } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const bounds = measureBounds();
    if (!drag || !bounds || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextPoint = clampCheckInUtilityPoint({ x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY }, bounds);
    dragPointRef.current = nextPoint;
    setDragPoint(nextPoint);
  };
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const bounds = measureBounds();
    const utility = rootRef.current?.firstElementChild as HTMLElement | null;
    if (!drag || !bounds || !utility || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const finalPoint = dragPointRef.current ?? drag.origin;
    const utilityHeight = utility.getBoundingClientRect().height;
    const nextPlacement = placementFromCheckInPoint(finalPoint, bounds, utilityHeight);
    placementRef.current = nextPlacement;
    setPlacement(nextPlacement);
    dragPointRef.current = null;
    setDragPoint(null);
    setPosition(pointFromCheckInPlacement(nextPlacement, bounds, utilityHeight));
  };
  const dragHandleProps = { onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag };

  const anchoredStyle = position && placement
    ? dragPoint
      ? { left: position.x, top: position.y, width: size.width, height: size.height }
      : { left: placement.edge === 'left' ? edgeInsets.left : undefined, right: placement.edge === 'right' ? edgeInsets.right : undefined, top: placement.anchorY - size.height, width: size.width, height: size.height }
    : { visibility: 'hidden' as const };
  return <div ref={rootRef} className={`checkin-utility-host is-${mode}`} data-testid="checkin-utility-host" data-mode={mode} data-edge={placement?.edge ?? 'right'} data-anchor-y={placement?.anchorY ?? ''} style={anchoredStyle}>
    {mode === 'nudge' && latest ? <CheckInNudge latest={latest} onOpen={edit} onDismiss={() => setDismissed(true)} onSnooze={() => snooze(CHECKIN_NUDGE_SNOOZE_KEY, 30)} onSuppress={() => { const date = new Date(now); snooze(checkInSuppressionKey(date), minutesUntilTomorrow(date)); }} /> : <CheckInFloat mode={mode === 'editing' ? 'editing' : 'idle'} onEdit={edit} onIdle={idle} dragHandleProps={dragHandleProps} />}
  </div>;
});
