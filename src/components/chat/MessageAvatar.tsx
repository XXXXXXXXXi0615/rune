import { useState } from 'react';
import { AvatarAssetImage, IdentityAvatar, PersonAvatarFallback } from '@/components/chat/ConversationAvatars';
import type { ChatParticipant, Message } from '@/types';

/** Same canonical person fallback as every other participant surface. */
function MessageAvatarFallback({ label, size }: { label: string; size: number }) {
  return <PersonAvatarFallback label={label} size={size} className="message-avatar-fallback" />;
}

function LegacyMessageAvatar({ src, label, size }: { src: string; label: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <MessageAvatarFallback label={label} size={size} />;
  return <span className="message-avatar" style={{ width: size, height: size }}><img src={src} alt={label} onError={() => setFailed(true)} /></span>;
}

export function MessageAvatar({ message, participant, size = 30, label: labelOverride }: { message: Message; participant?: ChatParticipant; size?: number; label?: string }) {
  const snapshot = message.senderSnapshot;
  const label = labelOverride || snapshot?.displayName || message.senderDisplayNameSnapshot || participant?.groupNickname || participant?.name || '聊天成員';
  if (snapshot?.avatarAssetId) {
    return <span className="message-avatar" style={{ width: size, height: size }}><AvatarAssetImage assetId={snapshot.avatarAssetId} crop={snapshot.avatarCrop} alt={label} fallback={<MessageAvatarFallback label={label} size={size} />} /></span>;
  }
  if (snapshot?.legacyAvatarUrl) {
    return <LegacyMessageAvatar src={snapshot.legacyAvatarUrl} label={label} size={size} />;
  }
  if (snapshot?.identityId) return <IdentityAvatar identityId={snapshot.identityId} size={size} label={label} />;
  if (message.senderAvatarSnapshot?.startsWith('http') || message.senderAvatarSnapshot?.startsWith('data:')) {
    return <LegacyMessageAvatar src={message.senderAvatarSnapshot} label={label} size={size} />;
  }
  if (message.senderParticipantId && participant) return <IdentityAvatar identityId={message.senderParticipantId} legacyParticipant={participant} size={size} label={label} />;
  return <MessageAvatarFallback label={label} size={size} />;
}
