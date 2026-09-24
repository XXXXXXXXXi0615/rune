import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterFolder, CharacterProfile, Conversation, UserPersonaProfile } from '@/types';

export const BUILTIN_LUNARIS_ID = 'builtin-lunaris';
export const DEFAULT_USER_PERSONA_ID = 'persona-default';
const createdAt = Date.now();

export const DEFAULT_CHARACTER_FOLDERS: CharacterFolder[] = [
  '核心陪伴', '管控與監督', '共讀與創作', '遊戲與互動', '世界觀角色', '暫存角色', '已封存',
].map((name, order) => ({ id: ['core', 'supervision', 'creative', 'games', 'world', 'temporary', 'archived'][order], name, order, isSystem: true }));

export const BUILTIN_LUNARIS: CharacterProfile = {
  id: BUILTIN_LUNARIS_ID, name: 'LUNARIS', subtitle: '月潮共鳴伴侶', description: '陪伴你整理思緒、創作與生活節奏。', greeting: '我在，潮聲也在。',
  personality: '溫柔、敏銳、沉靜', speakingStyle: '自然、克制、帶有月潮意象', relationship: '長期陪伴者', scenario: 'Lunartide', folderId: 'core',
  tags: ['陪伴', '核心'], capabilities: ['chat', 'memory', 'creative'], systemPrompt: '', isBuiltIn: true, isFavorite: true, isArchived: false, createdAt, updatedAt: createdAt,
};

interface CharacterState {
  characters: CharacterProfile[];
  folders: CharacterFolder[];
  userPersonas: UserPersonaProfile[];
  userPersonaId: string;
  setUserPersona: (id: string) => void;
  createCharacter: (draft: Omit<CharacterProfile, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => string;
  updateCharacter: (id: string, patch: Partial<CharacterProfile>) => void;
  duplicateCharacter: (id: string) => string | undefined;
  archiveCharacter: (id: string) => void;
  deleteCharacter: (id: string) => boolean;
  addFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  reorderFolders: (ids: string[]) => void;
  deleteFolder: (id: string) => void;
  moveCharacterToFolder: (characterId: string, folderId: string) => void;
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      characters: [BUILTIN_LUNARIS],
      folders: DEFAULT_CHARACTER_FOLDERS,
      userPersonas: [{ id: DEFAULT_USER_PERSONA_ID, name: '我的身份', subtitle: '目前發言身份', description: '', createdAt, updatedAt: createdAt }],
      userPersonaId: DEFAULT_USER_PERSONA_ID,
      setUserPersona: (id) => set({ userPersonaId: id }),
      createCharacter: (draft) => { const id = `character-${crypto.randomUUID()}`; const time = Date.now(); set((state) => ({ characters: [...state.characters, { ...draft, id, isBuiltIn: false, createdAt: time, updatedAt: time }] })); return id; },
      updateCharacter: (id, patch) => set((state) => ({ characters: state.characters.map((item) => item.id === id ? { ...item, ...patch, id, updatedAt: Date.now() } : item) })),
      duplicateCharacter: (id) => { const source = get().characters.find((item) => item.id === id); if (!source) return undefined; const nextId = `character-${crypto.randomUUID()}`; const time = Date.now(); set((state) => ({ characters: [...state.characters, { ...source, id: nextId, name: `${source.name} 副本`, isBuiltIn: false, isArchived: false, createdAt: time, updatedAt: time }] })); return nextId; },
      archiveCharacter: (id) => set((state) => ({ characters: state.characters.map((item) => item.id === id ? { ...item, isArchived: !item.isArchived, folderId: !item.isArchived ? 'archived' : 'temporary', updatedAt: Date.now() } : item) })),
      deleteCharacter: (id) => { if (get().characters.find((item) => item.id === id)?.isBuiltIn) return false; set((state) => ({ characters: state.characters.filter((item) => item.id !== id) })); return true; },
      addFolder: (name) => { const id = `folder-${crypto.randomUUID()}`; set((state) => ({ folders: [...state.folders, { id, name, order: state.folders.length }] })); return id; },
      renameFolder: (id, name) => set((state) => ({ folders: state.folders.map((item) => item.id === id ? { ...item, name } : item) })),
      reorderFolders: (ids) => set((state) => ({ folders: state.folders.map((item) => ({ ...item, order: ids.includes(item.id) ? ids.indexOf(item.id) : item.order })) })),
      deleteFolder: (id) => {
        const state = get();
        const isSystem = state.folders.find((f) => f.id === id)?.isSystem;
        if (isSystem) return;
        const charsInFolder = state.characters.filter((c) => c.folderId === id);
        if (charsInFolder.length > 0) {
          set((s) => ({ characters: s.characters.map((c) => c.folderId === id ? { ...c, folderId: 'temporary', updatedAt: Date.now() } : c) }));
        }
        set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
      },
      moveCharacterToFolder: (characterId, folderId) =>
        set((state) => ({ characters: state.characters.map((c) => c.id === characterId ? { ...c, folderId, updatedAt: Date.now() } : c) })),
    }),
    {
      name: 'lunartide-character-library-v1',
      version: 1,
      merge: (persisted, current) => {
        const saved = (persisted as Partial<CharacterState>) || {};
        const characters = saved.characters || [];
        return { ...current, ...saved, folders: saved.folders?.length ? saved.folders : DEFAULT_CHARACTER_FOLDERS, characters: characters.some((item) => item.id === BUILTIN_LUNARIS_ID) ? characters : [BUILTIN_LUNARIS, ...characters] };
      },
    },
  ),
);

export function migrateConversationCharacterRefs(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => {
    if (conversation.characterIds?.length && conversation.userPersonaId) return conversation;
    const characterIds = conversation.kind === 'group'
      ? (conversation.groupParticipants || []).filter((item) => item.identityId !== 'self').map((item) => item.identityId === 'lunaris' ? BUILTIN_LUNARIS_ID : item.identityId)
      : [BUILTIN_LUNARIS_ID];
    return { ...conversation, userPersonaId: conversation.userPersonaId || DEFAULT_USER_PERSONA_ID, characterIds: conversation.characterIds?.length ? conversation.characterIds : characterIds };
  });
}
