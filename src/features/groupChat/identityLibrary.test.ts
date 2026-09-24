import { describe, expect, it } from 'vitest';
import type { ChatIdentity, Conversation } from '@/types';
import { buildGroupLibraryIdentities, shouldHideFromGroupLibrary, referencedLegacyPresetIds } from './identityLibrary';

const identity = (id: string, patch: Partial<ChatIdentity> = {}): ChatIdentity => ({
  id, kind: 'ai', displayName: id.toUpperCase(), avatarVariants: [], defaultAvatarVariantId: '',
  bio: '你的潮汐伴侶', personaPrompt: '', mentionAliases: [id], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1,
  ...patch,
});

const conversation = (participantIds: string[], patch: Partial<Conversation> = {}): Conversation => ({
  id: 'c', title: '群聊', kind: 'group', type: 'group', messages: [], createdAt: 1, updatedAt: 1,
  participantIds,
  groupParticipants: participantIds.map((identityId, order) => ({ identityId, role: 'member', order, joinedAt: 1, replyPolicy: 'mention' })),
  ...patch,
});

describe('group library identity filter', () => {
  it('hides purely untouched legacy presets for new groups', () => {
    const lunaris = identity('lunaris', { bio: '你的潮汐伴侶', mentionAliases: ['lunaris', 'luna'] });
    expect(shouldHideFromGroupLibrary(lunaris, [])).toBe(true);
    expect(buildGroupLibraryIdentities([lunaris, identity('mira', { mentionAliases: ['mira'], bio: '月亮觀測者' })], []).map((i) => i.id)).toEqual([]);
  });

  it('keeps modified legacy presets (avatar / persona / display name)', () => {
    const modified = identity('lunaris', { avatarVariants: [{ id: 'v', label: '自訂', assetId: 'a', cropX: 50, cropY: 50, zoom: 1 }] });
    expect(shouldHideFromGroupLibrary(modified, [])).toBe(false);
    const renamed = identity('clawd', { displayName: '小爪' });
    expect(shouldHideFromGroupLibrary(renamed, [])).toBe(false);
    const persona = identity('mira', { personaPrompt: '安靜觀星' });
    expect(shouldHideFromGroupLibrary(persona, [])).toBe(false);
  });

  it('keeps legacy presets referenced by existing conversations', () => {
    const lunaris = identity('lunaris', { mentionAliases: ['lunaris', 'luna'] });
    const convs = [conversation(['self', 'lunaris'])];
    expect(shouldHideFromGroupLibrary(lunaris, convs)).toBe(false);
    expect(buildGroupLibraryIdentities([lunaris], convs).map((i) => i.id)).toEqual(['lunaris']);
    expect(referencedLegacyPresetIds(convs)).toEqual(['lunaris']);
  });

  it('keeps user-created identities and never keeps self/narrator/archived', () => {
    const mine = identity('role-1', { kind: 'user', displayName: '小滿' });
    const self = identity('self', { kind: 'user' });
    const archived = identity('role-2', { archived: true });
    const narrator = identity('narrator', { kind: 'narrator', allowManualSpeaking: false });
    const list = buildGroupLibraryIdentities([mine, self, archived, narrator], []);
    expect(list.map((i) => i.id)).toEqual(['role-1']);
  });

  it('keeps self excluded from signatures and hide logic regardless of modification', () => {
    // 'self' is never a legacy preset; the library list excludes it entirely (builder synthesizes the canonical Self)
    expect(shouldHideFromGroupLibrary(identity('self', { kind: 'user' }), [])).toBe(false);
  });
});
