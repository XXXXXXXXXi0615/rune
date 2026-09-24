export const CURRENT_USER_MOMENT_AUTHOR_ID = 'user:self' as const;
export const MOMENTS_SCHEMA_VERSION = 2;

export type MomentAuthorId = typeof CURRENT_USER_MOMENT_AUTHOR_ID | `agent:${string}`;
export type MomentVisibility = 'everyone' | 'only-me';
export type MomentMediaAspect = 'original' | '1:1' | '4:5';

export interface MomentMediaCrop {
  x: number;
  y: number;
  zoom: number;
  aspect: MomentMediaAspect;
}

export interface MomentMediaItem {
  id: string;
  assetId: string;
  order: number;
  crop?: MomentMediaCrop;
  width?: number;
  height?: number;
}

export interface MomentPost {
  id: string;
  authorId: MomentAuthorId;
  createdAt: number;
  updatedAt?: number;
  text: string;
  media: MomentMediaItem[];
  visibility: MomentVisibility;
  likedBy: MomentAuthorId[];
  commentIds: string[];
}

export interface MomentComment {
  id: string;
  postId: string;
  authorId: MomentAuthorId;
  parentCommentId?: string;
  replyToAuthorId?: MomentAuthorId;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface MomentDraft {
  text: string;
  media: MomentMediaItem[];
  visibility: MomentVisibility;
}

type LegacyMomentPost = Omit<MomentPost, 'media'> & { media?: MomentMediaItem[]; mediaIds?: string[] };

export function createMomentMediaItem(assetId: string, order: number, dimensions?: { width?: number; height?: number }): MomentMediaItem {
  return { id: crypto.randomUUID(), assetId, order, ...dimensions };
}

export function normalizeMomentMedia(items: MomentMediaItem[]): MomentMediaItem[] {
  const seen = new Set<string>();
  return [...items]
    .sort((a, b) => a.order - b.order)
    .filter((item) => Boolean(item.assetId) && !seen.has(item.assetId) && seen.add(item.assetId))
    .slice(0, 9)
    .map((item, order) => ({
      ...item,
      id: item.id || `legacy-${item.assetId}`,
      order,
      crop: item.crop ? {
        x: Math.min(100, Math.max(0, item.crop.x)),
        y: Math.min(100, Math.max(0, item.crop.y)),
        zoom: Math.min(3, Math.max(1, item.crop.zoom)),
        aspect: item.crop.aspect,
      } : undefined,
    }));
}

export function getMomentGalleryColumns(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2 || count === 4) return 2;
  return 3;
}

export function normalizeMomentPost(post: LegacyMomentPost): MomentPost {
  const media = post.media ?? (post.mediaIds ?? []).map((assetId, order) => ({ id: `legacy-${assetId}`, assetId, order }));
  const { mediaIds: _legacyMediaIds, ...rest } = post;
  return {
    ...rest,
    text: post.text.trim(),
    media: normalizeMomentMedia(media),
    likedBy: [...new Set(post.likedBy)],
    commentIds: [...new Set(post.commentIds)],
  };
}

export function toggleMomentLike(post: MomentPost, authorId: MomentAuthorId): MomentPost {
  const liked = post.likedBy.includes(authorId);
  return {
    ...post,
    likedBy: liked ? post.likedBy.filter((id) => id !== authorId) : [...post.likedBy, authorId],
    updatedAt: Date.now(),
  };
}

export function setMomentLike(post: MomentPost, authorId: MomentAuthorId, liked: boolean): MomentPost {
  const alreadyLiked = post.likedBy.includes(authorId);
  if (alreadyLiked === liked) return post;
  return {
    ...post,
    likedBy: liked ? [...post.likedBy, authorId] : post.likedBy.filter((id) => id !== authorId),
    updatedAt: Date.now(),
  };
}

export function normalizeReplyTarget(
  parent: MomentComment | undefined,
): Pick<MomentComment, 'parentCommentId' | 'replyToAuthorId'> {
  return parent ? { parentCommentId: parent.id, replyToAuthorId: parent.authorId } : {};
}
