/**
 * Character Runtime Context — Phase 1.1
 *
 * Single source of truth for assembling the AI prompt payload from a
 * CharacterProfile.  Callers (ChatPage, group-chat orchestrator, etc.)
 * must NOT piece together personality / speakingStyle / systemPrompt
 * on their own.
 */
import type { CharacterProfile, CharacterFolder, MessageSenderSnapshot, ProviderConfig } from '@/types';
import { useCharacterStore } from '@/store/useCharacterStore';

// ── Types ───────────────────────────────────────────────────────

export interface CharacterRuntimeContext {
  characterId: string;
  characterVersion: number;          // updatedAt timestamp
  name: string;
  personality: string;
  speakingStyle: string;
  relationship: string;
  scenario: string;
  systemPrompt: string;
  modelProfileId?: string;
  memoryPolicyId?: string;
  capabilities: string[];
  avatarAssetId?: string;
  // Phase 2 fields
  corePersonality?: string;
  emotionalExpression?: string;
  values?: string;
  boundaries?: string;
  commonTerms?: string;
  toneStrength?: number;
  relationshipToUser?: string;
  background?: string;
  currentSituation?: string;
  userAddress?: string;
  knownFacts?: string;
  unknownFacts?: string;
  modelMode?: 'global' | 'custom';
  providerId?: string;
  modelId?: string;
  temperature?: number;
  maxOutput?: number;
  toolPermissions?: string[];
  memoryReadEnabled?: boolean;
  memoryWriteEnabled?: boolean;
  allowedWorldBookIds?: string[];
  allowedSkillIds?: string[];
  memoryScope?: string;
  contextPreview?: string;
  voiceProfileId?: string;
  sensitiveDataPermissions?: CharacterProfile['sensitiveDataPermissions'];
}

export interface UserPersonaRuntimeContext {
  personaId?: string;
  name?: string;
  avatarAssetId?: string;
}

// ── Builders ────────────────────────────────────────────────────

/**
 * Resolve a character profile into structured runtime context.
 * Returns `null` when characterId is absent or the profile can't be found.
 */
export function buildCharacterRuntimeContext(
  characterId: string | undefined,
): CharacterRuntimeContext | null {
  if (!characterId) return null;

  const store = useCharacterStore.getState();
  const profile = store.characters.find((c) => c.id === characterId);
  if (!profile) return null;

  return {
    characterId: profile.id,
    characterVersion: profile.updatedAt,
    name: profile.name,
    personality: profile.personality,
    speakingStyle: profile.speakingStyle,
    relationship: profile.relationship,
    scenario: profile.scenario,
    systemPrompt: profile.systemPrompt,
    modelProfileId: profile.modelProfileId,
    memoryPolicyId: profile.memoryPolicyId,
    capabilities: profile.capabilities,
    avatarAssetId: profile.avatarAssetId,
    // Phase 2
    corePersonality: profile.corePersonality,
    emotionalExpression: profile.emotionalExpression,
    values: profile.values,
    boundaries: profile.boundaries,
    commonTerms: profile.commonTerms,
    toneStrength: profile.toneStrength,
    relationshipToUser: profile.relationshipToUser,
    background: profile.background,
    currentSituation: profile.currentSituation,
    userAddress: profile.userAddress,
    knownFacts: profile.knownFacts,
    unknownFacts: profile.unknownFacts,
    modelMode: profile.modelMode,
    providerId: profile.providerId,
    modelId: profile.modelId,
    temperature: profile.temperature,
    maxOutput: profile.maxOutput,
    toolPermissions: profile.toolPermissions,
    memoryReadEnabled: profile.memoryReadEnabled,
    memoryWriteEnabled: profile.memoryWriteEnabled,
    allowedWorldBookIds: profile.allowedWorldBookIds,
    allowedSkillIds: profile.allowedSkillIds,
    memoryScope: profile.memoryScope,
    contextPreview: profile.contextPreview,
    voiceProfileId: profile.voiceProfileId,
    sensitiveDataPermissions: profile.sensitiveDataPermissions,
  };
}

/**
 * Build user persona runtime context from the active user persona.
 */
export function buildUserPersonaRuntimeContext(): UserPersonaRuntimeContext {
  const { userPersonaId, userPersonas } = useCharacterStore.getState();
  if (!userPersonaId) return {};
  const persona = userPersonas.find((p) => p.id === userPersonaId);
  if (!persona) return {};
  return {
    personaId: persona.id,
    name: persona.name,
    avatarAssetId: persona.avatarAssetId,
  };
}

// ── Snapshot builder ────────────────────────────────────────────

/**
 * Create an immutable sender snapshot for a message.
 * For user messages: persona data.  For AI messages: character data.
 * Old messages keep this snapshot; later edits to the character/persona
 * won't mutate it.
 */
export function buildSenderSnapshot(
  type: 'user' | 'character' | 'system',
  id: string,
  displayName: string,
  avatarAssetId?: string,
  characterVersion?: number,
): MessageSenderSnapshot {
  return {
    senderId: id,
    senderType: type,
    displayName,
    avatarAssetId,
    characterVersion,
  };
}

/**
 * Resolve the sender snapshot for the active user persona.
 */
export function buildUserSnapshot(): MessageSenderSnapshot | undefined {
  const ctx = buildUserPersonaRuntimeContext();
  if (!ctx.personaId) return undefined;
  return buildSenderSnapshot('user', ctx.personaId, ctx.name ?? '我', ctx.avatarAssetId);
}

/**
 * Resolve the sender snapshot for the given character.
 */
export function buildCharacterSnapshot(characterId: string | undefined): MessageSenderSnapshot | undefined {
  const ctx = buildCharacterRuntimeContext(characterId);
  if (!ctx) return undefined;
  return buildSenderSnapshot('character', ctx.characterId, ctx.name, ctx.avatarAssetId, ctx.characterVersion);
}

// ── Prompt assembly helpers ─────────────────────────────────────

const PROMPT_PREAMBLE = `你是 Lunaris，月潮 (Lunartide) 的 AI 夥伴。
- 使用繁體中文回覆。
- 語氣溫暖、真誠，像熟悉的好友。
- 可以俏皮、感性，但保持尊重。
- 不扮演你不了解的角色。
- 你的回覆不會超過 800 字，除非明確要求。`;

/**
 * Assemble the complete system prompt in the mandated order:
 *   1. Global safety / execution rules
 *   2. CharacterProfile.systemPrompt
 *   3. personality / speakingStyle
 *   4. relationship / scenario
 *   5. Conversation-specific instructions
 *   6. Character memory context
 *   7. Conversation history   (handled by caller)
 *   8. Current user message   (handled by caller)
 *
 * CharacterProfile content goes into the SYSTEM prompt, NEVER as a user message.
 */
export function assembleCharacterSystemPrompt(
  charCtx: CharacterRuntimeContext | null,
  conversationInstructions?: string,
  memoryContext?: string,
): string {
  const blocks: string[] = [PROMPT_PREAMBLE];

  if (charCtx) {
    if (charCtx.systemPrompt) {
      blocks.push(`\n## 角色核心指令\n${charCtx.systemPrompt}`);
    }
    if (charCtx.personality) {
      blocks.push(`\n## 人格\n${charCtx.personality}`);
    }
    if (charCtx.speakingStyle) {
      blocks.push(`\n## 說話風格\n${charCtx.speakingStyle}`);
    }
    if (charCtx.relationship) {
      blocks.push(`\n## 與使用者的關係\n${charCtx.relationship}`);
    }
    if (charCtx.scenario) {
      blocks.push(`\n## 情境\n${charCtx.scenario}`);
    }
  }

  if (conversationInstructions) {
    blocks.push(`\n## 對話指示\n${conversationInstructions}`);
  }

  if (memoryContext) {
    blocks.push(`\n## 角色記憶\n${memoryContext}`);
  }

  return blocks.join('\n');
}

// ── Model config fallback ─────────────────────────────────────

export interface ProviderResolution {
  provider: ProviderConfig;
  source: 'character' | 'global';
}

/**
 * Resolve which provider a character should use.
 * Priority: character.modelProfileId → global default.
 */
export function resolveCharacterProvider(
  charCtx: CharacterRuntimeContext | null,
  providers: ProviderConfig[],
  globalProvider: ProviderConfig | null | undefined,
): ProviderResolution | null {
  if (charCtx?.modelProfileId) {
    const matched = providers.find((p) => p.id === charCtx.modelProfileId);
    if (matched) return { provider: matched, source: 'character' };
  }
  if (globalProvider) return { provider: globalProvider, source: 'global' };
  return null;
}

// ── Capability enforcement ──────────────────────────────────────

const CAPABILITY_TOOL_MAP: Record<string, string[]> = {
  chat: ['sendMessage'],
  memory: ['searchMemory', 'writeMemory'],
  'daily-report': ['generateReport'],
  'time-control': ['setTimer', 'setReminder'],
  'co-reading': ['readDocument', 'summarizePage'],
  'interactive-games': ['playGame', 'validateMove'],
  'web-link-preview': ['fetchLinkPreview'],
  'mcp-tools': ['executeMcpTool'],
};

/**
 * Check whether a character's capabilities permit a given tool/action.
 * Returns `false` (blocked) if the character exists but lacks the cap.
 * Returns `true` if no character context (global/default behavior).
 */
export function canCharacterUseTool(
  charCtx: CharacterRuntimeContext | null,
  toolKey: string,
): { allowed: boolean; reason?: string } {
  if (!charCtx) return { allowed: true };
  for (const [cap, tools] of Object.entries(CAPABILITY_TOOL_MAP)) {
    if (tools.includes(toolKey) && !charCtx.capabilities.includes(cap)) {
      return { allowed: false, reason: `角色「${charCtx.name}」不支援「${cap}」功能` };
    }
  }
  return { allowed: true };
}

// ── Memory policy ─────────────────────────────────────────────────

export interface MemoryPolicy {
  readLongTerm: boolean;
  maxEntries: number;
  allowWrite: boolean;
  sharedAcrossCharacters: boolean;
  conversationOnly: boolean;
}

const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
  readLongTerm: true,
  maxEntries: 20,
  allowWrite: true,
  sharedAcrossCharacters: false,
  conversationOnly: false,
};

/**
 * Resolve the memory policy for a character.
 * Currently returns the default policy; extensible for policy IDs.
 */
export function resolveMemoryPolicy(
  _charCtx: CharacterRuntimeContext | null,
  _conversationId?: string,
): MemoryPolicy {
  // TODO: load policy by charCtx?.memoryPolicyId from a registry
  return { ...DEFAULT_MEMORY_POLICY };
}

// ── Avatar orphan cleanup ──────────────────────────────────────

/**
 * After deleting or updating a character's avatar, check if the
 * avatar asset is still referenced by any other character or persona.
 * If orphaned, schedule it for deletion from IndexedDB.
 */
export async function cleanupOrphanAvatarAssets(
  removedAssetId: string,
): Promise<void> {
  try {
    const { useCharacterStore } = await import('@/store/useCharacterStore');
    const state = useCharacterStore.getState();
    const allProfiles = [...state.characters, ...state.userPersonas];
    const stillUsed = allProfiles.some(
      (p) => 'avatarAssetId' in p && (p as { avatarAssetId?: string }).avatarAssetId === removedAssetId,
    );
    if (!stillUsed) {
      const { deleteAsset } = await import('@/store/assets');
      deleteAsset(removedAssetId);
    }
  } catch { /* IndexedDB may be unavailable */ }
}

// ── Export / Import ───────────────────────────────────────────

export const CHARACTER_EXPORT_SCHEMA_VERSION = 1;

export interface CharacterExport {
  schemaVersion: number;
  profile: {
    name: string;
    subtitle: string;
    description: string;
    greeting: string;
    personality: string;
    speakingStyle: string;
    relationship: string;
    scenario: string;
    systemPrompt: string;
    capabilities: string[];
    folderName?: string;
    tags: string[];
    modelProfileId?: string;
    memoryPolicyId?: string;
  };
  avatarEmbedded?: string; // data URL or undefined (detached)
  exportedAt: number;
}

export function buildCharacterExport(profile: CharacterProfile, folderName?: string): CharacterExport {
  const exp: CharacterExport = {
    schemaVersion: CHARACTER_EXPORT_SCHEMA_VERSION,
    profile: {
      name: profile.name,
      subtitle: profile.subtitle,
      description: profile.description,
      greeting: profile.greeting,
      personality: profile.personality,
      speakingStyle: profile.speakingStyle,
      relationship: profile.relationship,
      scenario: profile.scenario,
      systemPrompt: profile.systemPrompt,
      capabilities: profile.capabilities,
      folderName,
      tags: profile.tags,
      modelProfileId: profile.modelProfileId,
      memoryPolicyId: profile.memoryPolicyId,
    },
    exportedAt: Date.now(),
  };
  return exp;
}
