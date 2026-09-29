export interface PetRect { left: number; top: number; right: number; bottom: number; width: number; height: number }
export const PET_SAFE_GAP_PX = 20;
export const PET_FOCUS_COMPANION_SLOT_SELECTOR = '[data-focus-companion-slot]';

export const PET_RESERVED_REGION_SELECTORS = [
  '.system-top-bar', '.stb-header', '.desktop-sidebar', '.mobile-tab-bar',
  '.focus-island', '.tidebound-window', '.tidebound-island',
  '[role="dialog"][aria-modal="true"]', '.quick-sheet', '.bottom-sheet',
  '[class*="toast"]', '[class*="iteration-notice"]', '[class*="floating-window"]', '.rew-window',
  '.ex-layout', '.ex-result-card',
  '[data-home-editable-grid] :is(button, a[href])',
  '[data-pet-safe-region]',
] as const;

// Phase 1.1: Native dock metrics injected from iOS Shell Bridge
// Set by nativeShellStateChanged event handler; consumed by resolvePetReservedRegions
let _nativeDockRect: PetRect | null = null;

export function setNativeDockRect(rect: { x: number; y: number; width: number; height: number } | null): void {
  if (!rect || rect.width <= 0 || rect.height <= 0) { _nativeDockRect = null; return; }
  _nativeDockRect = { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height, width: rect.width, height: rect.height };
}

export function getNativeDockRect(): PetRect | null { return _nativeDockRect; }

const toRect = (rect: DOMRect): PetRect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });

export function resolvePetReservedRegions(root: ParentNode = document): PetRect[] {
  const regions = resolveDomReservedRegions(root);
  // Append native dock rect if set
  const nativeDock = getNativeDockRect();
  if (nativeDock) regions.push(nativeDock);
  return regions;
}

function resolveDomReservedRegions(root: ParentNode): PetRect[] {
  const activeModal = Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).reverse().find((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });
  const seen = new Set<Element>();
  return PET_RESERVED_REGION_SELECTORS.flatMap((selector) => Array.from(root.querySelectorAll(selector))).filter((element) => {
    if (seen.has(element)) return false;
    seen.add(element);
    // An aria-modal surface owns interaction while open. Background controls
    // remain in the DOM but are not legal collision constraints until close.
    if (activeModal && element !== activeModal && !activeModal.contains(element) && element.getAttribute('data-pet-safe-region') !== 'critical') return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
  }).map((element) => toRect(element.getBoundingClientRect())).filter((rect) => rect.width > 0 && rect.height > 0);
}

export function intersectsReservedRegion(rect: PetRect, reserved: PetRect[], gap = PET_SAFE_GAP_PX): boolean {
  return reserved.some((region) => rect.right + gap > region.left && rect.left - gap < region.right
    && rect.bottom + gap > region.top && rect.top - gap < region.bottom);
}

export function resolveNearestSafeDelta(rect: PetRect, viewportWidth: number, viewportHeight: number, reserved: PetRect[], gap = PET_SAFE_GAP_PX) {
  let dx = Math.max(gap - rect.left, Math.min(0, viewportWidth - gap - rect.right));
  let dy = Math.max(gap - rect.top, Math.min(0, viewportHeight - gap - rect.bottom));
  let moved = { ...rect, left: rect.left + dx, right: rect.right + dx, top: rect.top + dy, bottom: rect.bottom + dy };
  for (const region of reserved) {
    if (!intersectsReservedRegion(moved, [region], gap)) continue;
    const candidates = [
      { dx: region.left - gap - moved.right, dy: 0 }, { dx: region.right + gap - moved.left, dy: 0 },
      { dx: 0, dy: region.top - gap - moved.bottom }, { dx: 0, dy: region.bottom + gap - moved.top },
    ].filter((candidate) => moved.left + candidate.dx >= gap && moved.right + candidate.dx <= viewportWidth - gap
      && moved.top + candidate.dy >= gap && moved.bottom + candidate.dy <= viewportHeight - gap)
      .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
    if (!candidates[0]) continue;
    dx += candidates[0].dx; dy += candidates[0].dy;
    moved = { ...moved, left: moved.left + candidates[0].dx, right: moved.right + candidates[0].dx, top: moved.top + candidates[0].dy, bottom: moved.bottom + candidates[0].dy };
  }
  return { dx, dy };
}

/* ────────────────────────────────────────────────────────────────────────────
   Deterministic accepted-position resolution (Companion-C1)
   ────────────────────────────────────────────────────────────────────────────
   One policy for "where may the companion legally be", used by both the drop
   pipeline and the idle maintenance pass, so a released drop can never be
   silently rewritten by a later pass.

   Guarantees relied on by the caller:
     • Pure: the result depends only on the inputs.
     • Fixed point: `resolveAcceptedPetRect(result, ctx)` returns `result`
       unchanged for every branch, so re-running the same resolution on an
       already-accepted position performs no move and therefore no write.
     • Tiered: the strict `PET_SAFE_GAP_PX` clearance is preferred; the caller
       can see which tier was satisfied via `gap` (`null` = no legal spot).
   ──────────────────────────────────────────────────────────────────────────── */

export interface PetResolutionContext {
  /** Left edge of the companion canvas (the centred app preview frame). */
  canvasLeft: number;
  /** Width of that canvas, i.e. the horizontal travel is `canvasWidth - petSize`. */
  canvasWidth: number;
  /** Height the companion may use (visual viewport height). */
  canvasHeight: number;
  /** Space reserved at the bottom for the dock, exactly as the host renders it. */
  bottomReserve: number;
  petSize: number;
  viewportWidth: number;
  viewportHeight: number;
  reserved: PetRect[];
}

export interface PetResolutionResult { left: number; top: number; gap: number | null }

export const petMaxLeft = (context: PetResolutionContext) => Math.max(1, context.canvasWidth - context.petSize);
export const petMaxTop = (context: PetResolutionContext) => Math.max(1, context.canvasHeight - context.petSize - context.bottomReserve);

const clampLeft = (value: number, context: PetResolutionContext) =>
  Math.min(context.canvasLeft + petMaxLeft(context), Math.max(context.canvasLeft, value));
const clampTop = (value: number, context: PetResolutionContext) => Math.min(petMaxTop(context), Math.max(0, value));

const petRectAt = (left: number, top: number, context: PetResolutionContext): PetRect => ({
  left, top, right: left + context.petSize, bottom: top + context.petSize, width: context.petSize, height: context.petSize,
});

const isPetRectClear = (left: number, top: number, context: PetResolutionContext, gap: number) =>
  !intersectsReservedRegion(petRectAt(left, top, context), context.reserved, gap);

/**
 * Candidate landing spots used only when a minimal nudge cannot clear the
 * reserved regions. `requested` is always the first candidate, which is what
 * makes the resolver a fixed point when nothing else is legal.
 */
function petResolutionCandidates(requested: { left: number; top: number }, context: PetResolutionContext) {
  const maxLeft = context.canvasLeft + petMaxLeft(context);
  const maxTop = petMaxTop(context);
  const candidates: Array<{ left: number; top: number }> = [{ left: requested.left, top: requested.top }];
  for (let top = 12; top <= maxTop; top += 18) {
    candidates.push({ left: context.canvasLeft + 12, top }, { left: maxLeft - 12, top });
  }
  for (let left = context.canvasLeft + 12; left <= maxLeft; left += 18) {
    candidates.push({ left, top: 12 }, { left, top: Math.max(12, maxTop - 12) });
  }
  return candidates
    .map((candidate) => {
      const left = clampLeft(candidate.left, context);
      const top = clampTop(candidate.top, context);
      return { left, top, distance: Math.hypot(left - requested.left, top - requested.top) };
    })
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Final accepted position for a requested drop (or for the current position on
 * the idle maintenance pass). Resolution happens once, here, before anything is
 * rendered or persisted.
 */
export function resolveAcceptedPetRect(requested: { left: number; top: number }, context: PetResolutionContext): PetResolutionResult {
  const start = { left: clampLeft(requested.left, context), top: clampTop(requested.top, context) };
  const gaps = [PET_SAFE_GAP_PX, 0];
  for (const gap of gaps) if (isPetRectClear(start.left, start.top, context, gap)) return { ...start, gap };

  const delta = resolveNearestSafeDelta(petRectAt(start.left, start.top, context), context.viewportWidth, context.viewportHeight, context.reserved, PET_SAFE_GAP_PX);
  const nudged = { left: clampLeft(start.left + delta.dx, context), top: clampTop(start.top + delta.dy, context) };
  for (const gap of gaps) if (isPetRectClear(nudged.left, nudged.top, context, gap)) return { ...nudged, gap };

  const candidates = petResolutionCandidates(start, context);
  for (const gap of gaps) {
    const legal = candidates.find((candidate) => isPetRectClear(candidate.left, candidate.top, context, gap));
    if (legal) return { left: legal.left, top: legal.top, gap };
  }
  return { ...start, gap: null };
}

/**
 * Normalized projection of {@link resolveAcceptedPetRect}. Callers keep owning
 * persistence; this only decides the accepted point.
 */
export function resolveAcceptedPetPosition(
  position: { x: number; y: number },
  context: PetResolutionContext,
): { x: number; y: number; gap: number | null; relocated: boolean } {
  const maxLeft = petMaxLeft(context);
  const maxTop = petMaxTop(context);
  const requested = { left: context.canvasLeft + position.x * maxLeft, top: position.y * maxTop };
  const accepted = resolveAcceptedPetRect(requested, context);
  return {
    x: Math.min(1, Math.max(0, (accepted.left - context.canvasLeft) / maxLeft)),
    y: Math.min(1, Math.max(0, accepted.top / maxTop)),
    gap: accepted.gap,
    relocated: Math.abs(accepted.left - requested.left) > .0001 || Math.abs(accepted.top - requested.top) > .0001,
  };
}
