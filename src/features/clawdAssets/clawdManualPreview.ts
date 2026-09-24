export const CLAWD_PREVIEW_EVENT = 'lunartide:clawd-preview';

export interface ClawdPreviewRequest { assetId?: string; durationMs?: number }

export function requestClawdManualPreview(assetId?: string, durationMs?: number) {
  window.dispatchEvent(new CustomEvent<ClawdPreviewRequest>(CLAWD_PREVIEW_EVENT, { detail: { assetId, durationMs } }));
}
