import { useEffect, useState } from 'react';
import {
  LUNARIS_PET_MODE_EVENT,
  LUNARIS_PET_MODE_KEY,
  MODE_TO_STATE,
  loadLunarisPetMode,
  type LunarisPetMode,
  type LunarisPetState,
} from '@/config/lunarisPetStates';

export function useLunarisPetMode(): LunarisPetMode {
  const [mode, setMode] = useState<LunarisPetMode>(loadLunarisPetMode);

  useEffect(() => {
    const handleModeChange = (event: Event) => {
      setMode((event as CustomEvent<LunarisPetMode>).detail);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LUNARIS_PET_MODE_KEY) setMode(loadLunarisPetMode());
    };
    window.addEventListener(LUNARIS_PET_MODE_EVENT, handleModeChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(LUNARIS_PET_MODE_EVENT, handleModeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return mode;
}

export function useResolvedLunarisPetState(autoState: LunarisPetState): LunarisPetState {
  const mode = useLunarisPetMode();
  if (mode === 'auto') return autoState;
  return MODE_TO_STATE[mode] ?? autoState;
}
