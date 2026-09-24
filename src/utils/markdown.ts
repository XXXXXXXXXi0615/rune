/**
 * Safe Markdown → HTML renderer (Forum Phase 1C).
 *
 * 原則：
 * - 輸入永遠先 HTML-escape，輸出不包含未轉義的使用者輸入。
 * - 只支援 Phase 1C 需要的子集：bold / italic / inline code /
 *   link / image / divider / headings / blockquote / ul / ol。
 * - canonical data 永遠是 markdown 純文字；HTML 只存在於渲染層。
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

function isSafeUrl(url: string): boolean {
  const value = url.trim();
  return /^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/)/i.test(value);
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, rawUrl: string) => {
    const url = rawUrl.trim();
    return isSafeUrl(url) ? `<img src="${url}" alt="${alt}" loading="lazy" />` : alt;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, rawUrl: string) => {
    const url = rawUrl.trim();
    return isSafeUrl(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return out;
}

const HR_PATTERN = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const UL_PATTERN = /^\s*[-*]\s+/;
const OL_PATTERN = /^\s*\d+[.)]\s+/;

/** Render markdown source into safe HTML fragments (no wrapper element). */
export function renderMarkdown(source: string): string {
  const lines = (source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (HR_PATTERN.test(line)) {
      html.push('<hr />');
      i += 1;
      continue;
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        block.push(lines[i].slice(1).trimStart());
        i += 1;
      }
      html.push(`<blockquote>${renderInline(block.join(' '))}</blockquote>`);
      continue;
    }

    if (UL_PATTERN.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_PATTERN.test(lines[i])) {
        items.push(renderInline(lines[i].replace(UL_PATTERN, '')));
        i += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    }

    if (OL_PATTERN.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_PATTERN.test(lines[i])) {
        items.push(renderInline(lines[i].replace(OL_PATTERN, '')));
        i += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !HR_PATTERN.test(lines[i]) &&
      !HEADING_PATTERN.test(lines[i]) &&
      !lines[i].startsWith('>') &&
      !UL_PATTERN.test(lines[i]) &&
      !OL_PATTERN.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${renderInline(paragraph.join('\u0000')).replace(/\u0000/g, '<br />')}</p>`);
  }

  return html.join('\n');
}
