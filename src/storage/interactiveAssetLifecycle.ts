import type { GachaDrawRecord, GachaItem, GachaPool, Message } from '@/types';
import { deleteAsset, getAsset } from '@/store/assets';
import { readGachaImage } from './gachaAssetStorage';

export const INTERACTIVE_ASSET_GRACE_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_KEY = 'lunartide-interactive-asset-cleanup-v1';

export interface InteractiveAssetCandidate {
  assetId: string;
  candidateSince: number;
  eligibleAfter: number;
  reason: string;
}

export interface InteractiveAssetReferenceSource {
  pools?: GachaPool[];
  items?: GachaItem[];
  drawRecords?: GachaDrawRecord[];
  undoSnapshots?: Array<{ pools?: GachaPool[]; items?: GachaItem[] }>;
  messages?: Message[];
  legacyAssetIds?: Iterable<string>;
}

function addAssetLikeValues(value: unknown, refs: Set<string>, seen = new WeakSet<object>()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value as object)) return;
  seen.add(value as object);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'assetId' || key.endsWith('AssetId') || key.endsWith('AssetIdSnapshot')) && typeof nested === 'string') refs.add(nested);
    else if (Array.isArray(nested)) nested.forEach((entry) => addAssetLikeValues(entry, refs, seen));
    else addAssetLikeValues(nested, refs, seen);
  }
}

export function collectReferencedInteractiveAssetIds(source: InteractiveAssetReferenceSource): Set<string> {
  const refs = new Set<string>();
  source.pools?.forEach((pool) => addAssetLikeValues(pool, refs));
  source.items?.forEach((item) => addAssetLikeValues(item, refs));
  source.drawRecords?.forEach((record) => addAssetLikeValues(record, refs));
  source.undoSnapshots?.forEach((snapshot) => addAssetLikeValues(snapshot, refs));
  source.messages?.forEach((message) => addAssetLikeValues(message, refs));
  if (source.legacyAssetIds) for (const id of source.legacyAssetIds) refs.add(id);
  return refs;
}

export function loadInteractiveAssetCandidates(): InteractiveAssetCandidate[] {
  try { return JSON.parse(localStorage.getItem(CANDIDATE_KEY) || '[]') as InteractiveAssetCandidate[]; }
  catch { return []; }
}

function persistCandidates(candidates: InteractiveAssetCandidate[]) {
  try { localStorage.setItem(CANDIDATE_KEY, JSON.stringify(candidates)); } catch { /* cleanup must never block app startup */ }
}

export function markInteractiveAssetCandidates(assetIds: Iterable<string>, reason: string, now = Date.now()) {
  const byId = new Map(loadInteractiveAssetCandidates().map((candidate) => [candidate.assetId, candidate]));
  for (const assetId of assetIds) if (!byId.has(assetId)) byId.set(assetId, { assetId, candidateSince: now, eligibleAfter: now + INTERACTIVE_ASSET_GRACE_MS, reason });
  persistCandidates([...byId.values()]);
}

export function cancelInteractiveAssetCandidates(assetIds: Iterable<string>) {
  const ids = new Set(assetIds);
  persistCandidates(loadInteractiveAssetCandidates().filter((candidate) => !ids.has(candidate.assetId)));
}

export async function runInteractiveAssetCleanup(source: InteractiveAssetReferenceSource, now = Date.now()): Promise<{ removed: string[]; retained: string[] }> {
  const referenced = collectReferencedInteractiveAssetIds(source);
  const retained: InteractiveAssetCandidate[] = [];
  const removed: string[] = [];
  for (const candidate of loadInteractiveAssetCandidates()) {
    if (referenced.has(candidate.assetId)) continue;
    if (candidate.eligibleAfter > now) { retained.push(candidate); continue; }
    try { await deleteAsset(candidate.assetId); removed.push(candidate.assetId); }
    catch { retained.push(candidate); }
  }
  persistCandidates(retained);
  return { removed, retained: retained.map((candidate) => candidate.assetId) };
}

export async function verifyLegacyFallbackReadable(assetId: string) {
  return Boolean(await readGachaImage(assetId).catch(() => null));
}

export async function verifySharedAsset(assetId: string) {
  return Boolean(await getAsset(assetId).catch(() => null));
}
