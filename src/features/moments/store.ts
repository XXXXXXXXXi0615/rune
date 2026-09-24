import { create } from 'zustand';
import { deleteAsset } from '@/store/assets';
import {
  CURRENT_USER_MOMENT_AUTHOR_ID,
  normalizeReplyTarget,
  setMomentLike,
  toggleMomentLike,
  type MomentAuthorId,
  type MomentComment,
  type MomentDraft,
  type MomentPost,
  normalizeMomentMedia,
} from './domain';
import {
  loadMoments,
  removeMomentComment,
  removeMomentPost,
  saveMomentComment,
  saveMomentPost,
} from './repository';

interface MomentsState {
  posts: MomentPost[];
  comments: MomentComment[];
  hydrated: boolean;
  loading: boolean;
  error?: string;
  hydrate: () => Promise<void>;
  publishPost: (draft: MomentDraft, authorId?: MomentAuthorId) => Promise<string>;
  updatePost: (postId: string, draft: MomentDraft, actorId?: MomentAuthorId) => Promise<void>;
  toggleLike: (postId: string, authorId?: MomentAuthorId) => Promise<void>;
  setLike: (postId: string, liked: boolean, authorId: MomentAuthorId) => Promise<void>;
  addComment: (postId: string, text: string, parentCommentId?: string, authorId?: MomentAuthorId) => Promise<string>;
  deleteComment: (commentId: string, actorId?: MomentAuthorId) => Promise<boolean>;
  deletePost: (postId: string, actorId?: MomentAuthorId) => Promise<boolean>;
}

let hydrationPromise: Promise<void> | null = null;

export const useMomentsStore = create<MomentsState>((set, get) => ({
  posts: [],
  comments: [],
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydrationPromise) return hydrationPromise;
    set({ loading: true, error: undefined });
    hydrationPromise = loadMoments()
      .then(({ posts, comments }) => set({ posts, comments, hydrated: true, loading: false }))
      .catch((error) => {
        set({ loading: false, error: error instanceof Error ? error.message : '朋友圈載入失敗' });
        throw error;
      })
      .finally(() => { hydrationPromise = null; });
    return hydrationPromise;
  },

  publishPost: async (draft, authorId = CURRENT_USER_MOMENT_AUTHOR_ID) => {
    const text = draft.text.trim();
    if (!text && draft.media.length === 0) throw new Error('動態不能是空白的');
    const post: MomentPost = {
      id: crypto.randomUUID(), authorId, createdAt: Date.now(), text,
      media: normalizeMomentMedia(draft.media), visibility: draft.visibility,
      likedBy: [], commentIds: [],
    };
    await saveMomentPost(post);
    set((state) => ({ posts: [post, ...state.posts] }));
    return post.id;
  },

  updatePost: async (postId, draft, actorId = CURRENT_USER_MOMENT_AUTHOR_ID) => {
    const post = get().posts.find((item) => item.id === postId);
    if (!post || post.authorId !== actorId) throw new Error('找不到可編輯的動態');
    const text = draft.text.trim();
    if (!text && draft.media.length === 0) throw new Error('動態不能是空白的');
    const next = { ...post, text, media: normalizeMomentMedia(draft.media), visibility: draft.visibility, updatedAt: Date.now() };
    await saveMomentPost(next);
    const retained = new Set([...get().posts.filter((item) => item.id !== postId).flatMap((item) => item.media), ...next.media].map((item) => item.assetId));
    await Promise.all(post.media.map((item) => item.assetId).filter((assetId) => !retained.has(assetId)).map((assetId) => deleteAsset(assetId).catch(() => {})));
    set((state) => ({ posts: state.posts.map((item) => item.id === postId ? next : item) }));
  },

  toggleLike: async (postId, authorId = CURRENT_USER_MOMENT_AUTHOR_ID) => {
    const post = get().posts.find((item) => item.id === postId);
    if (!post) return;
    const next = toggleMomentLike(post, authorId);
    await saveMomentPost(next);
    set((state) => ({ posts: state.posts.map((item) => item.id === postId ? next : item) }));
  },

  setLike: async (postId, liked, authorId) => {
    const post = get().posts.find((item) => item.id === postId);
    if (!post) throw new Error('找不到這條動態');
    const next = setMomentLike(post, authorId, liked);
    if (next === post) return;
    await saveMomentPost(next);
    set((state) => ({ posts: state.posts.map((item) => item.id === postId ? next : item) }));
  },

  addComment: async (postId, value, parentCommentId, authorId = CURRENT_USER_MOMENT_AUTHOR_ID) => {
    const text = value.trim();
    if (!text) throw new Error('留言不能是空白的');
    const post = get().posts.find((item) => item.id === postId);
    if (!post) throw new Error('找不到這條動態');
    const parent = parentCommentId ? get().comments.find((item) => item.id === parentCommentId && item.postId === postId) : undefined;
    const comment: MomentComment = {
      id: crypto.randomUUID(), postId, authorId, text, createdAt: Date.now(),
      ...normalizeReplyTarget(parent),
    };
    const nextPost = { ...post, commentIds: [...post.commentIds, comment.id], updatedAt: Date.now() };
    await saveMomentComment(nextPost, comment);
    set((state) => ({
      posts: state.posts.map((item) => item.id === postId ? nextPost : item),
      comments: [...state.comments, comment],
    }));
    return comment.id;
  },

  deleteComment: async (commentId, actorId = CURRENT_USER_MOMENT_AUTHOR_ID) => {
    const comment = get().comments.find((item) => item.id === commentId);
    if (!comment || (actorId !== CURRENT_USER_MOMENT_AUTHOR_ID && comment.authorId !== actorId)) return false;
    const post = get().posts.find((item) => item.id === comment.postId);
    if (!post) return false;
    const nextPost = { ...post, commentIds: post.commentIds.filter((id) => id !== commentId), updatedAt: Date.now() };
    await removeMomentComment(nextPost, commentId);
    set((state) => ({
      posts: state.posts.map((item) => item.id === post.id ? nextPost : item),
      comments: state.comments.filter((item) => item.id !== commentId),
    }));
    return true;
  },

  deletePost: async (postId, actorId = CURRENT_USER_MOMENT_AUTHOR_ID) => {
    const state = get();
    const post = state.posts.find((item) => item.id === postId);
    if (!post || (actorId !== CURRENT_USER_MOMENT_AUTHOR_ID && post.authorId !== actorId)) return false;
    const commentIds = state.comments.filter((item) => item.postId === postId).map((item) => item.id);
    await removeMomentPost(postId, commentIds);
    const remainingMedia = new Set(state.posts.filter((item) => item.id !== postId).flatMap((item) => item.media.map((media) => media.assetId)));
    await Promise.all(post.media.map((media) => media.assetId).filter((id) => !remainingMedia.has(id)).map((id) => deleteAsset(id).catch(() => {})));
    set((current) => ({
      posts: current.posts.filter((item) => item.id !== postId),
      comments: current.comments.filter((item) => item.postId !== postId),
    }));
    return true;
  },
}));
