import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Calendar C3 — anchored popover positioning.
 *
 * The Calendar's surfaces (the Day Inspector panel, the Canvas Quick Float) both
 * live inside scroll/overflow containers, and the app frame itself (`#app`) is
 * `overflow: hidden`. Anything rendered as a descendant of those containers is
 * therefore clipped. Callers render their popover through `createPortal` into
 * `document.body` (the established repo convention) and use this hook to place
 * it against the trigger.
 *
 * The hook is presentation only: it measures the anchor and the popover, flips
 * above the trigger when there is not enough room below, and clamps the result
 * inside the viewport so a popover can never extend invisibly off-screen. It
 * owns no state beyond the computed position and never mutates app data.
 *
 * Callers must keep the popover `position: fixed` and hide it until
 * `position.ready` is true so it never paints at the origin for a frame.
 */

const VIEWPORT_MARGIN = 8;

export type PopoverPlacement = 'below' | 'above';

export interface AnchoredPopoverPosition {
  top: number;
  left: number;
  placement: PopoverPlacement;
  /** True once a real measurement has been applied; hide until then. */
  ready: boolean;
}

const INITIAL_POSITION: AnchoredPopoverPosition = { top: 0, left: 0, placement: 'below', ready: false };

export interface UseAnchoredPopoverOptions {
  /** Whether the popover is currently mounted. */
  open: boolean;
  /** The trigger the popover is anchored to. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Distance between the trigger and the popover. */
  gap?: number;
  /**
   * `start` aligns the popover's left edge to the trigger's left edge;
   * `end` aligns its right edge to the trigger's right edge (⋯ menus).
   */
  align?: 'start' | 'end';
  /** Called when Escape is pressed while open. */
  onRequestClose?: () => void;
}

export function useAnchoredPopover({
  open,
  anchorRef,
  gap = 8,
  align = 'start',
  onRequestClose,
}: UseAnchoredPopoverOptions) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<AnchoredPopoverPosition>(INITIAL_POSITION);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const node = popoverRef.current;
    if (!anchor || !node) return;

    const anchorRect = anchor.getBoundingClientRect();
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Vertical: prefer below the trigger; flip above when below would overflow
    // and there is genuinely room above.
    const belowTop = anchorRect.bottom + gap;
    const aboveTop = anchorRect.top - gap - height;
    const fitsBelow = belowTop + height <= viewportHeight - VIEWPORT_MARGIN;
    const fitsAbove = aboveTop >= VIEWPORT_MARGIN;
    const placement: PopoverPlacement = fitsBelow || !fitsAbove ? 'below' : 'above';
    const preferredTop = placement === 'below' ? belowTop : aboveTop;
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN);
    const top = Math.min(Math.max(preferredTop, VIEWPORT_MARGIN), maxTop);

    // Horizontal: align to the trigger, then clamp inside the viewport.
    const preferredLeft = align === 'end' ? anchorRect.right - width : anchorRect.left;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
    const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);

    setPosition((prev) => (
      prev.ready && prev.top === top && prev.left === left && prev.placement === placement
        ? prev
        : { top, left, placement, ready: true }
    ));
  }, [anchorRef, gap, align]);

  useLayoutEffect(() => {
    if (!open) return;
    // No reset on close: callers only render the popover while it is open, and
    // this layout effect runs before paint, so a stale position from a previous
    // open cycle is never painted.
    place();
    // Second pass once the popover's real box is known (fonts / images / wrapping).
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => place();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open || !onRequestClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onRequestClose]);

  return { popoverRef, position };
}
