import { BUILTIN_LUNARIS_ID } from '@/store/useCharacterStore';
import { resolveCharacterDisplayName } from '@/features/characters/legacyCharacterBranding';
import type { Conversation } from '@/types';

export interface DirectChatCounterpartSource {
  id: string;
  name?: string;
}

/**
 * Canonical Direct Chat Header identity: the counterpart only.
 * Precedence: counterpart.displayName → counterpart.id → character/persona name.
 * The local user identity is never part of this resolution.
 */
export function resolveDirectChatCounterpartTitle(
  conversation: Pick<Conversation, 'characterIds'> | null | undefined,
  characters: readonly DirectChatCounterpartSource[],
  personaName?: string | null,
): string {
  const counterpart =
    characters.find((item) => item.id === conversation?.characterIds?.[0]) ||
    characters.find((item) => item.id === BUILTIN_LUNARIS_ID);
  const name = counterpart?.name?.trim();
  if (name) return resolveCharacterDisplayName(counterpart?.id, name);
  const id = counterpart?.id?.trim();
  if (id) return resolveCharacterDisplayName(id, id);
  return resolveCharacterDisplayName(undefined, personaName?.trim() || undefined);
}
