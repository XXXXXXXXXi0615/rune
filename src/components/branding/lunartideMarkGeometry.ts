/**
 * The sole geometry source for the compact Lunartide mark.
 * Public SVG assets are generated from this module by scripts/sync-lunartide-mark.mjs.
 */
export const LUNARTIDE_MARK_VIEWBOX = '0 0 64 64';

export const LUNARTIDE_MARK_PATHS = {
  leftSurface: 'M31.5 8C18 8 9 17.6 9 31.5S18 55 31.5 55c6.3 0 11-2.4 14.5-6.7-7.5 1.7-14.9-1.6-18.7-7.8-3.9-6.4-2.1-14.7 4.1-19 4.6-3 10.3-3.2 15-1-3.6-7.8-8.6-12.5-14.9-12.5Z',
  rightSurface: 'M32.5 56C46 56 55 46.4 55 32.5S46 9 32.5 9C26.2 9 21.5 11.4 18 15.7c7.5-1.7 14.9 1.6 18.7 7.8 3.9 6.4 2.1 14.7-4.1 19-4.6 3-10.3 3.2-15 1 3.6 7.8 8.6 12.5 14.9 12.5Z',
  leftOutline: 'M31.5 8C18 8 9 17.6 9 31.5S18 55 31.5 55c6.3 0 11-2.4 14.5-6.7',
  rightOutline: 'M32.5 56C46 56 55 46.4 55 32.5S46 9 32.5 9C26.2 9 21.5 11.4 18 15.7',
  leftFlow: 'M46.4 20.5c-6.7-2.2-13.4.2-17.2 6.3-3.9 6.2-1.7 14.4 4.6 18.1',
  rightFlow: 'M17.6 43.5c6.7 2.2 13.4-.2 17.2-6.3 3.9-6.2 1.7-14.4-4.6-18.1',
  centerCrescent: 'M34.2 18.1c-8.4 2.8-12.2 12.9-8.3 20.8 3.8 7.8 13 11.4 20.8 7.7-5.9 6.2-15.9 6.5-22.4.9-7.8-6.7-8.8-18.4-2.1-26.2 3.2-3.7 7.5-5.4 12-3.2Z',
} as const;

export const LUNARTIDE_MARK_NODES = {
  left: { cx: 17.5, cy: 25, r: 3.1 },
  right: { cx: 46.5, cy: 39, r: 3.1 },
} as const;
