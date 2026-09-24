import { useEffect } from 'react';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useTideRailStore } from '@/store/useTideRailStore';

/**
 * Syncs focus session closures into the TideRail store.
 * This is a non-UI hook that replaces the TideRailHost's
 * subscription logic after the orb UI was retired.
 */
export function useTideRailSync() {
  useEffect(() => {
    const capture = (state: ReturnType<typeof useFocusSessionStore.getState>) => {
      const settlement = state.lastSettlement;
      if (!settlement?.sessionId) return;
      useTideRailStore.getState().recordSessionClosure({
        sessionId: settlement.sessionId,
        outcome: settlement.outcome,
        sessionTask: state.task,
      });
    };
    capture(useFocusSessionStore.getState());
    return useFocusSessionStore.subscribe((state, previous) => {
      if (state.lastSettlement?.sessionId !== previous.lastSettlement?.sessionId) capture(state);
    });
  }, []);
}
