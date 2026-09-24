import { CLAWD_MANIFEST, type ClawdAsset } from '@/data/clawdAssetManifest';
import type { PetPresentationCategory } from '../types';

export interface ResolvedClawdAsset extends ClawdAsset {
  animated: boolean;
  hash?: string;
  source: 'lunartide' | 'upstream';
  presentationCategory: PetPresentationCategory;
}

function localCategory(asset: ClawdAsset): PetPresentationCategory {
  if (asset.category === 'working') return 'work';
  if (asset.category === 'emotion' || asset.category === 'sleep') return 'emotion';
  if (asset.category === 'action') return 'movement';
  if (asset.category === 'seasonal') return 'special';
  return 'daily';
}

const resolved = new Map<string, ResolvedClawdAsset>();
for (const asset of CLAWD_MANIFEST) {
  resolved.set(asset.id, {
    ...asset,
    animated: asset.format === 'gif',
    source: 'lunartide',
    presentationCategory: localCategory(asset),
  });
}

export const CLAWD_OVERRIDE_IDS = CLAWD_MANIFEST.map((asset) => asset.id).sort();
export const CLAWD_RESOLVED_ASSETS: readonly ResolvedClawdAsset[] = [...resolved.values()].sort((a, b) => a.id.localeCompare(b.id));
export const CLAWD_RESOLVED_BY_ID: ReadonlyMap<string, ResolvedClawdAsset> = resolved;

export function getResolvedClawdAsset(id: string): ResolvedClawdAsset | undefined {
  return CLAWD_RESOLVED_BY_ID.get(id);
}