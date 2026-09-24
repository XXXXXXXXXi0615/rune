import { describe, expect, it } from 'vitest';
import atlasData from '../../../public/pets/jiyi/atlas.json';

interface Atlas {
  frames: Array<{ index: number; empty: boolean }>;
  animations: Record<string, { frames: number[] }>;
}

const atlas = atlasData as Atlas;

describe('Jiyi animation semantics', () => {
  it('uses stable idle frames for work instead of the walking sequence', () => {
    expect(atlas.animations['work-calm'].frames).toEqual(atlas.animations['idle-calm'].frames);
    expect(atlas.animations['work-calm'].frames).not.toEqual(atlas.animations['walk-calm'].frames);
  });

  it('does not reference empty frames from semantic animations', () => {
    const empty = new Set(atlas.frames.filter((frame) => frame.empty).map((frame) => frame.index));
    for (const animation of Object.values(atlas.animations)) {
      expect(animation.frames.some((frame) => empty.has(frame))).toBe(false);
    }
  });
});
