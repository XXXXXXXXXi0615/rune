import type { ToolDefinition } from '@/ai/types';
import { getAsset } from '@/store/assets';
import { selectAgentProfile, useAppStore } from '@/store/useAppStore';
import type { MomentsAgentPermissions } from '@/types';
import { selectChronologicalMomentPosts, selectMomentComments } from './selectors';
import { useMomentsStore } from './store';
import type { MomentAuthorId, MomentPost, MomentVisibility } from './domain';

export const DEFAULT_MOMENTS_AGENT_PERMISSIONS: MomentsAgentPermissions = {
  momentsRead: false,
  momentsWrite: false,
  momentsInteract: false,
};

export const MOMENTS_AGENT_ACTIONS = ['list', 'read', 'create', 'like', 'unlike', 'comment', 'reply'] as const;
export type MomentsAgentAction = typeof MOMENTS_AGENT_ACTIONS[number];

export interface MomentsAgentToolInput {
  action: MomentsAgentAction;
  postId?: string;
  commentId?: string;
  text?: string;
  mediaAssetIds?: string[];
  visibility?: MomentVisibility;
  limit?: number;
  before?: number;
  actorId?: MomentAuthorId;
}

export type MomentsAgentToolResult =
  | { ok: true; action: MomentsAgentAction; [key: string]: unknown }
  | { ok: false; code: 'permission_denied' | 'invalid_input' | 'not_found'; message: string };

export const MOMENTS_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'moments',
    description: 'Read or participate in the local Moments stream. Operations obey explicit Moments permissions; only-me posts are user-only.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: MOMENTS_AGENT_ACTIONS },
        postId: { type: 'string' }, commentId: { type: 'string' }, text: { type: 'string' },
        mediaAssetIds: { type: 'array', items: { type: 'string' }, maxItems: 9 },
        visibility: { type: 'string', enum: ['everyone'] },
        limit: { type: 'number', minimum: 1, maximum: 50 }, before: { type: 'number' }, actorId: { type: 'string' },
      },
      required: ['action'],
    },
  },
};

function currentAgent() {
  const profile = selectAgentProfile(useAppStore.getState().partner);
  return { actorId: `agent:${profile.id}` as MomentAuthorId, displayName: profile.displayName };
}

function resolveActor(actorId: MomentAuthorId) {
  const state = useAppStore.getState();
  const agent = currentAgent();
  return actorId === agent.actorId
    ? { actorId, displayName: agent.displayName }
    : { actorId, displayName: state.profile.displayName || state.userName || '使用者' };
}

function permissions(): MomentsAgentPermissions {
  return useAppStore.getState().momentsAgentPermissions ?? DEFAULT_MOMENTS_AGENT_PERMISSIONS;
}

function denied(capability: keyof MomentsAgentPermissions): MomentsAgentToolResult | null {
  return permissions()[capability]
    ? null
    : { ok: false, code: 'permission_denied', message: `${capability} is not permitted` };
}

function summarizePost(post: MomentPost, comments: ReturnType<typeof useMomentsStore.getState>['comments']) {
  return {
    id: post.id,
    actor: resolveActor(post.authorId),
    textSummary: post.text.length > 160 ? `${post.text.slice(0, 159)}…` : post.text,
    mediaCount: post.media.length,
    createdAt: post.createdAt,
    likeCount: post.likedBy.length,
    commentCount: selectMomentComments(post, comments).length,
  };
}

export async function executeMomentsAgentTool(input: MomentsAgentToolInput): Promise<MomentsAgentToolResult> {
  if (!MOMENTS_AGENT_ACTIONS.includes(input.action)) return { ok: false, code: 'invalid_input', message: 'unknown Moments action' };
  const readActions: MomentsAgentAction[] = ['list', 'read'];
  const interactActions: MomentsAgentAction[] = ['like', 'unlike', 'comment', 'reply'];
  const permissionError = input.action === 'create'
    ? denied('momentsWrite')
    : readActions.includes(input.action)
      ? denied('momentsRead')
      : interactActions.includes(input.action)
        ? denied('momentsInteract')
        : null;
  if (permissionError) return permissionError;

  const store = useMomentsStore.getState();
  await store.hydrate();
  const state = useMomentsStore.getState();
  const agent = currentAgent();
  const visiblePosts = selectChronologicalMomentPosts(state.posts).filter((post) => post.visibility === 'everyone');

  if (input.action === 'list') {
    const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 10)));
    const posts = visiblePosts
      .filter((post) => input.before == null || post.createdAt < input.before)
      .filter((post) => !input.actorId || post.authorId === input.actorId)
      .slice(0, limit)
      .map((post) => summarizePost(post, state.comments));
    return { ok: true, action: input.action, posts };
  }

  if (input.action === 'create') {
    const text = input.text?.trim() ?? '';
    const mediaIds = [...new Set(input.mediaAssetIds ?? [])];
    if (!text && mediaIds.length === 0) return { ok: false, code: 'invalid_input', message: 'text and media cannot both be empty' };
    if (mediaIds.length > 9) return { ok: false, code: 'invalid_input', message: 'at most 9 media assets are allowed' };
    if (input.visibility && input.visibility !== 'everyone') return { ok: false, code: 'invalid_input', message: 'Agent may only create everyone-visible posts in Phase 1C' };
    for (const assetId of mediaIds) if (!await getAsset(assetId)) return { ok: false, code: 'invalid_input', message: `media asset not found: ${assetId}` };
    const postId = await store.publishPost({ text, media: mediaIds.map((assetId, order) => ({ id: crypto.randomUUID(), assetId, order })), visibility: 'everyone' }, agent.actorId);
    return { ok: true, action: input.action, postId, actor: agent };
  }

  const post = visiblePosts.find((item) => item.id === input.postId);
  if (!post) return { ok: false, code: 'not_found', message: 'Moment not found or not visible to Current Agent' };

  if (input.action === 'read') {
    const comments = selectMomentComments(post, state.comments);
    return { ok: true, action: input.action, post: {
      ...summarizePost(post, state.comments), text: post.text, updatedAt: post.updatedAt,
      media: post.media.map(({ assetId }) => ({ assetId })),
      likes: post.likedBy.map(resolveActor),
      comments: comments.map((comment) => ({ ...comment, actor: resolveActor(comment.authorId) })),
    } };
  }

  if (input.action === 'like' || input.action === 'unlike') {
    await store.setLike(post.id, input.action === 'like', agent.actorId);
    return { ok: true, action: input.action, postId: post.id, actor: agent };
  }

  const text = input.text?.trim() ?? '';
  if (!text) return { ok: false, code: 'invalid_input', message: 'comment text is required' };
  if (input.action === 'comment') {
    const commentId = await store.addComment(post.id, text, undefined, agent.actorId);
    return { ok: true, action: input.action, postId: post.id, commentId, actor: agent };
  }

  const parent = state.comments.find((comment) => comment.id === input.commentId && comment.postId === post.id);
  if (!parent) return { ok: false, code: 'not_found', message: 'comment not found' };
  const commentId = await store.addComment(post.id, text, parent.id, agent.actorId);
  return { ok: true, action: input.action, postId: post.id, commentId, actor: agent };
}

export interface MomentsAgentDevHarness {
  invoke: (input: MomentsAgentToolInput) => Promise<MomentsAgentToolResult>;
}

export function installMomentsAgentDevHarness(isDev = import.meta.env.DEV): void {
  if (!isDev || typeof window === 'undefined') return;
  window.__LUNARTIDE_MOMENTS_AGENT_TEST__ = { invoke: executeMomentsAgentTool };
}
