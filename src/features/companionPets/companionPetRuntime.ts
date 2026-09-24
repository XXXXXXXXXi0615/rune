import type { CompanionPetPack, CompanionVisual } from './companionPetPacks';

export interface ResolveCompanionPetPresentationInput {
  pack: CompanionPetPack;
  semanticVisualId: string;
  movementDirection?: 'left' | 'right' | 'neutral';
  manualPreviewId?: string | null;
  assetFailed?: boolean;
}

export interface CompanionPetPresentation {
  visual: CompanionVisual;
  automaticVisual: CompanionVisual;
  usedFallback: boolean;
}

function findVisual(pack: CompanionPetPack, id: string | undefined): CompanionVisual | undefined {
  return id ? pack.visuals.find((visual) => visual.id === id) : undefined;
}

export function resolveCompanionPetPresentation({
  pack,
  semanticVisualId,
  movementDirection = 'neutral',
  manualPreviewId,
  assetFailed = false,
}: ResolveCompanionPetPresentationInput): CompanionPetPresentation {
  const movementId = movementDirection === 'neutral' ? undefined : pack.runtime.movementMappings[movementDirection];
  const mappedId = movementId ?? pack.runtime.semanticMappings[semanticVisualId] ?? semanticVisualId;
  const fallback = findVisual(pack, String(pack.fallbackId)) ?? pack.visuals[0];
  const automaticVisual = findVisual(pack, String(mappedId)) ?? fallback;
  const previewVisual = findVisual(pack, manualPreviewId ?? undefined);
  return {
    visual: assetFailed ? fallback : previewVisual ?? automaticVisual,
    automaticVisual,
    usedFallback: assetFailed || automaticVisual === fallback && String(mappedId) !== String(pack.fallbackId),
  };
}
