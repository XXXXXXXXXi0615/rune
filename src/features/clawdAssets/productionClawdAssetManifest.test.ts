import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAWD_ANIMATION_CATALOG, PRODUCTION_CLAWD_ASSETS, getProductionClawdAsset, resolveProductionClawdAsset, type ResolveProductionClawdInput } from './productionClawdAssetManifest';

const base: ResolveProductionClawdInput = { runtimeState: 'idle', expression: 'idle', interaction: { kind: 'none' }, restState: 'awake', restOwnsPresentation: false, presentationMode: 'free', miniExpanded: false, reducedMotion: false };

describe('production CLAWD asset manifest', () => {
  it('contains only real MIT-cleared vendor SVG assets', () => PRODUCTION_CLAWD_ASSETS.forEach((asset) => {
    expect(asset.src).toContain('/vendor/clawd-pet/pets/'); expect(asset.license).toBe('MIT'); expect(asset.actualType).toBe('svg');
    expect(existsSync(resolve(process.cwd(), 'public/vendor/clawd-pet/pets', asset.fileName))).toBe(true);
  }));
  it.each([
    ['clawd-thinking', 'thinking'], ['clawd-typing', 'working-typing'], ['clawd-groove', 'working-groove'], ['clawd-tool-use', 'working-building'],
    ['clawd-random', 'juggling'], ['clawd-error', 'error'], ['clawd-notification', 'notification'], ['clawd-cleaning-system', 'sweeping'],
  ])('maps runtime %s to %s', (presentation, expected) => expect(resolveProductionClawdAsset({ ...base, runtimePresentationId: presentation, runtimeState: 'working' }).id).toBe(expected));
  it.each([['tap', 'reaction-tap'], ['poke', 'reaction-poke'], ['annoyed', 'reaction-annoyed'], ['flail', 'reaction-flail']] as const)('maps reaction %s', (reaction, expected) => expect(resolveProductionClawdAsset({ ...base, interaction: { kind: 'reaction', reaction, startedAt: 0 } }).id).toBe(expected));
  it('maps mini collapsed, expanded, and alert without changing geometry', () => {
    expect(resolveProductionClawdAsset({ ...base, presentationMode: 'mini-left' }).id).toBe('mini-peek');
    expect(resolveProductionClawdAsset({ ...base, presentationMode: 'mini-right', miniExpanded: true }).id).toBe('mini-idle');
    expect(resolveProductionClawdAsset({ ...base, presentationMode: 'mini-right', miniExpanded: true, runtimeState: 'error' }).id).toBe('mini-alert');
  });
  it('maps rest and reduced motion inside the CLAWD family', () => {
    expect(resolveProductionClawdAsset({ ...base, restOwnsPresentation: true, restState: 'yawning' }).id).toBe('yawning');
    expect(resolveProductionClawdAsset({ ...base, restOwnsPresentation: true, restState: 'sleeping' }).id).toBe('sleeping');
    expect(resolveProductionClawdAsset({ ...base, reducedMotion: true }).id).toBe('static');
  });
  it('normalizes full and mini assets with explicit foot anchors', () => {
    expect(getProductionClawdAsset('idle').normalization.footAnchor).toBeGreaterThan(0);
    expect(getProductionClawdAsset('idle').normalization.scaleY).toBeGreaterThan(2);
    expect(getProductionClawdAsset('sleeping').normalization.scaleY).toBeGreaterThan(2);
    expect(getProductionClawdAsset('mini-peek').mode).toBe('mini');
    expect(getProductionClawdAsset('mini-peek').normalization.scaleY).toBe(1.1);
  });
  it('keeps calibrated full character heights within one companion family', () => {
    const height = (id: Parameters<typeof getProductionClawdAsset>[0], host = 88) => {
      const { normalization } = getProductionClawdAsset(id); return host * (normalization.visibleBounds.bottom - normalization.visibleBounds.top) * normalization.scaleY;
    };
    expect(height('idle')).toBeGreaterThanOrEqual(53);
    expect(height('working-typing')).toBeCloseTo(height('idle'), 5);
    expect(height('notification')).toBeCloseTo(height('idle'), 5);
    expect(height('sleeping')).toBeGreaterThanOrEqual(35);
    expect(height('sleeping')).toBeLessThan(height('idle'));
  });
  it('falls back to CLAWD idle for unavailable presentation IDs', () => expect(resolveProductionClawdAsset({ ...base, runtimePresentationId: 'missing' }).id).toBe('idle'));
  it('never references the legacy checkin-pet or lunaris GIF family', () => PRODUCTION_CLAWD_ASSETS.forEach((asset) => expect(asset.src).not.toMatch(/checkin-pet|assets\/lunaris|\.gif/)));
  it('projects one approved catalog for Settings and the quick palette', () => {
    const productionIds = new Set(PRODUCTION_CLAWD_ASSETS.map((asset) => asset.id));
    expect(CLAWD_ANIMATION_CATALOG.length).toBeGreaterThan(12);
    expect(new Set(CLAWD_ANIMATION_CATALOG.map((entry) => entry.id)).size).toBe(CLAWD_ANIMATION_CATALOG.length);
    expect(CLAWD_ANIMATION_CATALOG.every((entry) => productionIds.has(entry.id))).toBe(true);
    expect(CLAWD_ANIMATION_CATALOG.every((entry) => entry.asset.provenance === 'abderrahimghazali/clawd-pet@b208f0c')).toBe(true);
    expect(new Set(CLAWD_ANIMATION_CATALOG.map((entry) => entry.category))).toEqual(new Set(['daily', 'work', 'reaction', 'mini']));
    expect(CLAWD_ANIMATION_CATALOG.filter((entry) => entry.quickAccess).map((entry) => entry.id)).toEqual(['idle', 'attention', 'reaction-poke', 'reaction-annoyed', 'reaction-flail']);
  });
});
