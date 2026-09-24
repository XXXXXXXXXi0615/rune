import { describe, expect, it } from 'vitest';
import type { Conversation, GroupRelationship } from '@/types';
import {
  getGroupRelationships,
  getRelationship,
  getOutgoingRelationships,
  getIncomingRelationships,
  getRelationshipPair,
  normalizeGroupRelationships,
  formatRelationshipLabel,
  buildGroupRelationshipContext,
} from './relationships';

const rel = (from: string, to: string, kind: GroupRelationship['kind'] = 'friend', patch: Partial<GroupRelationship> = {}): GroupRelationship => ({
  id: `rel-${from}-${to}`,
  fromParticipantId: from,
  toParticipantId: to,
  kind,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const group = (relationships: GroupRelationship[] = []): Conversation => ({
  id: 'g', title: '群聊', kind: 'group', type: 'group', messages: [], createdAt: 1, updatedAt: 1,
  groupParticipants: [
    { identityId: 'rune', role: 'member', order: 0, joinedAt: 1, replyPolicy: 'smart' },
    { identityId: 'shuri', role: 'admin', order: 1, joinedAt: 1, replyPolicy: 'smart' },
    { identityId: 'haru', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'mention' },
  ],
  groupRelationships: relationships,
});

describe('group relationships', () => {
  it('returns empty for non-group or missing relationships', () => {
    expect(getGroupRelationships(undefined)).toEqual([]);
    expect(getGroupRelationships({ id: 'd', kind: 'direct', type: 'direct', title: '', messages: [], createdAt: 1, updatedAt: 1 })).toEqual([]);
    expect(getGroupRelationships(group())).toEqual([]);
  });

  it('gets directional relationship A→B', () => {
    const r = rel('rune', 'shuri', 'protective');
    const conv = group([r]);
    expect(getRelationship(conv, 'rune', 'shuri')).toBe(r);
    expect(getRelationship(conv, 'shuri', 'rune')).toBeUndefined();
  });

  it('gets outgoing and incoming relationships', () => {
    const r1 = rel('rune', 'shuri', 'protective');
    const r2 = rel('rune', 'haru', 'friend');
    const r3 = rel('shuri', 'rune', 'dependent');
    const conv = group([r1, r2, r3]);
    expect(getOutgoingRelationships(conv, 'rune')).toEqual([r1, r2]);
    expect(getIncomingRelationships(conv, 'rune')).toEqual([r3]);
  });

  it('gets relationship pair with asymmetry', () => {
    const r1 = rel('rune', 'shuri', 'protective');
    const r2 = rel('shuri', 'rune', 'dependent');
    const conv = group([r1, r2]);
    const pair = getRelationshipPair(conv, 'rune', 'shuri');
    expect(pair.aToB).toBe(r1);
    expect(pair.bToA).toBe(r2);
  });

  it('normalizes away invalid participant references', () => {
    const r1 = rel('rune', 'shuri', 'friend');
    const r2 = rel('rune', 'ghost', 'friend');
    const valid = new Set(['rune', 'shuri', 'haru']);
    expect(normalizeGroupRelationships([r1, r2], valid)).toEqual([r1]);
    expect(normalizeGroupRelationships([r2], valid)).toBeUndefined();
    expect(normalizeGroupRelationships(undefined, valid)).toBeUndefined();
  });

  it('formats labels including custom', () => {
    expect(formatRelationshipLabel(rel('a', 'b', 'protective'))).toBe('保護');
    expect(formatRelationshipLabel(rel('a', 'b', 'custom', { customLabel: '死黨' }))).toBe('死黨');
    expect(formatRelationshipLabel(rel('a', 'b', 'custom'))).toBe('自訂');
  });

  it('builds context seam with only relevant edges', () => {
    const r1 = rel('rune', 'shuri', 'protective', { note: '會主動提醒' });
    const r2 = rel('shuri', 'rune', 'dependent');
    const r3 = rel('rune', 'haru', 'friend');
    const conv = group([r1, r2, r3]);
    const ctx = buildGroupRelationshipContext({ conversation: conv, speakerParticipantId: 'shuri', responderParticipantId: 'rune' });
    expect(ctx.responderToSpeaker).toEqual({ kind: 'protective', label: '保護', note: '會主動提醒' });
    expect(ctx.speakerToResponder).toEqual({ kind: 'dependent', label: '依賴', note: undefined });
  });

  it('returns empty context when no relationships', () => {
    const ctx = buildGroupRelationshipContext({ conversation: group(), speakerParticipantId: 'rune', responderParticipantId: 'shuri' });
    expect(ctx.responderToSpeaker).toBeUndefined();
    expect(ctx.speakerToResponder).toBeUndefined();
  });
});
