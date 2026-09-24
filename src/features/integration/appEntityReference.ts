export type AppEntitySource = 'chat' | 'calendar' | 'quests' | 'life-ledger' | 'diet' | 'objects';
export const LIFE_LEDGER_CHANGED_EVENT = 'lunartide:life-ledger-changed';

/** Cross-App links carry identity only; business payload remains with its canonical owner. */
export interface AppEntityReference {
  sourceApp: AppEntitySource;
  entityType: string;
  entityId: string;
  date?: string;
}

export type ChatActionTarget = 'calendar' | 'quests' | 'life-ledger' | 'objects';

export interface ChatActionCandidate {
  sourceMessageId: string;
  target: ChatActionTarget;
  label: string;
  requiresConfirmation: true;
  suggestedDate?: string;
}

export function createChatActionCandidate(input: Omit<ChatActionCandidate, 'requiresConfirmation'>): ChatActionCandidate {
  return { ...input, requiresConfirmation: true };
}
