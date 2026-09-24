export type MoonReadBlock =
  | { type: 'paragraph'; text: string; stableBlockId: string }
  | { type: 'heading'; text: string; stableBlockId: string }
  | { type: 'image'; src: string; alt: string; stableBlockId: string };
type RawMoonReadBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'image'; src: string; alt: string };

export const MOONREAD_PARSER_VERSION = 2;

export function hashMoonReadText(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableBlockId(type: MoonReadBlock['type'], value: string, occurrence: number): string {
  return `${type}-${hashMoonReadText(value)}-${occurrence}`;
}

const PLACEHOLDER_RE = /(?:placeholder|spacer|blank|pixel|transparent|loading)/i;

/** Join CJK hard-wrapped lines; only a truly empty line creates a paragraph. */
export function normalizeTextBlocks(source: string, markdown = false): MoonReadBlock[] {
  const clean = source.replace(/\r\n?/g, '\n').replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const seen = new Map<string, number>();
  return clean.split(/\n[\t ]*\n+/).map((raw) => raw.trim()).filter(Boolean).map((raw) => {
    const heading = markdown && /^(#{1,6})\s+/.test(raw);
    let text = raw.replace(/^#{1,6}\s+/, '');
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    text = lines.reduce((joined, line, index) => {
      if (!index) return line;
      const prev = joined.at(-1) || '';
      const cjkJoin = /[\u3000-\u9fff]$/.test(prev) && /^[\u3000-\u9fff]/.test(line);
      return `${joined}${cjkJoin ? '' : ' '}${line}`;
    }, '');
    const type = heading ? 'heading' : 'paragraph';
    const key = `${type}:${text}`;
    const occurrence = seen.get(key) || 0;
    seen.set(key, occurrence + 1);
    return { type, text, stableBlockId: stableBlockId(type, text, occurrence) } as MoonReadBlock;
  });
}

export function normalizeHtmlBlocks(html: string): MoonReadBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: MoonReadBlock[] = [];
  const seen = new Map<string, number>();
  const push = (type: MoonReadBlock['type'], value: string, block: RawMoonReadBlock) => {
    const key = `${type}:${value}`;
    const occurrence = seen.get(key) || 0;
    seen.set(key, occurrence + 1);
    blocks.push({ ...block, stableBlockId: stableBlockId(type, value, occurrence) } as MoonReadBlock);
  };
  doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,blockquote,li,img').forEach((node) => {
    if (node instanceof HTMLImageElement) {
      const src = node.currentSrc || node.src || node.getAttribute('src') || '';
      const width = Number(node.getAttribute('width') || 0);
      const height = Number(node.getAttribute('height') || 0);
      if (!src || PLACEHOLDER_RE.test(src) || (width > 0 && height > 0 && width * height < 4096)) return;
      push('image', `${src}|${node.alt}`, { type: 'image', src, alt: node.alt || '書籍插圖' });
      return;
    }
    if (node.querySelector('p,blockquote,li,h1,h2,h3,h4,h5,h6')) return;
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) { const type = /^H/.test(node.tagName) ? 'heading' : 'paragraph'; push(type, text, { type, text }); }
  });
  return blocks;
}

export function reanchorMoonReadAnnotation(anchor: import('./types').MoonReadAnnotationAnchor, blocks: MoonReadBlock[]) {
  const exactBlock = blocks.find((block) => block.stableBlockId === anchor.stableBlockId);
  if (exactBlock && exactBlock.type !== 'image') return { block: exactBlock, offsets: anchor.offsets, strategy: 'stableBlockId' as const };
  const candidates = blocks.filter((block) => block.type !== 'image' && block.text.includes(anchor.exactText));
  const contextual = candidates.find((block) => block.type !== 'image' && block.text.includes(`${anchor.prefix}${anchor.exactText}${anchor.suffix}`)) || candidates[0];
  if (contextual && contextual.type !== 'image') {
    const start = contextual.text.indexOf(anchor.exactText);
    return { block: contextual, offsets: { start, end: start + anchor.exactText.length }, strategy: 'quote' as const };
  }
  return { strategy: 'orphaned' as const };
}
