export type TeXBlockType = 'text' | 'annotated' | 'heading' | 'colorbox' | 'fcolorbox' | 'rule' | 'space' | 'columns' | 'raw';

export type TeXFontSize = 'tiny' | 'scriptsize' | 'small' | 'normalsize' | 'large';
export type TeXFontFamily = 'default' | 'sans' | 'roman' | 'mono';

export interface TeXTextStyle {
  fontSize: TeXFontSize;
  fontFamily: TeXFontFamily;
  bold: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  scale: number;
  rotation: number;
  raise: string;
  align: 'left' | 'center' | 'right';
  hspace: string;
}

export interface TeXBlock {
  id: string;
  type: TeXBlockType;
  text: string;
  annotation?: string;
  annotationStyle?: TeXTextStyle;
  style: TeXTextStyle;
  children?: TeXBlock[];
  ruleWidth?: string;
  ruleHeight?: string;
  columnGap?: string;
  arrayAlign?: 'c' | 'l' | 'r';
}

export interface TeXTemplate {
  id: string;
  name: string;
  createdAt?: string;
  blocks: TeXBlock[];
  builtin?: boolean;
}

export type CompileTarget = 'xelatex' | 'lualatex' | 'pdflatex';

export interface CompileTargetOption {
  value: CompileTarget;
  label: string;
  cjk: boolean;
}

export const COMPILE_TARGETS: CompileTargetOption[] = [
  { value: 'xelatex', label: 'XeLaTeX（推荐）', cjk: true },
  { value: 'lualatex', label: 'LuaLaTeX', cjk: true },
  { value: 'pdflatex', label: 'pdfLaTeX', cjk: false },
];

export function compileTargetLabel(target: CompileTarget): string {
  return COMPILE_TARGETS.find((t) => t.value === target)?.label ?? target;
}

export function compileTargetSupportsCJK(target: CompileTarget): boolean {
  return COMPILE_TARGETS.find((t) => t.value === target)?.cjk ?? false;
}

export interface GeneratedLatex {
  body: string;
  document: string;
  documents: Record<CompileTarget, string>;
  colorDefinitions: string[];
  errors: string[];
  degradation: string[];
}

export const DEFAULT_TEX_STYLE: TeXTextStyle = {
  fontSize: 'normalsize',
  fontFamily: 'default',
  bold: false,
  scale: 1,
  rotation: 0,
  raise: '0em',
  align: 'center',
  hspace: '0em',
};

export const newTeXId = () => crypto.randomUUID();

export const createBlock = (type: TeXBlockType = 'text', text = ''): TeXBlock => ({
  id: newTeXId(),
  type,
  text,
  style: { ...DEFAULT_TEX_STYLE },
  annotationStyle: { ...DEFAULT_TEX_STYLE, fontSize: 'scriptsize', raise: '-0.12em' },
  ruleWidth: '8em',
  ruleHeight: '0.08em',
  columnGap: '1em',
  arrayAlign: 'c',
});
