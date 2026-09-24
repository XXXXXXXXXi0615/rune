import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { getBlob } from '@/store/avatarBlobStorage';
import { useAppStore } from '@/store/useAppStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import { usePresenceStore } from '@/store/usePresenceStore';
import { BUILTIN_LUNARIS_ID, useCharacterStore } from '@/store/useCharacterStore';
import type { ChatIdentity, ChatParticipant, Conversation, GroupParticipant } from '@/types';
import {
  getGroupCollageIdentityIds,
  getGroupCollageLayout,
  getGroupCollageMemberCount,
  getLegacyCollageParticipants,
  resolveAvatarVariant,
  resolveConversationKind,
  resolveDirectIdentityId,
  resolveGroupAvatarSource,
} from '@/utils/conversationAvatar';

interface AvatarAssetImageProps {
  assetId?: string;
  alt: string;
  className?: string;
  crop?: Conversation['avatarCrop'];
  onUnavailable?: () => void;
  fallback?: ReactNode;
}

export function AvatarAssetImage({ assetId, alt, className, crop, onUnavailable, fallback = null }: AvatarAssetImageProps) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const objectUrl = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = undefined;
    setUrl(undefined);
    setFailed(false);
    if (!assetId) return undefined;
    let cancelled = false;
    getBlob(assetId).then((blob) => {
      if (cancelled) return;
      if (!blob) { setFailed(true); onUnavailable?.(); return; }
      const nextUrl = URL.createObjectURL(blob);
      objectUrl.current = nextUrl;
      setUrl(nextUrl);
    }).catch(() => { if (!cancelled) { setFailed(true); onUnavailable?.(); } });
    return () => {
      cancelled = true;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = undefined;
    };
  }, [assetId, onUnavailable]);

  if (!url || failed) return <>{fallback}</>;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => { setFailed(true); onUnavailable?.(); }}
      style={{
        objectPosition: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`,
        transform: `scale(${crop?.zoom ?? 1})`,
      }}
    />
  );
}

/**
 * Canonical person fallback for any participant without a resolvable avatar.
 * A participant is a person, so the fallback is initials — never a chat/message
 * glyph, which would read as a conversation rather than a speaker.
 */
export function avatarInitialOf(label: string): string {
  const trimmed = (label || '').trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0];
  return (first || '?').toUpperCase();
}

export function PersonAvatarFallback({ label, size, shape = 'circle', className }: { label: string; size: number; shape?: 'circle' | 'rounded'; className?: string }) {
  return (
    <span
      className={`identity-avatar-fallback${className ? ` ${className}` : ''} is-${shape}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      role="img"
      aria-label={label}
    >
      <span className="identity-avatar-fallback-initial" aria-hidden="true">{avatarInitialOf(label)}</span>
    </span>
  );
}

function GenericAvatar({ label, size, shape = 'circle' }: { label: string; size: number; shape?: 'circle' | 'rounded' }) {
  return <PersonAvatarFallback label={label} size={size} shape={shape} />;
}

export function NarratorAvatar({ size = 36 }: { size?: number }) {
  return (
    <span className="identity-avatar-fallback is-narrator" style={{ width: size, height: size }} role="img" aria-label="旁白">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>
    </span>
  );
}

interface IdentityAvatarProps {
  identityId: string;
  participant?: GroupParticipant;
  legacyParticipant?: ChatParticipant;
  size?: number;
  presence?: React.ReactNode;
  label?: string;
}

export function IdentityAvatar({ identityId, participant, legacyParticipant, size = 40, presence, label }: IdentityAvatarProps) {
  const identities = useIdentityStore((state) => state.identities);
  const character = useCharacterStore((state) => state.characters.find((item) => item.id === (identityId === 'lunaris' ? BUILTIN_LUNARIS_ID : identityId)));
  const profile = useAppStore((state) => state.profile);
  const identity = identities.find((item) => item.id === identityId);
  const variant = identity ? resolveAvatarVariant(identity, participant) : undefined;
  const displayName = participant?.displayNameOverride || identity?.displayName || legacyParticipant?.groupNickname || legacyParticipant?.name || label || '聊天成員';

  if (identityId === 'narrator' || identity?.kind === 'narrator') return <NarratorAvatar size={size} />;
  return (
    <span className="identity-avatar" style={{ width: size, height: size }}>
      {participant?.customAvatarAssetId ? (
        <AvatarAssetImage assetId={participant.customAvatarAssetId} alt={displayName} crop={participant.customAvatarCrop} fallback={<GenericAvatar label={displayName} size={size} />} />
      ) : variant?.assetId ? (
        <AvatarAssetImage assetId={variant.assetId} alt={displayName} crop={{ x: variant.cropX, y: variant.cropY, zoom: variant.zoom }} fallback={<GenericAvatar label={displayName} size={size} />} />
      ) : character?.avatarAssetId ? (
        <AvatarAssetImage assetId={character.avatarAssetId} alt={displayName} crop={character.avatarCrop} fallback={<GenericAvatar label={displayName} size={size} />} />
      ) : identity?.kind === 'user' || legacyParticipant?.isSelf ? (
        profile ? <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={displayName.charAt(0)} initial={displayName.charAt(0)} color={profile.avatarColor || 'user'} size={size} label={displayName} /> : <GenericAvatar label={displayName} size={size} />
      ) : legacyParticipant?.avatarUrl ? (
        <img src={legacyParticipant.avatarUrl} alt={displayName} draggable={false} />
      ) : (
        <GenericAvatar label={displayName} size={size} />
      )}
      {presence}
    </span>
  );
}

export function GroupAvatarCollage({ conversation, size = 44 }: { conversation: Conversation; size?: number }) {
  const identities = useIdentityStore((state) => state.identities);
  const identityIds = useMemo(() => getGroupCollageIdentityIds(conversation, identities), [conversation, identities]);
  const legacy = useMemo(() => getLegacyCollageParticipants(conversation), [conversation]);
  const memberCount = getGroupCollageMemberCount(conversation);
  const tileCount = identityIds.length || legacy.length;
  if (!memberCount) return <GenericAvatar label="群聊" size={size} shape="rounded" />;
  return (
    <span className={`group-avatar-collage count-${Math.min(tileCount, 4)} layout-${getGroupCollageLayout(tileCount || 1)}`} style={{ width: size, height: size }} role="img" aria-label={`${memberCount} 位成員的群聊頭像`}>
      {(identityIds.length ? identityIds : legacy.map((item) => item.id)).map((id, index) => {
        const gp = conversation.groupParticipants?.find((item) => item.identityId === id);
        const lp = legacy.find((item) => item.id === id);
        return <IdentityAvatar key={id} identityId={id} participant={gp} legacyParticipant={lp} size={size} label={`成員 ${index + 1}`} />;
      })}
    </span>
  );
}

export function ConversationAvatar({ conversation, size = 44, presence }: { conversation: Conversation; size?: number; presence?: React.ReactNode }) {
  const identities = useIdentityStore((state) => state.identities);
  const presences = usePresenceStore((state) => state.presences);
  const [customFailed, setCustomFailed] = useState(false);
  const [legacyFailed, setLegacyFailed] = useState(false);
  const characters = useCharacterStore((state) => state.characters);
  const character = characters.find((item) => item.id === (conversation.characterIds?.[0] || BUILTIN_LUNARIS_ID));
  const markCustomFailed = useCallback(() => setCustomFailed(true), []);
  const isGroup = resolveConversationKind(conversation) === 'group';
  const directIdentityId = useMemo(() => resolveDirectIdentityId(conversation, identities), [conversation, identities]);
  const directParticipant = useMemo(
    () => conversation.groupParticipants?.find((participant) => participant.identityId === directIdentityId),
    [conversation.groupParticipants, directIdentityId],
  );
  useEffect(() => { setCustomFailed(false); setLegacyFailed(false); }, [conversation.avatarAssetId, conversation.avatarUrl]);

  if (isGroup) {
    const source = resolveGroupAvatarSource(conversation);
    if (source === 'asset' && !customFailed) {
      return (
        <span className="conversation-avatar is-group-custom" style={{ width: size, height: size }}>
          <AvatarAssetImage assetId={conversation.avatarAssetId} crop={conversation.avatarCrop} alt={conversation.customTitle || conversation.title} onUnavailable={markCustomFailed} fallback={<GroupAvatarCollage conversation={conversation} size={size} />} />
        </span>
      );
    }
    if (source === 'legacy-url' && conversation.avatarUrl && !legacyFailed) return <span className="conversation-avatar is-group-custom" style={{ width: size, height: size }}><img src={conversation.avatarUrl} alt={conversation.customTitle || conversation.title} onError={() => setLegacyFailed(true)} /></span>;
    return <GroupAvatarCollage conversation={conversation} size={size} />;
  }
  if (character?.avatarAssetId) {
    return <span className="conversation-avatar" style={{ width: size, height: size }}><AvatarAssetImage assetId={character.avatarAssetId} crop={character.avatarCrop} alt={character.name} fallback={<GenericAvatar label={character.name} size={size}/>} /></span>;
  }
  if (directIdentityId) {
    const status = presences[directIdentityId]?.visiblePresenceStatus || 'offline';
    const statusDot = presence || <span className={`conversation-avatar-presence is-${status}`} aria-label={status === 'online' ? '在線' : status === 'busy' ? '忙碌' : status === 'invisible' ? '隱身' : '離線'} />;
    return <IdentityAvatar identityId={directIdentityId} participant={directParticipant} size={size} presence={statusDot} />;
  }
  return <GenericAvatar label="私聊" size={size} />;
}

export function identityById(identities: ChatIdentity[], id: string): ChatIdentity | undefined {
  return identities.find((identity) => identity.id === id);
}
