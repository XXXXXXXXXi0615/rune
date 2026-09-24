import { describe, expect, it } from 'vitest';
import { CLAWD_CAPABILITY_MANIFEST } from './clawdManifest';

describe('CLAWD presentation identity', () => {
  it('keeps presentation IDs unique and duplicate-looking runtime assets semantically distinct', () => {
    const manual = CLAWD_CAPABILITY_MANIFEST.presentations.filter((item) => item.availableForManual);
    const renamedCount = manual.filter((item) => item.displayName !== item.label).length;
    console.info(`[Desktop Pet Phase 2.4] localized presentation names: ${renamedCount}`);
    expect(new Set(manual.map((item) => item.id)).size).toBe(manual.length);
    expect(manual).toHaveLength(55);
    expect(manual.find((item) => item.id === 'clawd-idle')).toMatchObject({ renderer: 'lunaris-animation', assetId: 'idle' });
    expect(manual.find((item) => item.id === 'clawd-error-runtime')).toMatchObject({ renderer: 'lunaris-animation', assetId: 'error' });
    expect(manual.find((item) => item.id === 'clawd-happy')).toMatchObject({ renderer: 'clawd-asset', assetId: 'clawd-happy' });
  });

  it('provides localized user-facing names and normalized library categories', () => {
    const manual = CLAWD_CAPABILITY_MANIFEST.presentations.filter((item) => item.availableForManual);
    expect(manual.every((item) => item.displayName && !/^\d+$/.test(item.displayName))).toBe(true);
    expect(manual.find((item) => item.id === 'clawd-happy')?.displayName).toBe('開心');
    expect(manual.find((item) => item.id === 'clawd-crafting')?.displayName).toBe('製作中');
    expect(new Set(manual.map((item) => item.libraryCategory))).toEqual(new Set(['daily', 'work', 'emotion', 'activity', 'movement', 'special']));
  });
});
