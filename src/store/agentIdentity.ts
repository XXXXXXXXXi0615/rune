import type { PartnerData } from '@/types';

/**
 * Canonical Agent Identity domain — Phase 1 (single agent).
 *
 * UI terminology:  智能體
 * Code terminology: Agent
 *
 * Persistence carrier: `useAppStore.partner` (unchanged persisted field,
 * zero data loss). Phase 1 adds an id seam (`DEFAULT_AGENT_ID`) so a
 * future multi-agent manager can key profiles without a second store.
 *
 * CLAWD boundary: pet size / drag / idle planner / reaction / clock perch
 * belong to the pet presentation layer — never to this identity domain.
 */

export type AgentId = string;

/** Stable id of the single current agent (future multi-agent seam). */
export const DEFAULT_AGENT_ID: AgentId = 'agent-default';

/** Internal system identity name. Replaces the fixed "LUNARIS" hardcode. */
export const SYSTEM_AGENT_NAME = 'agent' as const;

/** Default user-facing display name for a fresh generic agent. */
export const AGENT_DEFAULT_DISPLAY_NAME = '智能體' as const;

/** Deterministic monogram for the avatar fallback (no asset dependency). */
export const AGENT_DEFAULT_AVATAR_INITIAL = '智' as const;

/**
 * Legacy fixed identity name. Kept ONLY to detect persisted records that
 * still carry the untouched pre-decoupling default.
 */
export const LEGACY_LUNARIS_SYSTEM_NAME = 'LUNARIS' as const;

/** Canonical read model over the persisted partner record. */
export interface AgentProfile {
  id: AgentId;
  /** Internal system identity (never user-facing by itself). */
  name: string;
  /** User-facing display name (1–24 chars, trimmed). */
  displayName: string;
  status: string;
  bio?: string;
  personalityNote?: string;
  avatarInitial: string;
  avatarColor: string;
  avatarImage?: PartnerData['avatarImage'];
  characterVoice?: PartnerData['characterVoice'];
}

/**
 * True when the persisted partner record still equals the untouched
 * pre-decoupling LUNARIS default (no user customization at all).
 *
 * Detection keys:
 *  - system identity name is "LUNARIS"
 *  - display name is empty or still the fixed "LUNARIS"
 *  - no custom avatar image
 *  - no personality note
 */
export function isUntouchedLegacyLunarisIdentity(
  partner?: Partial<PartnerData> | null,
): boolean {
  if (!partner) return false;
  const name = (partner.name ?? '').trim();
  if (!name || name.toUpperCase() !== LEGACY_LUNARIS_SYSTEM_NAME) return false;
  const displayName = (partner.displayName ?? '').trim();
  if (displayName && displayName.toUpperCase() !== LEGACY_LUNARIS_SYSTEM_NAME) return false;
  if (partner.avatarImage) return false;
  if (partner.personalityNote && partner.personalityNote.trim()) return false;
  return true;
}

/**
 * Idempotent, reload-safe legacy migration.
 *
 * - Untouched LUNARIS default  → generic Agent identity (智能體).
 * - User-customized identity   → display name / avatar / persona are all
 *   preserved untouched. A user-named "LUNARIS" is user data and survives.
 *
 * The `id` field is the migration marker: records carrying an id are never
 * re-migrated, so a custom name can never be silently reset to 智能體.
 */
export function migratePartnerToAgent<T extends Partial<PartnerData>>(partner: T): T {
  if (!partner) return partner;
  if ((partner as Partial<PartnerData> & { id?: string }).id) return partner;

  const untouched = isUntouchedLegacyLunarisIdentity(partner);
  const next: T & { id: AgentId } = { ...(partner as object), id: DEFAULT_AGENT_ID } as T & { id: AgentId };

  if (untouched) {
    next.name = SYSTEM_AGENT_NAME as T['name'];
    next.displayName = AGENT_DEFAULT_DISPLAY_NAME as T['displayName'];
    next.avatarInitial = AGENT_DEFAULT_AVATAR_INITIAL as T['avatarInitial'];
    if ('bio' in next) (next as { bio?: string }).bio = undefined;
    return next;
  }

  // Customized identity: keep every user field; only ensure a system name.
  if (!(next as { name?: string }).name) {
    (next as { name: string }).name = SYSTEM_AGENT_NAME;
  }
  return next;
}
