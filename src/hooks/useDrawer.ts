import { useDrawerStore } from '@/store/useDrawerStore';
import type { DrawerId } from '@/types';

export function useDrawer(drawerId: DrawerId) {
  const activeDrawer = useDrawerStore((s) => s.activeDrawer);
  const openDrawer = useDrawerStore((s) => s.openDrawer);
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);

  return {
    isOpen: activeDrawer === drawerId,
    open: () => openDrawer(drawerId),
    close: closeDrawer,
  };
}
