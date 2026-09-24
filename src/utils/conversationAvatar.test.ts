import { describe, expect, it } from 'vitest';
import type { ChatIdentity, Conversation, GroupParticipant } from '@/types';
import {
  getDuplicateDraftIds,
  getGroupCollageLayout,
  getGroupCollageIdentityIds,
  getGroupCollageMemberCount,
  resolveAvatarVariant,
  resolveDirectIdentityId,
  resolveGroupAvatarSource,
} from './conversationAvatar';

const now = 100;
const identity = (id: string, kind: ChatIdentity['kind'] = 'ai'): ChatIdentity => ({
  id, kind, displayName: id.toUpperCase(), avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: now, updatedAt: now,
});
const conversation = (patch: Partial<Conversation> = {}): Conversation => ({ id: 'c', title: 'Chat', messages: [], createdAt: now, updatedAt: now, ...patch });
const participant = (identityId: string, order: number, patch: Partial<GroupParticipant> = {}): GroupParticipant => ({ identityId, order, joinedAt: now, role: 'member', replyPolicy: 'smart', ...patch });

describe('conversation avatar resolution', () => {
  it('resolves the other AI identity and excludes the user', () => {
    expect(resolveDirectIdentityId(conversation({ participantIds: ['self', 'lunaris'] }), [identity('self', 'user'), identity('lunaris')])).toBe('lunaris');
  });

  it('uses participant avatar override before the identity default', () => {
    const item = { ...identity('lunaris'), defaultAvatarVariantId: 'default', avatarVariants: [
      { id: 'default', label: 'Default', assetId: 'a', cropX: 50, cropY: 50, zoom: 1 },
      { id: 'group', label: 'Group', assetId: 'b', cropX: 50, cropY: 50, zoom: 1 },
    ] };
    expect(resolveAvatarVariant(item, participant('lunaris', 0, { avatarVariantOverrideId: 'group' }))?.assetId).toBe('b');
  });

  it.each([1, 2, 3, 4])('keeps %i valid collage members', (count) => {
    const identities = Array.from({ length: count }, (_, index) => identity(`ai-${index}`));
    const groupParticipants = identities.map((item, index) => participant(item.id, index));
    expect(getGroupCollageIdentityIds(conversation({ kind: 'group', groupParticipants }), identities)).toHaveLength(count);
  });

  it('maps one through four members to the intended collage layouts', () => {
    expect(getGroupCollageLayout(1)).toBe('single');
    expect(getGroupCollageLayout(2)).toBe('split');
    expect(getGroupCollageLayout(3)).toBe('lead-stack');
    expect(getGroupCollageLayout(4)).toBe('grid');
    expect(getGroupCollageLayout(8)).toBe('grid');
  });

  it('sorts, excludes narrator and caps the collage at four', () => {
    const identities = [identity('narrator', 'narrator'), ...Array.from({ length: 5 }, (_, index) => identity(`ai-${index}`))];
    const groupParticipants = [participant('narrator', 0), ...identities.slice(1).map((item, index) => participant(item.id, 5 - index))];
    expect(getGroupCollageIdentityIds(conversation({ kind: 'group', groupParticipants }), identities)).toEqual(['ai-4', 'ai-3', 'ai-2', 'ai-1']);
  });

  it('keeps missing-identity members as fallback tiles (never disappearing)', () => {
    expect(getGroupCollageIdentityIds(conversation({ kind: 'group', groupParticipants: [participant('missing', 0), participant('valid', 1)] }), [identity('valid')])).toEqual(['missing', 'valid']);
    expect(getGroupCollageMemberCount(conversation({ kind: 'group', groupParticipants: [participant('missing', 0), participant('valid', 1)] }))).toBe(2);
  });

  it('keeps archived members in the collage and reports the true member count', () => {
    const archived = { ...identity('archived', 'ai'), archived: true };
    const groupParticipants = [participant('archived', 0), participant('valid', 1)];
    expect(getGroupCollageIdentityIds(conversation({ kind: 'group', groupParticipants }), [archived, identity('valid')])).toEqual(['archived', 'valid']);
    expect(getGroupCollageMemberCount(conversation({ kind: 'group', groupParticipants }))).toBe(2);
  });

  it('excludes narrator from the member count and caps tiles at four while count reflects all members', () => {
    const participants = [participant('narrator', 0), ...Array.from({ length: 6 }, (_, index) => participant(`ai-${index}`, index + 1))];
    expect(getGroupCollageMemberCount(conversation({ kind: 'group', groupParticipants: participants }))).toBe(6);
    expect(getGroupCollageIdentityIds(conversation({ kind: 'group', groupParticipants: participants }), [])).toHaveLength(4);
  });

  it('prefers a custom group asset, then keeps a legacy Data URL, then returns to collage', () => {
    const group = conversation({ kind: 'group', avatarUrl: 'data:image/png;base64,legacy' });
    expect(resolveGroupAvatarSource(group)).toBe('legacy-url');
    expect(resolveGroupAvatarSource({ ...group, avatarAssetId: 'asset-1' })).toBe('asset');
    expect(resolveGroupAvatarSource({ ...group, avatarUrl: undefined })).toBe('collage');
  });

  it('does not mutate a historical sender snapshot when current avatar data changes', () => {
    const snapshot = { identityId: 'lunaris', displayName: 'LUNARIS', avatarAssetId: 'old-asset', avatarVariantId: 'old', kind: 'ai' as const };
    const current = { ...identity('lunaris'), defaultAvatarVariantId: 'new', avatarVariants: [{ id: 'new', label: 'New', assetId: 'new-asset', cropX: 50, cropY: 50, zoom: 1 }] };
    expect(snapshot.avatarAssetId).toBe('old-asset');
    expect(resolveAvatarVariant(current)?.assetId).toBe('new-asset');
    expect(snapshot.avatarAssetId).toBe('old-asset');
  });

  it('keeps the newest safe draft and preserves configured drafts', () => {
    const items = [
      conversation({ id: 'old', updatedAt: 1 }),
      conversation({ id: 'new', updatedAt: 2 }),
      conversation({ id: 'pinned', updatedAt: 3, pinned: true }),
      conversation({ id: 'configured', updatedAt: 4, participantIds: ['lunaris'] }),
    ];
    expect(getDuplicateDraftIds(items)).toEqual(['old']);
  });
});
