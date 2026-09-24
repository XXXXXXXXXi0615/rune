import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import type { AnchoredPopoverPosition } from '@/hooks/useAnchoredPopover';

/**
 * Calendar C3 — the shared portalled popover surface.
 *
 * The Countdown ⋯ menu, the Countdown delete confirmation and the Canvas sticker
 * picker all render through this: a `document.body` portal with `position: fixed`,
 * placed by `useAnchoredPopover`.
 *
 * Leaving the clipping subtree is the whole point. The Day Inspector scroller
 * (`overflow-y: auto`) cut 169px off the bottom of the ⋯ menu, and the Canvas Quick
 * Float (`overflow: hidden` plus `backdrop-filter`, which makes it the containing
 * block for fixed descendants) cut 53px off the sticker picker and clipped the
 * photo viewer to the panel instead of the viewport.
 *
 * Hidden until the hook reports a real measurement, so nothing ever paints at the
 * origin for a frame.
 */
export function AnchoredPopoverSurface({
  popoverRef,
  position,
  className,
  children,
  ...rest
}: {
  popoverRef: RefObject<HTMLDivElement | null>;
  position: AnchoredPopoverPosition;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return createPortal(
    <div
      ref={popoverRef}
      className={className}
      data-placement={position.placement}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        visibility: position.ready ? 'visible' : 'hidden',
      }}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}
