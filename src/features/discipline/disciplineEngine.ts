import type { FocusSessionStatus } from '@/store/useFocusSessionStore';
import type { ToiletWarningLevel } from '@/store/useToiletRiskStore';

export interface DisciplineSummary {
  hydrationMl: number;
  hydrationTargetMl: number;
  toiletWarningLevel: ToiletWarningLevel;
  toiletActive: boolean;
  focusStatus: FocusSessionStatus;
  mainlineSummary: string;
}

export interface DisciplineCopy {
  title: string;
  message: string;
  source: 'rule_engine' | 'ai_generated';
}

/** This is the complete, privacy-bounded payload allowed to reach a future model adapter. */
export const buildDisciplineModelContext = (summary: DisciplineSummary) => ({
  hydration: { totalMl: summary.hydrationMl, targetMl: summary.hydrationTargetMl },
  toilet: { active: summary.toiletActive, warningLevel: summary.toiletWarningLevel },
  focus: { status: summary.focusStatus },
  mainlineSummary: summary.mainlineSummary.slice(0, 160),
});

export function getRuleDisciplineCopy(summary: DisciplineSummary): DisciplineCopy {
  if (summary.toiletWarningLevel >= 2) return { title: '身體不是可延期的支線', message: '現在去廁所。主線可以暫停，身體警訊不接受討價還價。', source: 'rule_engine' };
  if (summary.toiletActive) return { title: '我看見你在拖', message: '把目前這一步收尾就去，不准用「再一下」無限續杯。', source: 'rule_engine' };
  const ratio = summary.hydrationTargetMl > 0 ? summary.hydrationMl / summary.hydrationTargetMl : 0;
  if (ratio < 0.25) return { title: '潮位太低', message: '先喝 250 ml，再回主線。照顧身體不是偏航，是維持航行。', source: 'rule_engine' };
  if (summary.focusStatus === 'running') return { title: '守住這一輪', message: `你正在推進「${summary.mainlineSummary || '今日主線'}」。水放手邊，別讓專注變成忽略身體。`, source: 'rule_engine' };
  return { title: '選一件真正要完成的事', message: `今天已喝 ${summary.hydrationMl} ml。整理好下一步，然後開一輪乾淨的 TIDEBOUND。`, source: 'rule_engine' };
}
