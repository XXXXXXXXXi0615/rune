/**
 * TIDEWATCH — canonical grapheme-cluster counter.
 *
 * Uses Intl.Segmenter with granularity='grapheme' to correctly count
 * CJK characters, combined emoji (e.g. skin-tone modifiers), and
 * multi-codepoint grapheme clusters.
 *
 * Falls back to string.length when Intl.Segmenter is unavailable (SSR,
 * very old browsers) — this is a graceful degradation, not a canonical path.
 */

let sharedSegmenter: Intl.Segmenter | null = null;

function getSegmenter(): Intl.Segmenter | null {
  if (sharedSegmenter) return sharedSegmenter;
  try {
    sharedSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return sharedSegmenter;
  } catch {
    return null;
  }
}

/**
 * Count grapheme clusters in a string.
 *
 * Pure whitespace runs (spaces, tabs, newlines) are counted as-is.
 * This matches the contract: "ignore pure whitespace where appropriate"
 * — callers who want to exclude whitespace should strip before calling.
 */
export function countWritingGraphemes(text: string): number {
  if (!text) return 0;
  const segmenter = getSegmenter();
  if (!segmenter) return text.length;

  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    void segment; // segment is the grapheme string, we just count
    count++;
  }
  return count;
}

/**
 * Count grapheme clusters, ignoring pure-whitespace segments.
 */
export function countNonWhitespaceGraphemes(text: string): number {
  if (!text) return 0;
  const segmenter = getSegmenter();
  if (!segmenter) {
    // Strip all whitespace characters and count remaining
    return text.replace(/\s/g, '').length;
  }

  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (!/^\s+$/.test(segment)) count++;
  }
  return count;
}
