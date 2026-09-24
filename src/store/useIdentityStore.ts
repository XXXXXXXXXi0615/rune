import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatIdentity, AvatarVariant, Conversation } from '@/types';
import { AGENT_DEFAULT_DISPLAY_NAME } from '@/store/agentIdentity';
import { LEGACY_PRESET_IDS, referencedLegacyPresetIds } from '@/features/groupChat/identityLibrary';

export function normalizeIdentityHandle(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'user';
}

function migrateHandles(identities: ChatIdentity[]): ChatIdentity[] {
  const used = new Set<string>();
  return identities.map((identity) => {
    const base = normalizeIdentityHandle(identity.handle || identity.mentionAliases[0] || identity.displayName);
    let handle = base;
    let suffix = 2;
    while (used.has(handle)) handle = `${base}_${suffix++}`;
    used.add(handle);
    return identity.handle === handle ? identity : { ...identity, handle, updatedAt: identity.updatedAt || Date.now() };
  });
}

interface IdentityState {
  identities: ChatIdentity[];
  addIdentity: (identity: ChatIdentity) => void;
  updateIdentity: (id: string, patch: Partial<ChatIdentity>) => void;
  archiveIdentity: (id: string) => void;
  deleteIdentity: (id: string) => void;
  getIdentity: (id: string) => ChatIdentity | undefined;
  addAvatarVariant: (identityId: string, variant: AvatarVariant) => void;
  updateAvatarVariant: (identityId: string, variantId: string, patch: Partial<AvatarVariant>) => void;
  removeAvatarVariant: (identityId: string, variantId: string) => void;
  setDefaultAvatarVariant: (identityId: string, variantId: string) => void;
  /** Create default identities (lunaris/clawd/mira) if missing. Returns number created. */
  migrateLegacyIdentities: (partnerName: string) => number;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      identities: [],

      addIdentity: (identity) =>
        set((state) => ({ identities: migrateHandles([...state.identities, identity]) })),

      updateIdentity: (id, patch) =>
        set((state) => ({
          identities: migrateHandles(state.identities.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i
          )),
        })),

      archiveIdentity: (id) =>
        set((state) => ({
          identities: state.identities.map((i) =>
            i.id === id ? { ...i, archived: true, updatedAt: Date.now() } : i
          ),
        })),

      deleteIdentity: (id) =>
        set((state) => ({
          identities: state.identities.filter((i) => i.id !== id),
        })),

      getIdentity: (id) => get().identities.find((i) => i.id === id),

      addAvatarVariant: (identityId, variant) =>
        set((state) => ({
          identities: state.identities.map((i) =>
            i.id === identityId
              ? { ...i, avatarVariants: [...i.avatarVariants, variant], updatedAt: Date.now() }
              : i
          ),
        })),

      updateAvatarVariant: (identityId, variantId, patch) =>
        set((state) => ({
          identities: state.identities.map((i) =>
            i.id === identityId
              ? {
                  ...i,
                  avatarVariants: i.avatarVariants.map((v) =>
                    v.id === variantId ? { ...v, ...patch } : v
                  ),
                  updatedAt: Date.now(),
                }
              : i
          ),
        })),

      removeAvatarVariant: (identityId, variantId) =>
        set((state) => ({
          identities: state.identities.map((i) =>
            i.id === identityId
              ? {
                  ...i,
                  avatarVariants: i.avatarVariants.filter((v) => v.id !== variantId),
                  updatedAt: Date.now(),
                }
              : i
          ),
        })),

      setDefaultAvatarVariant: (identityId, variantId) =>
        set((state) => ({
          identities: state.identities.map((i) =>
            i.id === identityId
              ? { ...i, defaultAvatarVariantId: variantId, updatedAt: Date.now() }
              : i
          ),
        })),

      migrateLegacyIdentities: (partnerName) => {
        const state = get();
        const existing = new Set(state.identities.map((i) => i.id));
        const now = Date.now();
        let created = 0;

        /**
         * Legacy preset migration (Group Builder closure):
         * no longer seeds lunaris/clawd/mira for new installs. Only preserves a preset
         * when an existing conversation references it, so old groups keep rendering.
         */
        const stored = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('lunartide_data') || '{}')?.state
          : undefined;
        const conversations: Conversation[] = Array.isArray(stored?.conversations) ? stored.conversations : [];
        const referenced = referencedLegacyPresetIds(conversations);
        const defaultDisplayNames: Record<string, string> = {
          lunaris: partnerName || AGENT_DEFAULT_DISPLAY_NAME,
          clawd: 'CLAWD',
          mira: 'MIRA',
        };
        const defaultBios: Record<string, string> = {
          lunaris: '你的潮汐伴侶',
          clawd: '潮汐守護者',
          mira: '月亮觀測者',
        };
        const defaultAliases: Record<string, string[]> = {
          lunaris: ['lunaris', 'luna'],
          clawd: ['clawd'],
          mira: ['mira'],
        };

        for (const id of referenced) {
          if (existing.has(id)) continue;
          const identity: ChatIdentity = {
            id,
            kind: 'ai',
            displayName: defaultDisplayNames[id] || id,
            avatarVariants: [],
            defaultAvatarVariantId: '',
            bio: defaultBios[id] || '',
            personaPrompt: '',
            mentionAliases: defaultAliases[id] || [],
            allowManualSpeaking: true,
            archived: false,
            createdAt: now,
            updatedAt: now,
          };
          state.addIdentity(identity);
          created += 1;
        }

        set((current) => ({ identities: migrateHandles(current.identities) }));
        return created;
      },
    }),
    {
      name: 'lunartide-identities',
      partialize: (state) => ({
        identities: state.identities,
      }),
      onRehydrateStorage: () => {
        return () => {
          const partner = typeof window !== 'undefined'
            ? JSON.parse(localStorage.getItem('lunartide_data') || '{}')?.state?.partner
            : undefined;
          useIdentityStore.getState().migrateLegacyIdentities(partner?.displayName || partner?.name || AGENT_DEFAULT_DISPLAY_NAME);
        };
      },
    },
  ),
);
