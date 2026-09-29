/** Phase 1A map-local presentation contract. Coordinates use the 941×1672 artwork. */
export const RUNE_WORLD_ACTOR = {
  id: 'rune',
  frame: { width: 672, height: 768 },
  anchor: { x: 0.488095, y: 0.903646 },
  baselineY: 694,
  idle: { direction: 'down', frameIndex: 0, directions: ['down', 'up', 'left', 'right'] },
  walk: { framesPerDirection: 4, fps: 8 },
  spawn: {
    // The open path southeast of the fountain, away from the six route hotspots.
    worldX: 480,
    worldY: 1020,
    x: 480 / 941,
    y: 1020 / 1672,
  },
  // Phase 1B.1 visual calibration: 0.14, 0.15, 0.16 compared at 390px and 1440px.
  scale: 0.16,
  renderedWorldWidth: 672 * 0.16,
  renderedWorldHeight: 768 * 0.16,
} as const;
