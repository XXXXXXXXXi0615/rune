import { describe, expect, it } from 'vitest';
import type { ChatIdentity, Conversation } from '@/types';
import {
  resolveGroupParticipantPresentation,
  resolveGroupParticipantPresentations,
  participantNeedsDisambiguation,
  type GroupParticipantPresentation,
} from './presentation';

const identity = (id: string, kind: ChatIdentity['kind'], patch: Partial<ChatIdentity> = {}): ChatIdentity => ({
  id, kind, displayName: id, avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '',
  mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1, ...patch,
});

const group = (groupParticipants: Conversation['groupParticipants']): Conversation => ({
  id: 'g', title: '群聊', kind: 'group', type: 'group', messages: [], createdAt: 1, updatedAt: 1,
  groupParticipants, currentSpeakerParticipantId: 'self',
});

describe('group participant presentation resolver', () => {
  it('maps self / manual / ai to 你 / 成員 / AI', () => {
    const conversations = group([
      { identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' },
      { identityId: 'rune', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention' },
      { identityId: 'mira', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'mention' },
    ]);
    const identities = [identity('self', 'user'), identity('rune', 'ai'), identity('mira', 'user')];
    const [self, rune, mira] = resolveGroupParticipantPresentations(conversations, identities);
    expect(self.secondaryLabel).toBe('你');
    expect(self.kind).toBe('self');
    expect(rune.secondaryLabel).toBe('AI');
    expect(rune.kind).toBe('ai');
    expect(mira.secondaryLabel).toBe('成員');
    expect(mira.kind).toBe('manual');
  });

  it('labels a user-kind custom role as 成員, not 你 (regression: every role was 你)', () => {
    const conversations = group([
      { identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' },
      { identityId: 'role-a', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention' },
      { identityId: 'role-b', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'mention' },
    ]);
    const identities = [identity('self', 'user'), identity('role-a', 'user'), identity('role-b', 'user')];
    const presentations = resolveGroupParticipantPresentations(conversations, identities);
    expect(presentations.filter((item) => item.kind === 'self')).toHaveLength(1);
    expect(presentations.map((item) => item.secondaryLabel)).toEqual(['你', '成員', '成員']);
  });

  it('exposes handle for duplicate display names without rewriting displayName', () => {
    const conversations = group([
      { identityId: 'a', role: 'member', order: 0, joinedAt: 1, replyPolicy: 'mention' },
      { identityId: 'b', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention' },
    ]);
    const identities = [
      identity('a', 'ai', { displayName: '月光', handle: 'moon-a', mentionAliases: ['月光'] }),
      identity('b', 'ai', { displayName: '月光', handle: 'moon-b', mentionAliases: ['月光'] }),
    ];
    const presentations = resolveGroupParticipantPresentations(conversations, identities);
    expect(presentations.map((item) => item.displayName)).toEqual(['月光', '月光']);
    expect(presentations.map((item) => item.handle)).toEqual(['moon-a', 'moon-b']);
    expect(participantNeedsDisambiguation(presentations[0], presentations)).toBe(true);
  });

  it('resolves avatar source descriptors', () => {
    const conversations = group([
      { identityId: 'custom', role: 'member', order: 0, joinedAt: 1, replyPolicy: 'mention', customAvatarAssetId: 'blob-xyz' },
      { identityId: 'variant', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention', avatarVariantOverrideId: 'v2' },
      { identityId: 'legacy', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'mention' },
      { identityId: 'bare', role: 'member', order: 3, joinedAt: 1, replyPolicy: 'mention' },
    ]);
    const identities = [
      identity('custom', 'ai'),
      identity('variant', 'ai', { avatarVariants: [{ id: 'v2', label: 'V2', assetId: 'asset-2', cropX: 50, cropY: 50, zoom: 1 }] }),
      identity('legacy', 'ai'),
      identity('bare', 'ai'),
    ];
    const [custom, variant, legacy, bare] = resolveGroupParticipantPresentations(conversations, identities);
    expect(custom.avatar).toEqual({ origin: 'custom-asset', assetId: 'blob-xyz', label: 'custom' });
    expect(variant.avatar).toEqual({ origin: 'variant-asset', assetId: 'asset-2', variantId: 'v2', label: 'variant' });
    expect(legacy.avatar.origin).toBe('fallback');
    expect(bare.avatar.origin).toBe('fallback');
  });

  it('never mutates inputs and is deterministic', () => {
    const conversations = group([{ identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' }]);
    const identities = [identity('self', 'user')];
    const beforeConv = structuredClone(conversations);
    const beforeIds = structuredClone(identities);
    const a = resolveGroupParticipantPresentation({ identityId: 'self', isSelf: true, kind: 'user', displayName: '我', role: 'admin', joinedAt: 1, aiParticipationMode: 'off', allowManualSpeaking: true });
    const b = resolveGroupParticipantPresentation({ identityId: 'self', isSelf: true, kind: 'user', displayName: '我', role: 'admin', joinedAt: 1, aiParticipationMode: 'off', allowManualSpeaking: true });
    expect(a).toEqual(b);
    expect(conversations).toEqual(beforeConv);
    expect(identities).toEqual(beforeIds);
  });
});
