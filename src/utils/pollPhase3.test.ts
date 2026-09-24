import { describe, expect, it } from 'vitest';
import { reduceInteractiveAttachment } from '@/features/interactive/InteractiveToolRegistry';
import type { InteractiveAttachment, PollState } from '@/features/interactive/types';

const poll = (patch: Partial<PollState> = {}): InteractiveAttachment => ({
  version: 2, kind: 'poll', meta: { gameId: 'poll-1', createdAt: 1, startedBy: 'me' },
  state: { pollId: 'poll-1', question: '選哪個？', options: [{ id: 'a', label: 'A', votes: 0 }, { id: 'b', label: 'B', votes: 0 }, { id: 'c', label: 'C', votes: 0 }], multiple: false, votedOptionIds: [], votesByIdentity: {}, allowVoteChanges: true, ...patch },
});

describe('advanced poll reducer', () => {
  it('updates one message state and enforces multiple choice limits', () => {
    let state = poll({ multiple: true, multipleLimit: 2 });
    state = reduceInteractiveAttachment(state, { type: 'poll_vote', optionId: 'a', identityId: 'me', now: 10 });
    state = reduceInteractiveAttachment(state, { type: 'poll_vote', optionId: 'b', identityId: 'me', now: 11 });
    const blocked = reduceInteractiveAttachment(state, { type: 'poll_vote', optionId: 'c', identityId: 'me', now: 12 });
    expect((blocked.state as PollState).votedOptionIds).toEqual(['a', 'b']);
  });

  it('prevents duplicate identity votes when changes are disabled', () => {
    let state = poll({ allowVoteChanges: false });
    state = reduceInteractiveAttachment(state, { type: 'poll_vote', optionId: 'a', identityId: 'same-user', now: 10 });
    state = reduceInteractiveAttachment(state, { type: 'poll_vote', optionId: 'b', identityId: 'same-user', now: 11 });
    expect((state.state as PollState).votesByIdentity?.['same-user']?.optionIds).toEqual(['a']);
  });

  it('blocks voting after expiry and respects AI participation timing', () => {
    const expired = poll({ expiresAt: 9 });
    expect(reduceInteractiveAttachment(expired, { type: 'poll_vote', optionId: 'a', now: 10 })).toBe(expired);
    const withAi = reduceInteractiveAttachment(poll({ aiParticipation: true, aiVoteTiming: 'after-user' }), { type: 'poll_vote', optionId: 'b', identityId: 'me', now: 10 });
    expect((withAi.state as PollState).votesByIdentity?.['ai-lunaris']?.optionIds).toEqual(['a']);
  });
});
