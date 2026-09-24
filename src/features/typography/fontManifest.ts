import type { FontFamilyDefinition } from './types';

const INTER: FontFamilyDefinition = {
  id: 'inter',
  family: 'Inter',
  displayName: 'Inter',
  source: 'bundled',
  roles: ['body', 'display'],
  fallbackStack: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Roboto', 'sans-serif'],
  supportedWeights: [400, 500, 600, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: false,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/rsms/inter',
  },
  status: 'available',
};

const LORA: FontFamilyDefinition = {
  id: 'lora',
  family: 'Lora',
  displayName: 'Lora',
  source: 'bundled',
  roles: ['display'],
  fallbackStack: ["'Times New Roman'", 'serif'],
  supportedWeights: [400, 500, 600, 700],
  variableAxes: [
    { tag: 'wght', min: 400, max: 700, defaultValue: 400 },
  ],
  languageCoverage: {
    latin: true,
    traditionalChinese: false,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/cyrealtype/Lora',
  },
  status: 'available',
};

const JETBRAINS_MONO: FontFamilyDefinition = {
  id: 'jetbrains-mono',
  family: 'JetBrains Mono',
  displayName: 'JetBrains Mono',
  source: 'bundled',
  roles: ['mono'],
  fallbackStack: ["'Courier New'", 'ui-monospace', 'monospace'],
  supportedWeights: [400, 500, 600, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/JetBrains/JetBrainsMono',
  },
  status: 'available',
};

const NOTO_SANS_TC_BUNDLED: FontFamilyDefinition = {
  id: 'noto-sans-tc',
  family: 'Noto Sans TC',
  displayName: 'Noto Sans TC',
  source: 'bundled',
  roles: ['body'],
  fallbackStack: ["'PingFang TC'", "'Microsoft JhengHei'", 'sans-serif'],
  supportedWeights: [400, 500, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://fonts.google.com/specimen/Noto+Sans+TC',
  },
  status: 'available',
};

const NOTO_SERIF_TC_BUNDLED: FontFamilyDefinition = {
  id: 'noto-serif-tc',
  family: 'Noto Serif TC',
  displayName: 'Noto Serif TC',
  source: 'bundled',
  roles: ['display'],
  fallbackStack: ["'LiSong Pro'", "'Apple LiSung'", 'serif'],
  supportedWeights: [400, 500, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://fonts.google.com/specimen/Noto+Serif+TC',
  },
  status: 'available',
};

const SOURCE_HAN_SANS_TC: FontFamilyDefinition = {
  id: 'source-han-sans-tc',
  family: 'Source Han Sans TC',
  displayName: 'Source Han Sans TC',
  source: 'downloadable',
  roles: ['body', 'display'],
  fallbackStack: ["'PingFang TC'", "'Microsoft JhengHei'", 'sans-serif'],
  supportedWeights: [400, 500, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: true,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/adobe-fonts/source-han-sans',
  },
  assets: [
    { format: 'woff2', sizeBytes: 15 * 1024 * 1024, url: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/sourcehansans-tc@1.0.0/SourceHanSansTC-Regular.woff2' },
  ],
  status: 'not-downloaded',
};

const SOURCE_HAN_SERIF_TC: FontFamilyDefinition = {
  id: 'source-han-serif-tc',
  family: 'Source Han Serif TC',
  displayName: 'Source Han Serif TC',
  source: 'downloadable',
  roles: ['display', 'body'],
  fallbackStack: ["'LiSong Pro'", "'Apple LiSung'", 'serif'],
  supportedWeights: [400, 500, 600, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: true,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/adobe-fonts/source-han-serif',
  },
  assets: [
    { format: 'woff2', sizeBytes: 20 * 1024 * 1024, url: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/sourcehanserif-tc@1.0.0/SourceHanSerifTC-Regular.woff2' },
  ],
  status: 'not-downloaded',
};

const SOURCE_SANS_3: FontFamilyDefinition = {
  id: 'source-sans-3',
  family: 'Source Sans 3',
  displayName: 'Source Sans 3',
  source: 'downloadable',
  roles: ['body', 'display'],
  fallbackStack: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Roboto', 'sans-serif'],
  supportedWeights: [300, 400, 500, 600, 700],
  variableAxes: [
    { tag: 'wght', min: 200, max: 900, defaultValue: 400 },
  ],
  languageCoverage: {
    latin: true,
    traditionalChinese: false,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/adobe-fonts/source-sans',
  },
  assets: [
    { format: 'woff2', sizeBytes: 400 * 1024, url: 'https://fonts.gstatic.com/s/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky47GEJig.woff2' },
  ],
  status: 'not-downloaded',
};

const PLAYFAIR_DISPLAY: FontFamilyDefinition = {
  id: 'playfair-display',
  family: 'Playfair Display',
  displayName: 'Playfair Display',
  source: 'downloadable',
  roles: ['display'],
  fallbackStack: ["'Times New Roman'", 'serif'],
  supportedWeights: [400, 500, 600, 700, 800, 900],
  variableAxes: [
    { tag: 'wght', min: 400, max: 900, defaultValue: 400 },
  ],
  languageCoverage: {
    latin: true,
    traditionalChinese: false,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/googlefonts/playfair',
  },
  assets: [
    { format: 'woff2', sizeBytes: 500 * 1024, url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtK-.woff2' },
  ],
  status: 'not-downloaded',
};

const EB_GARAMOND: FontFamilyDefinition = {
  id: 'eb-garamond',
  family: 'EB Garamond',
  displayName: 'EB Garamond',
  source: 'downloadable',
  roles: ['display'],
  fallbackStack: ["'Times New Roman'", 'serif'],
  supportedWeights: [400, 500, 600, 700, 800],
  variableAxes: [
    { tag: 'wght', min: 400, max: 800, defaultValue: 400 },
  ],
  languageCoverage: {
    latin: true,
    traditionalChinese: false,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/georgd/EB-Garamond',
  },
  assets: [
    { format: 'woff2', sizeBytes: 600 * 1024, url: 'https://fonts.gstatic.com/s/ebgaramond/v30/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-6_RkCY9_Wak.woff2' },
  ],
  status: 'not-downloaded',
};

const CORMORANT_GARAMOND: FontFamilyDefinition = {
  id: 'cormorant-garamond',
  family: 'Cormorant Garamond',
  displayName: 'Cormorant Garamond',
  source: 'downloadable',
  roles: ['display'],
  fallbackStack: ["'Times New Roman'", 'serif'],
  supportedWeights: [300, 400, 500, 600, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: false,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/CatharsisFonts/Cormorant',
  },
  assets: [
    { format: 'woff2', sizeBytes: 450 * 1024, url: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpHtKlS5x.woff2' },
  ],
  status: 'not-downloaded',
};

const SOURCE_CODE_PRO: FontFamilyDefinition = {
  id: 'source-code-pro',
  family: 'Source Code Pro',
  displayName: 'Source Code Pro',
  source: 'downloadable',
  roles: ['mono'],
  fallbackStack: ["'Courier New'", 'monospace'],
  supportedWeights: [300, 400, 500, 600, 700],
  variableAxes: [
    { tag: 'wght', min: 200, max: 900, defaultValue: 400 },
  ],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/adobe-fonts/source-code-pro',
  },
  assets: [
    { format: 'woff2', sizeBytes: 300 * 1024, url: 'https://fonts.gstatic.com/s/sourcecodepro/v23/HI_diYsKILxRpg3hIP6sJ7fM7PqPMcMnZFqUwX28DMyQtMlrSQ.woff2' },
  ],
  status: 'not-downloaded',
};

const IANSUI: FontFamilyDefinition = {
  id: 'iansui',
  family: 'Iansui',
  displayName: '芫荽／Iansui',
  source: 'downloadable',
  roles: ['display', 'body'],
  fallbackStack: ["'PingFang TC'", "'Microsoft JhengHei'", 'sans-serif'],
  supportedWeights: [400],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: false,
    japanese: false,
    korean: false,
  },
  license: {
    name: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/ButTaiwan/iansui',
  },
  assets: [
    { format: 'woff2', sizeBytes: 8 * 1024 * 1024, url: 'https://github.com/ButTaiwan/iansui/raw/main/fonts/Iansui-Regular.ttf' },
  ],
  status: 'not-downloaded',
};

const SYSTEM_DISPLAY_FALLBACK: FontFamilyDefinition = {
  id: 'system-display',
  family: '-apple-system-headline',
  displayName: 'System Display (Headline)',
  source: 'system',
  roles: ['display'],
  fallbackStack: ["'Times New Roman'", 'serif'],
  supportedWeights: [400, 500, 600, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: true,
  },
  license: {
    name: 'Proprietary (OS default)',
  },
  status: 'not-installed',
};

const SYSTEM_BODY_FALLBACK: FontFamilyDefinition = {
  id: 'system-body',
  family: '-apple-system',
  displayName: 'System Default (UI)',
  source: 'system',
  roles: ['body'],
  fallbackStack: ["'Segoe UI'", 'Roboto', 'sans-serif'],
  supportedWeights: [300, 400, 500, 600, 700],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: true,
  },
  license: {
    name: 'Proprietary (OS default)',
  },
  status: 'not-installed',
};

const SYSTEM_MONO_FALLBACK: FontFamilyDefinition = {
  id: 'system-mono',
  family: 'ui-monospace',
  displayName: 'System Default (Monospace)',
  source: 'system',
  roles: ['mono'],
  fallbackStack: ["'Courier New'", 'monospace'],
  supportedWeights: [400, 500],
  languageCoverage: {
    latin: true,
    traditionalChinese: true,
    simplifiedChinese: true,
    japanese: true,
    korean: true,
  },
  license: {
    name: 'Proprietary (OS default)',
  },
  status: 'not-installed',
};

export const BUNDLED_FONTS: FontFamilyDefinition[] = [
  INTER,
  LORA,
  JETBRAINS_MONO,
  NOTO_SANS_TC_BUNDLED,
  NOTO_SERIF_TC_BUNDLED,
];

export const DOWNLOADABLE_FONTS: FontFamilyDefinition[] = [
  SOURCE_HAN_SANS_TC,
  SOURCE_HAN_SERIF_TC,
  SOURCE_SANS_3,
  PLAYFAIR_DISPLAY,
  EB_GARAMOND,
  CORMORANT_GARAMOND,
  SOURCE_CODE_PRO,
  IANSUI,
];

export const SYSTEM_FONTS: FontFamilyDefinition[] = [
  SYSTEM_DISPLAY_FALLBACK,
  SYSTEM_BODY_FALLBACK,
  SYSTEM_MONO_FALLBACK,
];

export const FONT_MANIFEST: FontFamilyDefinition[] = [
  ...BUNDLED_FONTS,
  ...DOWNLOADABLE_FONTS,
  ...SYSTEM_FONTS,
];

export function getFontById(id: string): FontFamilyDefinition | undefined {
  return FONT_MANIFEST.find((f) => f.id === id);
}

export function getFontsByRole(role: string): FontFamilyDefinition[] {
  return FONT_MANIFEST.filter((f) => f.roles.includes(role as any));
}

export function getBundledFonts(): FontFamilyDefinition[] {
  return BUNDLED_FONTS;
}

export function getDownloadableFonts(): FontFamilyDefinition[] {
  return DOWNLOADABLE_FONTS;
}

export function getSystemFontCandidates(): FontFamilyDefinition[] {
  return SYSTEM_FONTS;
}

export function getDefaultFontIdForRole(role: string): string {
  switch (role) {
    case 'display': return 'lora';
    case 'body': return 'inter';
    case 'mono': return 'jetbrains-mono';
    default: return 'inter';
  }
}

export const IANSUI_WARNING = '實驗性字體，可能存在缺字';

export function getIansuiWarning(id: string): string | null {
  if (id === 'iansui') return IANSUI_WARNING;
  return null;
}
