export const MOON_GATE_CONFIRMATION_PHRASE = '清除 Rune';

export function isMoonGateConfirmationMatch(value: string): boolean {
  return value.trim() === MOON_GATE_CONFIRMATION_PHRASE;
}

export function resetMoonGateRecoveryDraft() {
  return { dangerOpen: false, finalConfirmOpen: false, confirmText: '', error: '' } as const;
}

export function createMoonGateDestructiveActionGuard() {
  let inFlight = false;
  return async (action: () => Promise<void>): Promise<boolean> => {
    if (inFlight) return false;
    inFlight = true;
    try {
      await action();
      return true;
    } catch (error) {
      inFlight = false;
      throw error;
    }
  };
}
