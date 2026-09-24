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
