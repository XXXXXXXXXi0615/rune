import type { CompanionMood, CompanionState } from '@/types';

export interface RunePostReplySnapshot {
  messageId: string;
  mood: CompanionMood;
  statusText: string;
  shownAt: number;
}

const MOOD_LABELS: Record<CompanionMood, string> = {
  idle: '平靜', curious: '有點好奇', happy: '心情不錯', focused: '很專注',
  concerned: '有點在意', sleepy: '有點累', annoyed: '有點不耐煩',
  protective: '想護著你', quiet: '安靜陪著你',
};

export function companionMoodLabel(mood: CompanionMood): string {
  return MOOD_LABELS[mood];
}

export function createRunePostReplySnapshot(
  messageId: string,
  state: Pick<CompanionState, 'mood' | 'statusText'>,
  shownAt = Date.now(),
): RunePostReplySnapshot {
  return { messageId, mood: state.mood, statusText: state.statusText.trim(), shownAt };
}
