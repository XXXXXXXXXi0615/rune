import { escapeLatex, isSafeDimension, normalizeHex, safeDimension, safeRotation, safeScale } from './escapeLatex';
import type { CompileTarget, GeneratedLatex, TeXBlock, TeXTextStyle } from './types';

class ColorRegistry {
  private colors = new Map<string, string>();

  get(hex?: string): string | undefined {
    const normalized = normalizeHex(hex);
    if (!normalized) return undefined;
    if (!this.colors.has(normalized)) this.colors.set(normalized, `ltColor${this.colors.size + 1}`);
    return this.colors.get(normalized);
  }

  definitions(): string[] {
    return [...this.colors].map(([hex, name]) => `\\definecolor{${name}}{HTML}{${hex}}`);
  }
}

const KATEX_UNSUPPORTED = ['\\scalebox', '\\rotatebox', '\\raisebox'];

function detectDegradation(blocks: TeXBlock[]): string[] {
  const warnings: string[] = [];
  for (const block of blocks) {
    const check = (text: string) => {
      for (const cmd of KATEX_UNSUPPORTED) {
        if (text.includes(cmd)) warnings.push(`「${block.text || block.type}」含 ${cmd}，网页预览已简化；完整导出保留原命令。`);
      }
    };
    check(block.text);
    if (block.annotation) check(block.annotation);
    if (block.type === 'raw') check(block.text);
    if (block.children) block.children.forEach((child) => check(child.text));
  }
  return [...new Set(warnings)];
}

function applyStyle(content: string, style: TeXTextStyle, colors: ColorRegistry): string {
  const family = { default: '', sans: '\\mathsf', roman: '\\mathrm', mono: '\\mathtt' }[style.fontFamily];
  let output = `\\${style.fontSize} ${content}`;
  if (family) output = `${family}{${output}}`;
  if (style.bold) output = `\\mathbf{${output}}`;
  const textColor = colors.get(style.textColor);
  if (textColor) output = `\\textcolor{${textColor}}{${output}}`;
  const background = colors.get(style.backgroundColor);
  const border = colors.get(style.borderColor);
  if (background && border) output = `\\fcolorbox{${border}}{${background}}{${output}}`;
  else if (background) output = `\\colorbox{${background}}{${output}}`;
  const scale = safeScale(style.scale);
  if (scale !== 1) output = `\\scalebox{${scale}}{${output}}`;
  const rotation = safeRotation(style.rotation);
  if (rotation !== 0) output = `\\rotatebox{${rotation}}{${output}}`;
  const raise = safeDimension(style.raise, { allowNegative: true, fallback: '0em' });
  if (raise !== '0em') output = `\\raisebox{${raise}}{${output}}`;
  const hspace = safeDimension(style.hspace, { fallback: '0em' });
  if (hspace !== '0em') output = `\\hspace{${hspace}}${output}`;
  return output;
}

function textContent(text: string): string {
  return `\\text{${escapeLatex(text)}}`;
}

function renderBlock(block: TeXBlock, colors: ColorRegistry, errors: string[]): string {
  const style = block.style;
  if (style.scale <= 0 || !Number.isFinite(style.scale)) errors.push(`區塊「${block.text || block.type}」的縮放倍數無效，已使用 1。`);
  if (!Number.isFinite(style.rotation) || style.rotation < -360 || style.rotation > 360) errors.push(`區塊「${block.text || block.type}」的旋轉角度已限制在 -360～360。`);
  if (style.raise && !isSafeDimension(style.raise, true)) errors.push(`區塊「${block.text || block.type}」的垂直偏移格式無效，已使用 0em。`);
  if (style.hspace && !isSafeDimension(style.hspace)) errors.push(`區塊「${block.text || block.type}」的水平間距格式無效，已使用安全預設值。`);

  if (block.type === 'raw') return block.text.trim();
  if (block.type === 'rule') {
    if (!isSafeDimension(block.ruleWidth)) errors.push('分隔線寬度格式無效，已使用 8em。');
    if (!isSafeDimension(block.ruleHeight)) errors.push('分隔線高度格式無效，已使用 0.08em。');
    const width = safeDimension(block.ruleWidth, { fallback: '8em' });
    const height = safeDimension(block.ruleHeight, { fallback: '0.08em' });
    return `\\rule{${width}}{${height}}`;
  }
  if (block.type === 'space') return `\\hspace{${safeDimension(block.style.hspace, { fallback: '1em' })}}`;
  if (block.type === 'columns') {
    const children = (block.children || []).slice(0, 2);
    if (!isSafeDimension(block.columnGap)) errors.push('雙欄間距格式無效，已使用 1em。');
    const gap = safeDimension(block.columnGap, { fallback: '1em' });
    const align = block.arrayAlign || 'c';
    const rendered = children.map((child) => renderBlock(child, colors, errors));
    return `\\begin{array}{${align}${align}}\n${rendered[0] || '{}'} & \\hspace{${gap}} ${rendered[1] || '{}'}\n\\end{array}`;
  }
  if (block.type === 'annotated') {
    const main = applyStyle(textContent(block.text), style, colors);
    const annotation = applyStyle(textContent(block.annotation || ''), block.annotationStyle || style, colors);
    return `\\mathop{${main}}\\limits_{${annotation}}`;
  }

  let content = textContent(block.text);
  if (block.type === 'heading') content = `\\mathbf{${content}}`;
  if (block.type === 'colorbox') {
    const bg = colors.get(style.backgroundColor || '#F7D8C8');
    content = `\\colorbox{${bg}}{${content}}`;
  }
  if (block.type === 'fcolorbox') {
    const bg = colors.get(style.backgroundColor || '#FFF8F2');
    const border = colors.get(style.borderColor || '#D98162');
    content = `\\fcolorbox{${border}}{${bg}}{${content}}`;
  }
  const outerStyle = block.type === 'colorbox' || block.type === 'fcolorbox'
    ? { ...style, backgroundColor: undefined, borderColor: undefined }
    : style;
  return applyStyle(content, outerStyle, colors);
}

function buildXeLaTeX(body: string, definitions: string[]): string {
  const preamble = [
    '\\documentclass{ctexart}',
    '\\usepackage{amsmath}',
    '\\usepackage{xcolor}',
    '\\usepackage{graphicx}',
    '\\usepackage{xeCJK}',
    ...definitions,
  ].join('\n');
  return `${preamble}\n\n\\begin{document}\n${body}\n\\end{document}`;
}

function buildLuaLaTeX(body: string, definitions: string[]): string {
  const preamble = [
    '\\documentclass{article}',
    '\\usepackage{amsmath}',
    '\\usepackage{xcolor}',
    '\\usepackage{graphicx}',
    '\\usepackage{fontspec}',
    '\\usepackage{luatexja-fontspec}',
    ...definitions,
  ].join('\n');
  return `${preamble}\n\n\\begin{document}\n${body}\n\\end{document}`;
}

function buildPdfLaTeX(body: string, definitions: string[]): string {
  const preamble = [
    '\\documentclass{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath}',
    '\\usepackage{xcolor}',
    '\\usepackage{graphicx}',
    ...definitions,
  ].join('\n');
  return `${preamble}\n\n\\begin{document}\n${body}\n\\end{document}`;
}

export function generateLatex(blocks: TeXBlock[]): GeneratedLatex {
  const colors = new ColorRegistry();
  const errors: string[] = [];
  const rendered = blocks.map((block) => renderBlock(block, colors, errors)).filter(Boolean);
  const body = rendered.length ? `\\[\n\\begin{gathered}\n${rendered.join(' \\\\[0.8em]\n')}\n\\end{gathered}\n\\]` : '';
  const definitions = colors.definitions();
  const degradation = detectDegradation(blocks);

  const documents: Record<CompileTarget, string> = {
    xelatex: buildXeLaTeX(body, definitions),
    lualatex: buildLuaLaTeX(body, definitions),
    pdflatex: buildPdfLaTeX(body, definitions),
  };

  return { body, document: documents.xelatex, documents, colorDefinitions: definitions, errors, degradation };
}
