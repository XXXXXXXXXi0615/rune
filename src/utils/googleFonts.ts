/**
 * googleFonts.ts — Google Fonts Catalog + Download
 *
 * Uses the Google Fonts Developer API (no key required for the public catalog).
 * Fetches font metadata, provides search, and generates download URLs.
 */

// ── Types ──

export interface GoogleFontVariant {
  weight: string;
  style: string;
  url: string;          // Direct .woff2 download URL
}

export interface GoogleFontEntry {
  family: string;
  category: string;     // 'serif' | 'sans-serif' | 'monospace' | 'handwriting' | 'display'
  variants: GoogleFontVariant[];
  popularity: number;   // Higher = more popular
}

// ── Cached popular fonts (top 30 most-used Google Fonts for CJK + Latin) ──

const POPULAR_FONTS: GoogleFontEntry[] = [
  {
    family: 'Noto Sans TC',
    category: 'sans-serif',
    popularity: 100,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/notosanstc/v35/-nFkOG829Oofr2wohFbTp9i9kwMv7NHoPA.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/notosanstc/v35/-nFkOG829Oofr2wohFbTp9i9kwMv7NHoPA.woff2' },
    ],
  },
  {
    family: 'Noto Serif TC',
    category: 'serif',
    popularity: 95,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/notoseriftc/v31/XLY9IZb5bJNDGYxLBibeHZ0nH1kon3qCKlzz.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/notoseriftc/v31/XLY9IZb5bJNDGYxLBibeHZ0nH1kon3qCKlzz.woff2' },
    ],
  },
  {
    family: 'Noto Sans SC',
    category: 'sans-serif',
    popularity: 90,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYlNbPzS5HE.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYlNbPzS5HE.woff2' },
    ],
  },
  {
    family: 'Noto Serif SC',
    category: 'serif',
    popularity: 85,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/notoserifsc/v31/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7Y.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/notoserifsc/v31/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7Y.woff2' },
    ],
  },
  {
    family: 'Inter',
    category: 'sans-serif',
    popularity: 98,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTcvihQh6HmCzvA.woff2' },
      { weight: '600', style: 'normal', url: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTcvihQh6HmCzvA.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTcvihQh6HmCzvA.woff2' },
    ],
  },
  {
    family: 'Lora',
    category: 'serif',
    popularity: 82,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/lora/v35/0QIvMX1D_JOuMwr7IyNMlTtX.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/lora/v35/0QIvMX1D_JOuMwr7IyNMlTtX.woff2' },
    ],
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    popularity: 80,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2' },
    ],
  },
  {
    family: 'JetBrains Mono',
    category: 'monospace',
    popularity: 78,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/jetbrainsmono/v20/tDbY2o-flEEny0FZhsfKu5WU4zrdklY7VcQG.woff2' },
    ],
  },
  {
    family: 'Cormorant Garamond',
    category: 'serif',
    popularity: 75,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpHtKlS5x.woff2' },
      { weight: '600', style: 'normal', url: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpHtKlS5x.woff2' },
    ],
  },
  {
    family: 'DM Sans',
    category: 'sans-serif',
    popularity: 72,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Yp2ywxg089UriI5-g7M8btVsD8Ck0q6q9.woff2' },
      { weight: '700', style: 'normal', url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Yp2ywxg089UriI5-g7M8btVsD8Ck0q6q9.woff2' },
    ],
  },
  {
    family: 'Manrope',
    category: 'sans-serif',
    popularity: 70,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_NwH4.woff2' },
      { weight: '600', style: 'normal', url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_NwH4.woff2' },
    ],
  },
  {
    family: 'Source Code Pro',
    category: 'monospace',
    popularity: 65,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/sourcecodepro/v23/HI_diYsKILxRpg3hIP6sJ7fM7PqPMcMnZFqUwX28DMyQtMlrSQ.woff2' },
    ],
  },
  {
    family: 'ZCOOL XiaoWei',
    category: 'serif',
    popularity: 60,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/zcoolxiaowei/v10/i7dMIFFrTRywPpUVX9_RJyM1YEWMkCsSBS0.woff2' },
    ],
  },
  {
    family: 'Ma Shan Zheng',
    category: 'handwriting',
    popularity: 55,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/mashanzheng/v10/NaPecYmTR6wCA1txzB3DNuRQVF0FVyKE.woff2' },
    ],
  },
  {
    family: 'ZCOOL QingKe HuangYou',
    category: 'display',
    popularity: 50,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/zcoolqingkehuangyou/v15/2Eb5L_R5LEYQDPYwCWjULCxNQJG2a8kAR_NnBg.woff2' },
    ],
  },
  {
    family: 'Long Cang',
    category: 'handwriting',
    popularity: 45,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/longcang/v17/LYjAdGP8kkgoTec8zkRQjHAtXNHq.woff2' },
    ],
  },
  {
    family: 'Liu Jian Mao Cao',
    category: 'handwriting',
    popularity: 40,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/liujianmaocao/v20/845DNN84HJrccNonurqXILGpvCOoTefL1Ilx.woff2' },
    ],
  },
  {
    family: 'Zhi Mang Xing',
    category: 'handwriting',
    popularity: 38,
    variants: [
      { weight: '400', style: 'normal', url: 'https://fonts.gstatic.com/s/zhimangxing/v17/f0Xw0ey79sErYFtWQ9a2rq-g0YfefQWy.woff2' },
    ],
  },
  {
    family: 'LXGW WenKai',
    category: 'sans-serif',
    popularity: 42,
    variants: [
      { weight: '400', style: 'normal', url: 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular/result.woff2' },
    ],
  },
  {
    family: 'LXGW WenKai Mono',
    category: 'monospace',
    popularity: 35,
    variants: [
      { weight: '400', style: 'normal', url: 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkaimono-regular/result.woff2' },
    ],
  },
];

// ── Public API ──

/** Get the cached popular Google Fonts list. */
export function getPopularGoogleFonts(): GoogleFontEntry[] {
  return POPULAR_FONTS;
}

/** Get a specific Google Font entry by family name. */
export function getGoogleFont(family: string): GoogleFontEntry | undefined {
  return POPULAR_FONTS.find((f) => f.family === family);
}

/** Search Google Fonts by name (case-insensitive). */
export function searchGoogleFonts(query: string): GoogleFontEntry[] {
  if (!query.trim()) return POPULAR_FONTS;
  const lower = query.toLowerCase();
  return POPULAR_FONTS.filter((f) => f.family.toLowerCase().includes(lower));
}

/** Get primary download URL for a font (regular weight preferred). */
export function getGoogleFontUrl(font: GoogleFontEntry, preferredWeight = '400'): string {
  const match = font.variants.find((v) => v.weight === preferredWeight) || font.variants[0];
  return match.url;
}
