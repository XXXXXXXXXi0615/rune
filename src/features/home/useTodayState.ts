import { useMemo, useState, useEffect } from 'react';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useHydrationStore } from '@/store/useHydrationStore';
import { useQuestStore } from '@/store/useQuestStore';
import { selectMoonLexPracticePool, useMoonLexStore } from '@/store/useMoonLexStore';
import { useFocusCareerStore } from '@/store/useFocusCareerStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useModulePreferencesStore } from '@/features/navigation/modulePreferences';
import { getCycleSnapshot } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import { useNow } from '@/hooks/useNow';
import { deriveTodayState } from './todayState';

export function useTodayState() {
  const now = useNow('minute');
  const checkinRecords = useCheckInStore((state) => state.records);
  const hydrationEntries = useHydrationStore((state) => state.entries);
  const hydrationGoalMl = useHydrationStore((state) => state.settings.dailyGoalMl);
  const quests = useQuestStore((state) => state.quests);
  const mainQuestByDate = useQuestStore((state) => state.mainQuestByDate);
  const moonlexEntries = useMoonLexStore((state) => state.entries);
  const moonlexPracticeRecords = useMoonLexStore((state) => state.practiceRecords);
  const moonlexLanguageFilter = useMoonLexStore((state) => state.languageFilter);
  const moonlexPracticeDifficulty = useMoonLexStore((state) => state.practiceDifficulty);
  const focusedSecondsByDate = useFocusCareerStore((state) => state.dailyFocusSeconds);
  const focusStatus = useFocusSessionStore((state) => state.status);
  const hiddenModules = useModulePreferencesStore((state) => state.hiddenIds);
  const [periodVersion, setPeriodVersion] = useState(0);
  useEffect(() => { const update = () => setPeriodVersion((value) => value + 1); window.addEventListener('period-records-updated', update); return () => window.removeEventListener('period-records-updated', update); }, []);

  return useMemo(() => {
    const cycle = getCycleSnapshot();
    const periodLabel = (cycle.cycleDay ?? 0) > 0 ? `${getCyclePhaseLabel(cycle.status)} · 第 ${cycle.cycleDay} 天` : undefined;
    return deriveTodayState({
      now, checkinRecords, hydrationEntries, hydrationGoalMl, quests, mainQuestByDate,
      moonlexPracticePool: selectMoonLexPracticePool({
        entries: moonlexEntries,
        practiceRecords: moonlexPracticeRecords,
        languageFilter: moonlexLanguageFilter,
        practiceDifficulty: moonlexPracticeDifficulty,
      }).slice(0, 5),
      moonlexPracticeRecords, focusedSecondsByDate,
      focusActive: focusStatus === 'running' || focusStatus === 'paused',
      availability: {
        moonlex: !hiddenModules.includes('moonlex'),
        period: true,
      },
      periodLabel,
    });
  }, [now, checkinRecords, hydrationEntries, hydrationGoalMl, quests, mainQuestByDate, moonlexEntries, moonlexPracticeRecords, moonlexLanguageFilter, moonlexPracticeDifficulty, focusedSecondsByDate, focusStatus, hiddenModules, periodVersion]);
}
