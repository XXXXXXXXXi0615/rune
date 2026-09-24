import type { ReactNode } from 'react';
import { useGlobalOverlaysReady } from './BootOverlayCoordinator';

export function ReadyGate({ children }: { children: ReactNode }) {
  const ready = useGlobalOverlaysReady();
  if (!ready) return null;
  return <>{children}</>;
}
