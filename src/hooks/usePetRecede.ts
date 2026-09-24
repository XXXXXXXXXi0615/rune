import { useEffect } from 'react';

let recedeCount = 0;

/**
 * While active, marks the document so the desktop pet recedes
 * (drops opacity / ignores pointer events) behind modals and editors.
 * Reference-counted so overlapping modals behave correctly.
 */
export function usePetRecede(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    recedeCount += 1;
    document.body.classList.add('pet-recede');
    return () => {
      recedeCount = Math.max(0, recedeCount - 1);
      if (recedeCount === 0) document.body.classList.remove('pet-recede');
    };
  }, [active]);
}
