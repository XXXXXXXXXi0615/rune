import { useAppStore } from '@/store/useAppStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import type { ChatIdentity, ChatParticipant } from '@/types';

export type CreateAndJoinIdentityResult =
  | { ok: true; identityId: string }
  | { ok: false; identityId?: string; error: string };

function avatarColorForIdentity(identity: ChatIdentity): string {
  return identity.kind === 'user' ? 'user' : 'char';
}

export function createIdentityAndJoinGroup(conversationId: string, identity: ChatIdentity): CreateAndJoinIdentityResult {
  if (!identity.displayName.trim()) return { ok: false, error: '請先填寫角色名稱。' };
  if (identity.archived || identity.kind === 'narrator') return { ok: false, error: '這個角色不能加入群聊。' };

  const identityState = useIdentityStore.getState();
  const existingIdentity = identityState.identities.find((item) => item.id === identity.id);
  if (!existingIdentity) identityState.addIdentity(identity);

  const conversation = useAppStore.getState().conversations.find((item) => item.id === conversationId);
  if (!conversation || conversation.kind !== 'group') {
    return { ok: false, identityId: identity.id, error: '角色已建立，但群聊已不存在。' };
  }
  const existingIds = new Set((conversation.participants || []).map((participant) => participant.id));
  if (existingIds.has(identity.id)) return { ok: true, identityId: identity.id };
  if (existingIds.size >= 12) {
    return { ok: false, identityId: identity.id, error: '角色已建立，但群聊已达 12 人上限。' };
  }

  const participant: ChatParticipant = {
    id: identity.id,
    name: identity.displayName,
    avatarInitial: identity.displayName.charAt(0),
    avatarColor: avatarColorForIdentity(identity),
    controlMode: identity.kind === 'user' ? 'user' : 'auto',
    isSelf: identity.id === 'self',
  };
  const joined = useAppStore.getState().addGroupParticipant(conversationId, participant);
  if (joined && identity.defaultReplyPolicy) {
    useAppStore.getState().updateGroupParticipantReplyPolicy(conversationId, identity.id, identity.defaultReplyPolicy);
  }
  return joined
    ? { ok: true, identityId: identity.id }
    : { ok: false, identityId: identity.id, error: '角色已建立，但加入群聊失败。请重试。' };
}
