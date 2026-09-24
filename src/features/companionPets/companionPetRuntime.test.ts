import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPANION_PET_PACKS } from './companionPetPacks';
import { resolveCompanionPetPresentation } from './companionPetRuntime';

describe('generic companion pet runtime adapter', () => {
  it('keeps CLAWD on its fallback unless a manual visual is selected', () => {
    const automatic = resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.clawd, semanticVisualId: 'thinking' });
    expect(automatic.visual.id).toBe('clawd-idle');
    const manual = resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.clawd, semanticVisualId: 'thinking', manualPreviewId: 'clawd-thinking' });
    expect(manual.visual.id).toBe('clawd-thinking');
  });

  it('resolves logos semantic and movement mappings from pack metadata', () => {
    expect(resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.logos, semanticVisualId: 'error' }).visual.id).toBe('logos-failed');
    expect(resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.logos, semanticVisualId: 'idle', movementDirection: 'left' }).visual.id).toBe('logos-running-left');
    expect(resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.logos, semanticVisualId: 'mini-peek' }).visual.id).toBe('logos-idle');
  });

  it('derives preview and deterministic failure fallback from pack metadata', () => {
    const preview = resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.logos, semanticVisualId: 'idle', manualPreviewId: 'logos-waving' });
    expect(preview.visual.id).toBe('logos-waving');
    const failed = resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.logos, semanticVisualId: 'error', assetFailed: true });
    expect(failed.visual.id).toBe(COMPANION_PET_PACKS.logos.fallbackId);
  });

  it('keeps quick palette entries entirely inside pack definitions', () => {
    expect(COMPANION_PET_PACKS.clawd.visuals.filter((visual) => visual.quickAccess).map((visual) => visual.id)).toEqual(['clawd-idle', 'clawd-static-base', 'clawd-mini-clawd', 'mini-crab-typing', 'clawd-idle-living', 'clawd-idle-reading', 'clawd-sleeping', 'clawd-bubble']);
    expect(COMPANION_PET_PACKS.logos.visuals.filter((visual) => visual.quickAccess).map((visual) => visual.id)).toEqual(['logos-idle', 'logos-waving', 'logos-jumping', 'logos-failed', 'logos-waiting']);
  });

  it('keeps named pack checks out of CompanionPetHost', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/pet/CompanionPetHost.tsx'), 'utf8');
    expect(source).not.toMatch(/selectedPackId\s*(?:===|!==)\s*['"](?:clawd|logos)['"]/);
    expect(source).not.toMatch(/['"](?:clawd|logos)['"]\s*(?:===|!==)\s*selectedPackId/);
    expect(source).not.toMatch(/useAgentActivityStore|clawdRuntimeController|idleBehaviorPlanner|ClawdRestController|setInterval/);
    expect(source).toContain('const LONG_PRESS_MS = 550');
    expect(source).toContain('longPressRef.current = window.setTimeout');
    expect(source).toContain('data-timer-owner="none"');
  });
});
