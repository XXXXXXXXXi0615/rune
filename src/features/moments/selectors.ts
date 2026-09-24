import type { MomentComment, MomentPost } from './domain';

export function selectChronologicalMomentPosts(posts: MomentPost[]): MomentPost[] {
  return [...posts].sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id));
}

export function selectMomentComments(post: MomentPost, comments: MomentComment[]): MomentComment[] {
  const ids = new Set(post.commentIds);
  return comments
    .filter((comment) => comment.postId === post.id && ids.has(comment.id))
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}
