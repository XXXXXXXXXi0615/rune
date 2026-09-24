import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractiveAttachment, PollState } from '@/features/interactive/types';
import { canManagePoll, canViewPollResults, getVisibleVoterIdentities, migrateLegacyPollCreator } from '@/features/interactive/pollAuthorization';

const { deleteAssetMock, readLegacyMock } = vi.hoisted(() => ({
  deleteAssetMock: vi.fn(async () => undefined),
  readLegacyMock: vi.fn(async () => new Blob(['legacy'], { type: 'image/png' })),
}));
vi.mock('@/store/assets', () => ({ deleteAsset: deleteAssetMock, getAsset: vi.fn(async () => null) }));
vi.mock('@/storage/gachaAssetStorage', () => ({ readGachaImage: readLegacyMock }));

import {
  INTERACTIVE_ASSET_GRACE_MS,
  cancelInteractiveAssetCandidates,
  collectReferencedInteractiveAssetIds,
  loadInteractiveAssetCandidates,
  markInteractiveAssetCandidates,
  runInteractiveAssetCleanup,
  verifyLegacyFallbackReadable,
} from '@/storage/interactiveAssetLifecycle';

const state = (patch: Partial<PollState> = {}): PollState => ({ pollId: 'p', creatorIdentityId: 'a', question: 'Q', options: [{ id: 'o', label: 'O', votes: 1, imageAssetId: 'poll-option' }], coverAssetId: 'poll-cover', multiple: false, anonymous: false, votedOptionIds: [], votesByIdentity: { b: { optionIds: ['o'], createdAt: 1, updatedAt: 1 } }, resultVisibility: 'creator-only', ...patch });

describe('poll identity authorization', () => {
  it('isolates creator-only results and management', () => {
    expect(canViewPollResults(state(), { currentViewerIdentityId: 'b' })).toBe(false);
    expect(canManagePoll(state(), { currentViewerIdentityId: 'b' })).toBe(false);
    expect(canViewPollResults(state(), { currentViewerIdentityId: 'a' })).toBe(true);
    expect(canManagePoll(state(), { currentViewerIdentityId: 'a' })).toBe(true);
  });
  it('never exposes anonymous voter identities', () => {
    expect(getVisibleVoterIdentities(state({ anonymous: true }), { currentViewerIdentityId: 'a' })).toBeUndefined();
  });
  it('migrates a legacy creator from immutable sender identity', () => {
    const attachment: InteractiveAttachment = { version: 1, kind: 'poll', meta: { gameId: 'p', createdAt: 1, startedBy: '' }, state: state({ creatorIdentityId: undefined }) };
    expect((migrateLegacyPollCreator(attachment, 'sender-a').state as PollState).creatorIdentityId).toBe('sender-a');
  });
});

describe('interactive asset lifecycle', () => {
  beforeEach(() => { localStorage.clear(); deleteAssetMock.mockClear(); readLegacyMock.mockClear(); });
  it('collects pools, archived pools, items, history, undo and poll/chat assets', () => {
    const refs=collectReferencedInteractiveAssetIds({pools:[{coverAssetId:'pool-cover'} as never],items:[{imageAssetId:'item'} as never],drawRecords:[{imageAssetIdSnapshot:'history'} as never],undoSnapshots:[{items:[{imageAssetId:'undo'} as never]}],messages:[{type:'text',interactive:{kind:'poll',state:state(),meta:{},version:1},assetId:'chat'} as never],legacyAssetIds:['legacy']});
    expect([...refs]).toEqual(expect.arrayContaining(['pool-cover','item','history','undo','poll-cover','poll-option','chat','legacy']));
  });
  it('cancels candidates after Undo and after a new reference', async () => {
    markInteractiveAssetCandidates(['undo'], 'delete', 0); cancelInteractiveAssetCandidates(['undo']); expect(loadInteractiveAssetCandidates()).toEqual([]);
    markInteractiveAssetCandidates(['reref'], 'delete', 0); await runInteractiveAssetCleanup({legacyAssetIds:['reref']},INTERACTIVE_ASSET_GRACE_MS+1); expect(loadInteractiveAssetCandidates()).toEqual([]); expect(deleteAssetMock).not.toHaveBeenCalled();
  });
  it('retains historical assets, removes true orphans after grace, and is idempotent', async () => {
    markInteractiveAssetCandidates(['history','orphan'],'delete',0);
    const first=await runInteractiveAssetCleanup({drawRecords:[{imageAssetIdSnapshot:'history'} as never]},INTERACTIVE_ASSET_GRACE_MS+1);
    expect(first.removed).toEqual(['orphan']); expect(deleteAssetMock).toHaveBeenCalledTimes(1);
    const second=await runInteractiveAssetCleanup({},INTERACTIVE_ASSET_GRACE_MS+2); expect(second.removed).toEqual([]); expect(deleteAssetMock).toHaveBeenCalledTimes(1);
  });
  it('keeps legacy fallback readable', async () => { expect(await verifyLegacyFallbackReadable('legacy')).toBe(true); });
});
