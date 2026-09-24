import type { InteractiveAttachment, PollState } from './types';

export interface PollAuthorizationContext {
  currentViewerIdentityId?: string;
  messageSenderIdentityId?: string;
  now?: number;
}

export function migrateLegacyPollCreator(
  attachment: InteractiveAttachment,
  messageSenderIdentityId?: string,
): InteractiveAttachment {
  if (attachment.kind !== 'poll') return attachment;
  const state = attachment.state as PollState;
  if (state.creatorIdentityId) return attachment;
  const creatorIdentityId = messageSenderIdentityId || attachment.meta.startedBy || 'legacy-unknown';
  return { ...attachment, state: { ...state, creatorIdentityId } };
}

function creatorId(state: PollState, context: PollAuthorizationContext) {
  return state.creatorIdentityId || context.messageSenderIdentityId;
}

export function canViewPollResults(state: PollState, context: PollAuthorizationContext): boolean {
  if (state.resultVisibility === 'creator-only') {
    const creator = creatorId(state, context);
    return Boolean(creator && context.currentViewerIdentityId === creator);
  }
  if (state.resultVisibility === 'after-close') {
    return Boolean(state.expiresAt && (context.now ?? Date.now()) >= state.expiresAt);
  }
  return true;
}

export function canManagePoll(state: PollState, context: PollAuthorizationContext): boolean {
  const creator = creatorId(state, context);
  return Boolean(creator && context.currentViewerIdentityId === creator);
}

export function canVoteInPoll(state: PollState, context: PollAuthorizationContext): boolean {
  if (!context.currentViewerIdentityId) return false;
  return !(state.expiresAt && (context.now ?? Date.now()) >= state.expiresAt);
}

export function getVisiblePollVotes(state: PollState, context: PollAuthorizationContext) {
  if (!canViewPollResults(state, context)) return undefined;
  return state.options.map(({ id, votes }) => ({ optionId: id, votes }));
}

export function getVisibleVoterIdentities(state: PollState, context: PollAuthorizationContext) {
  if (state.anonymous || !canManagePoll(state, context)) return undefined;
  return Object.keys(state.votesByIdentity || {});
}
