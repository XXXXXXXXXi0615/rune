/**
 * Minimal LRC parser — no dependencies.
 * Supports [mm:ss.xx] timestamps, multi-timestamp lines, and ID tags.
 */

export interface LyricLine {
  time: number; // seconds
  text: string;
}

const TIME_RE = /\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g;
const TAG_RE = /^\[(ti|ar|al|by|offset|length|re|ve):/i;

export function parseLRC(content: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (TAG_RE.test(trimmed)) continue; // skip metadata tags

    const timestamps: Array<{ minutes: number; seconds: number; ms: number }> = [];
    let match: RegExpExecArray | null;
    TIME_RE.lastIndex = 0;
    while ((match = TIME_RE.exec(trimmed)) !== null) {
      timestamps.push({
        minutes: parseInt(match[1], 10),
        seconds: parseInt(match[2], 10),
        ms: match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0,
      });
    }
    if (timestamps.length === 0) continue;

    const text = trimmed.replace(TIME_RE, '').trim();
    if (!text) continue; // skip timestamp-only lines

    for (const ts of timestamps) {
      lines.push({
        time: ts.minutes * 60 + ts.seconds + ts.ms / 1000,
        text,
      });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * Return the index of the last lyric line whose timestamp <= currentTime.
 * Returns -1 if no line has started yet.
 */
export function findCurrentLine(lines: LyricLine[], currentTime: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}
