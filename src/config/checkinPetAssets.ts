import { getProductionClawdAsset, type ProductionClawdAssetId } from '@/features/clawdAssets/productionClawdAssetManifest';

export type PetExpressionId =
  | 'idle' | 'waving' | 'waiting' | 'running-left' | 'running-right'
  | 'running' | 'failed' | 'jumping' | 'look-left' | 'look-right' | 'review';

export interface PetExpressionManifestItem {
  id: PetExpressionId;
  label: string;
  src: string;
  productionAssetId: ProductionClawdAssetId;
}

const EXPRESSION_TO_PRODUCTION: Record<PetExpressionId, ProductionClawdAssetId> = {
  idle: 'idle',
  waving: 'reaction-tap',
  waiting: 'idle',
  'running-left': 'idle',
  'running-right': 'idle',
  running: 'idle',
  review: 'attention',
  failed: 'error',
  jumping: 'attention',
  'look-left': 'idle',
  'look-right': 'idle',
};

const EXPRESSION_LABELS: Record<PetExpressionId, string> = {
  idle: '待機',
  waving: '打招呼',
  waiting: '等待',
  'running-left': '向左跑',
  'running-right': '向右跑',
  running: '跑步',
  review: '回顧',
  failed: '失落',
  jumping: '跳躍',
  'look-left': '向左看',
  'look-right': '向右看',
};

function expressionSrc(id: PetExpressionId): string {
  return getProductionClawdAsset(EXPRESSION_TO_PRODUCTION[id]).src;
}

const PALETTE_MANUAL_SAFE: PetExpressionId[] = ['idle', 'jumping', 'waving', 'failed', 'review'];

export const COMPANION_PET_EXPRESSION_MANIFEST: PetExpressionManifestItem[] =
  PALETTE_MANUAL_SAFE.map((id) => ({
    id,
    label: EXPRESSION_LABELS[id],
    src: expressionSrc(id),
    productionAssetId: EXPRESSION_TO_PRODUCTION[id],
  }));

export const COMPANION_PET_REDUCED_MOTION_ASSET = getProductionClawdAsset('static').src;

export function getExpressionAssetSrc(id: PetExpressionId): string {
  return expressionSrc(id);
}
