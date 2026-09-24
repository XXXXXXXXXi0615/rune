import { describe, expect, it } from 'vitest';
import { getMomentGalleryColumns, normalizeMomentMedia, normalizeMomentPost, normalizeReplyTarget, setMomentLike, toggleMomentLike, type MomentComment, type MomentPost } from './domain';
import { selectChronologicalMomentPosts, selectMomentComments } from './selectors';

const post: MomentPost = {
  id: 'p1', authorId: 'user:self', createdAt: 1, text: ' hello ', media: [{ id: 'm1', assetId: 'a', order: 0 }, { id: 'm2', assetId: 'a', order: 1 }],
  visibility: 'everyone', likedBy: [], commentIds: ['c2', 'c1', 'c1'],
};

describe('Moments domain', () => {
  it('normalizes persisted collections without duplicates', () => {
    expect(normalizeMomentPost(post)).toMatchObject({ text: 'hello', media: [{ assetId: 'a', order: 0 }], commentIds: ['c2', 'c1'] });
  });

  it.each([0, 1, 2, 4, 9])('normalizes %i media items', (count) => {
    const media = Array.from({ length: count }, (_, index) => ({ id: `m${index}`, assetId: `a${index}`, order: count - index }));
    expect(normalizeMomentMedia(media)).toHaveLength(count);
    expect(normalizeMomentMedia(media).map((item) => item.order)).toEqual(Array.from({ length: count }, (_, index) => index));
  });

  it.each([[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 3], [9, 3]])('maps %i images to %i feed columns', (count, columns) => {
    expect(getMomentGalleryColumns(count)).toBe(columns);
  });

  it('caps media at nine and preserves crop metadata while reordering', () => {
    const media = Array.from({ length: 10 }, (_, index) => ({ id: `m${index}`, assetId: `a${index}`, order: 9 - index, crop: { x: 120, y: -2, zoom: 4, aspect: '4:5' as const } }));
    const result = normalizeMomentMedia(media);
    expect(result).toHaveLength(9);
    expect(result[0]).toMatchObject({ assetId: 'a9', order: 0, crop: { x: 100, y: 0, zoom: 3, aspect: '4:5' } });
  });

  it('migrates a legacy single-image post', () => {
    const legacy = { ...post, media: undefined, mediaIds: ['legacy-asset'] };
    expect(normalizeMomentPost(legacy).media).toEqual([{ id: 'legacy-legacy-asset', assetId: 'legacy-asset', order: 0 }]);
  });

  it('likes and unlikes deterministically', () => {
    const liked = toggleMomentLike(post, 'user:self');
    expect(liked.likedBy).toEqual(['user:self']);
    expect(toggleMomentLike(liked, 'user:self').likedBy).toEqual([]);
  });

  it('sets agent likes idempotently', () => {
    const actor = 'agent:agent-default' as const;
    const liked = setMomentLike(post, actor, true);
    expect(setMomentLike(liked, actor, true)).toBe(liked);
    expect(liked.likedBy).toEqual([actor]);
    expect(setMomentLike(liked, actor, false).likedBy).toEqual([]);
  });

  it('keeps replies flat with one parent relationship', () => {
    const parent: MomentComment = { id: 'c1', postId: 'p1', authorId: 'user:self', text: 'hi', createdAt: 2 };
    expect(normalizeReplyTarget(parent)).toEqual({ parentCommentId: 'c1', replyToAuthorId: 'user:self' });
  });

  it('sorts feed newest-first and comments oldest-first', () => {
    expect(selectChronologicalMomentPosts([post, { ...post, id: 'p2', createdAt: 3 }]).map((item) => item.id)).toEqual(['p2', 'p1']);
    const comments: MomentComment[] = [
      { id: 'c2', postId: 'p1', authorId: 'user:self', text: '2', createdAt: 3 },
      { id: 'c1', postId: 'p1', authorId: 'user:self', text: '1', createdAt: 2 },
    ];
    expect(selectMomentComments(normalizeMomentPost(post), comments).map((item) => item.id)).toEqual(['c1', 'c2']);
  });
});
