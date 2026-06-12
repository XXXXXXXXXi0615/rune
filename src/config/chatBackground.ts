/* ── Chat Background — types & localStorage ── */

export interface ChatBackground {
  type: 'preset' | 'image'
  preset: 'default' | 'nightblue' | 'moontear' | 'rainglass' | 'serverroom'
  imageDataUrl: string
  opacity: number   // 10–100
  blur: number      // 0–50 px
}

export const DEFAULT_BG: ChatBackground = {
  type: 'preset',
  preset: 'default',
  imageDataUrl: '',
  opacity: 100,
  blur: 0,
}

export const PRESETS: Record<ChatBackground['preset'], { label: string; labelZh: string; css: string }> = {
  default:    { label: 'Default',    labelZh: '預設',     css: 'linear-gradient(160deg, #1e1b18 0%, #25211c 40%, #1a1816 100%)' },
  nightblue:  { label: 'Night Blue', labelZh: '深夜藍',   css: 'linear-gradient(160deg, #0d1117 0%, #111827 50%, #0a0e14 100%)' },
  moontear:   { label: 'Moontear',   labelZh: '月潮粉',   css: 'linear-gradient(160deg, #2a1a1f 0%, #241820 40%, #1f151c 100%)' },
  rainglass:  { label: 'Rain Glass', labelZh: '雨夜玻璃', css: 'linear-gradient(160deg, #1a1f2a 0%, #1e2533 50%, #181d26 100%)' },
  serverroom: { label: 'Server Room',labelZh: '機房冷光', css: 'linear-gradient(160deg, #0a1628 0%, #0d1f3a 50%, #0a1424 100%)' },
}

const LS_KEY = 'lunartide_chat_background'

export function loadBackground(): ChatBackground {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULT_BG, ...JSON.parse(raw) }
  } catch { /* fall through */ }
  return { ...DEFAULT_BG }
}

export function saveBackground(bg: ChatBackground): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(bg)) } catch { /* noop */ }
}

export function buildBackgroundCSS(bg: ChatBackground): string {
  if (bg.type === 'preset') {
    const css = PRESETS[bg.preset].css
    return css === 'none' ? 'none' : css
  }
  if (bg.type === 'image' && bg.imageDataUrl) {
    return `url(${bg.imageDataUrl}) center/cover no-repeat`
  }
  return 'none'
}
