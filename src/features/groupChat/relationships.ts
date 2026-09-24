import type { Conversation, GroupRelationship, GroupRelationshipKind } from '@/types';

export const RELATIONSHIP_KIND_LABELS: Record<GroupRelationshipKind, string> = {
  close: '親近',
  friend: '朋友',
  family: '家人',
  rival: '對手',
  protective: '保護',
  dependent: '依賴',
  formal: '正式',
  custom: '自訂',
};

export function getGroupRelationships(conversation: Conversation | undefined): GroupRelationship[] {
  if (!conversation || conversation.kind !== 'group') return [];
  return conversation.groupRelationships || [];
}

export function getRelationship(
  conversation: Conversation | undefined,
  fromParticipantId: string,
  toParticipantId: string,
): GroupRelationship | undefined {
  return getGroupRelationships(conversation).find(
    (r) => r.fromParticipantId === fromParticipantId && r.toParticipantId === toParticipantId,
  );
}

export function getOutgoingRelationships(
  conversation: Conversation | undefined,
  fromParticipantId: string,
): GroupRelationship[] {
  return getGroupRelationships(conversation).filter((r) => r.fromParticipantId === fromParticipantId);
}

export function getIncomingRelationships(
  conversation: Conversation | undefined,
  toParticipantId: string,
): GroupRelationship[] {
  return getGroupRelationships(conversation).filter((r) => r.toParticipantId === toParticipantId);
}

export function getRelationshipPair(
  conversation: Conversation | undefined,
  participantIdA: string,
  participantIdB: string,
): { aToB?: GroupRelationship; bToA?: GroupRelationship } {
  const relationships = getGroupRelationships(conversation);
  return {
    aToB: relationships.find((r) => r.fromParticipantId === participantIdA && r.toParticipantId === participantIdB),
    bToA: relationships.find((r) => r.fromParticipantId === participantIdB && r.toParticipantId === participantIdA),
  };
}

export function normalizeGroupRelationships(
  relationships: GroupRelationship[] | undefined,
  validParticipantIds: Set<string>,
): GroupRelationship[] | undefined {
  if (!relationships) return undefined;
  const filtered = relationships.filter(
    (r) => validParticipantIds.has(r.fromParticipantId) && validParticipantIds.has(r.toParticipantId),
  );
  return filtered.length ? filtered : undefined;
}

export function formatRelationshipLabel(relationship: GroupRelationship): string {
  if (relationship.kind === 'custom') return relationship.customLabel || RELATIONSHIP_KIND_LABELS.custom;
  return RELATIONSHIP_KIND_LABELS[relationship.kind];
}

export function buildGroupRelationshipContext({
  conversation,
  speakerParticipantId,
  responderParticipantId,
}: {
  conversation: Conversation | undefined;
  speakerParticipantId: string;
  responderParticipantId: string;
}): {
  responderToSpeaker?: { kind: GroupRelationshipKind; label: string; note?: string };
  speakerToResponder?: { kind: GroupRelationshipKind; label: string; note?: string };
} {
  if (!conversation) return {};
  const rToS = getRelationship(conversation, responderParticipantId, speakerParticipantId);
  const sToR = getRelationship(conversation, speakerParticipantId, responderParticipantId);
  return {
    responderToSpeaker: rToS ? { kind: rToS.kind, label: formatRelationshipLabel(rToS), note: rToS.note } : undefined,
    speakerToResponder: sToR ? { kind: sToR.kind, label: formatRelationshipLabel(sToR), note: sToR.note } : undefined,
  };
}
