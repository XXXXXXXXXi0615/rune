import type { Quest } from '@/store/useQuestStore';
import type { ReviewRecord } from './types';

export interface QuestTransitionPort {
  updateQuest: (id: string, patch: Partial<Quest>) => void;
  abandonQuest: (id: string) => void;
}

export function applyApprovedReviewTransition(record: ReviewRecord, quest: Quest, port: QuestTransitionPort, now = new Date()): boolean {
  if (record.decision.decision === 'rejected') return false;
  if (record.decision.decision === 'conditional' && !record.conditionsAcceptedAt) return false;
  if (record.requestType === 'abandon') { port.abandonQuest(quest.id); return true; }
  if (record.requestType === 'reduce') { port.updateQuest(quest.id, { estimatedMinutes: Math.max(5, Math.round((quest.estimatedMinutes || 25) * .75)) }); return true; }
  if (record.requestType === 'pause') { port.updateQuest(quest.id, { status: 'claimed', startedAt: undefined }); return true; }
  const requested = record.resumeAtSnapshot ? new Date(record.resumeAtSnapshot) : new Date(now.getTime() + (record.requestType === 'extend' ? 60 : 30) * 60_000);
  const dueAt = quest.dueAt && Date.parse(quest.dueAt) > requested.getTime() && record.requestType === 'defer' ? quest.dueAt : requested.toISOString();
  port.updateQuest(quest.id, { dueAt });
  return true;
}
