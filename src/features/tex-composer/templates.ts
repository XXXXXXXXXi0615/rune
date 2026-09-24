import { createBlock, DEFAULT_TEX_STYLE, newTeXId, type TeXBlock, type TeXTemplate } from './types';

const renewIds = (block: TeXBlock): TeXBlock => ({ ...block, id: newTeXId(), children: block.children?.map(renewIds) });
const clone = (blocks: TeXBlock[]) => structuredClone(blocks).map(renewIds);

const annotated = (): TeXBlock => ({
  ...createBlock('annotated', 'English'),
  annotation: '注释',
  style: { ...DEFAULT_TEX_STYLE, textColor: '#8FB8D4' },
  annotationStyle: { ...DEFAULT_TEX_STYLE, fontSize: 'scriptsize', textColor: '#BFC7D1', raise: '-0.12em' },
});

const colorBox = (text: string, color: string): TeXBlock => ({
  ...createBlock('colorbox', text),
  style: { ...DEFAULT_TEX_STYLE, backgroundColor: color },
});

const templates: TeXTemplate[] = [
  { id: 'bilingual', name: '双语注释', builtin: true, blocks: [annotated()] },
  { id: 'color-heading', name: '彩色标题', builtin: true, blocks: [{ ...createBlock('heading', '月潮标题'), style: { ...DEFAULT_TEX_STYLE, fontSize: 'large', bold: true, textColor: '#D98162' } }] },
  { id: 'colorbox', name: '彩色色块', builtin: true, blocks: [colorBox('一段被颜色托住的文字', '#F5D8C8')] },
  { id: 'fcolorbox', name: '边框色块', builtin: true, blocks: [{ ...createBlock('fcolorbox', '带边框的文字'), style: { ...DEFAULT_TEX_STYLE, backgroundColor: '#FFF8F2', borderColor: '#D98162' } }] },
  {
    id: 'columns', name: '左右双栏', builtin: true, blocks: [{
      ...createBlock('columns'),
      children: [colorBox('左侧内容', '#E8F1F7'), colorBox('右侧内容', '#F9E8DF')],
      columnGap: '1em',
    }],
  },
  { id: 'heading-rule', name: '标题 + 分隔线', builtin: true, blocks: [{ ...createBlock('heading', '章节标题'), style: { ...DEFAULT_TEX_STYLE, fontSize: 'large', bold: true } }, createBlock('rule')] },
  { id: 'multi', name: '多个独立公式块', builtin: true, blocks: [createBlock('raw', 'x^2 + y^2 = r^2'), createBlock('raw', '\\frac{a}{b} + \\sqrt{c}')] },
  { id: 'free', name: '自由 LaTeX', builtin: true, blocks: [createBlock('raw', '\\text{在这里写 LaTeX}')] },
];

export const BUILTIN_TEX_TEMPLATES = templates;
export const instantiateTemplate = (template: TeXTemplate): TeXBlock[] => clone(template.blocks);
