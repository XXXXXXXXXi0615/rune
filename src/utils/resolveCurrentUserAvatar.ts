import type { ProfileData, AvatarImageMeta } from '@/types';

export interface ResolvedCurrentUserAvatar {
  avatarImage?: AvatarImageMeta;
  initial: string;
  color: string;
}

/**
 * Single resolution point for the current user's avatar.
 *
 * Priority:
 *  1. profile.avatarImage (AvatarImageMeta — new system via pet-images DB)
 *  2. profile.avatarAssetId (legacy — assets DB, consumed by useAssetBlobUrl)
 *  3. SVG fallback with initial letter
 *
 * The caller decides how to render:
 *  - If avatarImage is present → use <AvatarImage avatarConfig={avatarImage} />
 *  - If only avatarAssetId is present → use <useAssetBlobUrl> or legacy <img>
 *  - Otherwise → SVG fallback (handled by AvatarImage's built-in fallback)
 */
export function resolveCurrentUserAvatar(
  profile: Pick<ProfileData, 'displayName' | 'avatarInitial' | 'avatarColor' | 'avatarImage' | 'avatarAssetId'>,
  userName?: string,
): ResolvedCurrentUserAvatar {
  const initial = (profile.avatarInitial || profile.displayName || userName || 'S')
    .charAt(0)
    .toUpperCase();

  return {
    avatarImage: profile.avatarImage,
    initial,
    color: profile.avatarColor || 'user',
  };
}
