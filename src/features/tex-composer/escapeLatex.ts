const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '#': '\\#',
  '$': '\\$',
  '%': '\\%',
  '&': '\\&',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

export function escapeLatex(value: string): string {
  return value.replace(/[\\#$%&_{}~^]/g, (character) => LATEX_ESCAPES[character]);
}

export function normalizeHex(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
}

export function safeDimension(value: string | undefined, options: { allowNegative?: boolean; fallback: string }): string {
  const candidate = (value || '').trim();
  const pattern = options.allowNegative
    ? /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|px|pt|cm|mm)$/
    : /^(?:\d+(?:\.\d+)?|\.\d+)(?:em|px|pt|cm|mm)$/;
  return pattern.test(candidate) ? candidate : options.fallback;
}

export function isSafeDimension(value: string | undefined, allowNegative = false): boolean {
  const candidate = (value || '').trim();
  const pattern = allowNegative
    ? /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|px|pt|cm|mm)$/
    : /^(?:\d+(?:\.\d+)?|\.\d+)(?:em|px|pt|cm|mm)$/;
  return pattern.test(candidate);
}

export function safeScale(value: number): number {
  return Number.isFinite(value) && value > 0 && value <= 20 ? value : 1;
}

export function safeRotation(value: number): number {
  return Number.isFinite(value) ? Math.max(-360, Math.min(360, value)) : 0;
}
