import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CSSProperties } from 'react';
import type { ChatBubbleSkin } from '@/features/chat/bubbleSkin/types';

export type ChatBubbleFill =
  | { kind: 'solid'; color: string; alpha: number }
  | { kind: 'gradient'; colorA: string; colorB: string; angle: number; stopA: number; stopB: number; alphaA: number; alphaB: number }
  | { kind: 'glass'; baseColor: string; alpha: number; blur: number; saturation: number; borderColor: string; borderAlpha: number; borderWidth: number };

export interface ChatBubbleStyle {
  fill: ChatBubbleFill;
  textColor: string;
  borderColor: string;
  borderAlpha: number;
  borderWidth: number;
  radius: number;
}

export interface ChatTheme {
  id: string;
  name: string;
  runeDefault: boolean;
  myBubble: ChatBubbleStyle;
  agentBubble: ChatBubbleStyle;
  /** Optional bubble-skin metadata (Phase 1A). Absent / css → canonical CSS fallback. */
  bubbleSkin?: ChatBubbleSkin;
  background: { mode: 'current' | 'solid'; color: string };
  accent: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatThemeState {
  currentTheme: ChatTheme;
  savedThemes: ChatTheme[];
  recentColors: string[];
  updateCurrent: (patch: Partial<Pick<ChatTheme, 'myBubble' | 'agentBubble' | 'bubbleSkin' | 'background' | 'accent'>>) => void;
  setCurrent: (theme: ChatTheme) => void;
  rememberColor: (color: string) => void;
  save: (name?: string) => string;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => string | null;
  deleteTheme: (id: string) => void;
  setActive: (id: string) => void;
  reset: () => void;
}

const bubble = (color: string, textColor: string): ChatBubbleStyle => ({
  fill: { kind: 'solid', color, alpha: 1 },
  textColor,
  borderColor: color,
  borderAlpha: 0,
  borderWidth: 1,
  radius: 18,
});

export const createRuneDefaultChatTheme = (): ChatTheme => ({
  id: 'rune-default',
  name: 'Rune Default',
  runeDefault: true,
  myBubble: bubble('#E9EDF5', '#29272A'),
  agentBubble: bubble('#FFFDFC', '#29272A'),
  background: { mode: 'current', color: '#F7F1E8' },
  accent: '#67AFA7',
  createdAt: 0,
  updatedAt: 0,
});

/* ── Curated static presets (Phase 1.1) ─────────────────────────────
 * Static seeds only — selecting one copies it into `currentTheme` for
 * further editing. They are plain ChatTheme factories, so the persisted
 * schema (v1) is untouched. Values stay inside the Phase 1.1
 * calibration ranges: glass alpha 0.48–0.58 (shared light/dark band),
 * blur 14–24px, 1px low-alpha pearl/ice borders, restrained gradients
 * (2 stops, 120–150deg, moderate hue/luminance difference).
 * ----------------------------------------------------------------- */
const presetShell = (name: string): ChatTheme => ({
  ...createRuneDefaultChatTheme(),
  id: `curated-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  runeDefault: false,
  createdAt: 0,
  updatedAt: 0,
});

const moonmilkGlass = (): ChatTheme => ({
  ...presetShell('Moonmilk Glass'),
  myBubble: {
    fill: { kind: 'glass', baseColor: '#F3E9DA', alpha: 0.52, blur: 18, saturation: 1.06, borderColor: '#EDE3D2', borderAlpha: 0.5, borderWidth: 1 },
    textColor: '#29272A',
    borderColor: '#EDE3D2',
    borderAlpha: 0.5,
    borderWidth: 1,
    radius: 18,
  },
  agentBubble: {
    fill: { kind: 'glass', baseColor: '#FFFDF9', alpha: 0.5, blur: 18, saturation: 1.05, borderColor: '#EFE7DA', borderAlpha: 0.55, borderWidth: 1 },
    textColor: '#29272A',
    borderColor: '#EFE7DA',
    borderAlpha: 0.55,
    borderWidth: 1,
    radius: 18,
  },
  accent: '#C9A97E',
});

const iceCurrent = (): ChatTheme => ({
  ...presetShell('Ice Current'),
  myBubble: {
    fill: { kind: 'glass', baseColor: '#E4EEF5', alpha: 0.5, blur: 16, saturation: 1.02, borderColor: '#D5E4EF', borderAlpha: 0.55, borderWidth: 1 },
    textColor: '#26333B',
    borderColor: '#D5E4EF',
    borderAlpha: 0.55,
    borderWidth: 1,
    radius: 18,
  },
  agentBubble: {
    fill: { kind: 'glass', baseColor: '#F4F8FB', alpha: 0.48, blur: 16, saturation: 1, borderColor: '#E1EBF3', borderAlpha: 0.5, borderWidth: 1 },
    textColor: '#26333B',
    borderColor: '#E1EBF3',
    borderAlpha: 0.5,
    borderWidth: 1,
    radius: 18,
  },
  accent: '#67AFA7',
});

const quietGradient = (): ChatTheme => ({
  ...presetShell('Quiet Gradient'),
  myBubble: {
    fill: { kind: 'gradient', colorA: '#E9EDF5', colorB: '#DDE7EE', angle: 135, stopA: 0, stopB: 100, alphaA: 0.92, alphaB: 0.92 },
    textColor: '#29272A',
    borderColor: '#DDE7EE',
    borderAlpha: 0.35,
    borderWidth: 1,
    radius: 18,
  },
  agentBubble: {
    fill: { kind: 'solid', color: '#FFFDFC', alpha: 0.96 },
    textColor: '#29272A',
    borderColor: '#E7E0D4',
    borderAlpha: 0.35,
    borderWidth: 1,
    radius: 18,
  },
  accent: '#8FA6AD',
});

/** Up to 4 curated static presets. Order is the Studio display order. */
export const CURATED_CHAT_THEME_PRESETS: readonly { id: string; label: string; create: () => ChatTheme }[] = [
  { id: 'rune-default', label: 'Rune Default', create: createRuneDefaultChatTheme },
  { id: 'curated-moonmilk-glass', label: 'Moonmilk Glass', create: moonmilkGlass },
  { id: 'curated-ice-current', label: 'Ice Current', create: iceCurrent },
  { id: 'curated-quiet-gradient', label: 'Quiet Gradient', create: quietGradient },
];

const cloneTheme = (theme: ChatTheme): ChatTheme => structuredClone(theme);
const normalizeHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : '#000000';

export const CHAT_THEME_STORAGE_KEY = 'lunartide-chat-theme-v1';

export const useChatThemeStore = create<ChatThemeState>()(persist((set, get) => ({
  currentTheme: createRuneDefaultChatTheme(),
  savedThemes: [],
  recentColors: [],
  updateCurrent: (patch) => set((state) => ({ currentTheme: { ...state.currentTheme, ...patch, id: state.currentTheme.runeDefault ? crypto.randomUUID() : state.currentTheme.id, name: state.currentTheme.runeDefault ? 'Custom Theme' : state.currentTheme.name, runeDefault: false, updatedAt: Date.now() } })),
  setCurrent: (theme) => set({ currentTheme: cloneTheme(theme) }),
  rememberColor: (color) => set((state) => ({ recentColors: [normalizeHex(color), ...state.recentColors.filter((item) => item !== normalizeHex(color))].slice(0, 8) })),
  save: (name) => {
    const current = get().currentTheme;
    const id = current.runeDefault ? crypto.randomUUID() : current.id;
    const now = Date.now();
    const saved = { ...cloneTheme(current), id, name: name?.trim() || current.name || 'Custom Theme', runeDefault: false, createdAt: current.createdAt || now, updatedAt: now };
    set((state) => ({ currentTheme: cloneTheme(saved), savedThemes: [saved, ...state.savedThemes.filter((item) => item.id !== id)] }));
    return id;
  },
  rename: (id, name) => set((state) => ({ savedThemes: state.savedThemes.map((theme) => theme.id === id ? { ...theme, name: name.trim() || theme.name, updatedAt: Date.now() } : theme), currentTheme: state.currentTheme.id === id ? { ...state.currentTheme, name: name.trim() || state.currentTheme.name, updatedAt: Date.now() } : state.currentTheme })),
  duplicate: (id) => {
    const source = get().savedThemes.find((theme) => theme.id === id);
    if (!source) return null;
    const duplicate = { ...cloneTheme(source), id: crypto.randomUUID(), name: `${source.name} Copy`, createdAt: Date.now(), updatedAt: Date.now() };
    set((state) => ({ savedThemes: [duplicate, ...state.savedThemes] }));
    return duplicate.id;
  },
  deleteTheme: (id) => set((state) => ({ savedThemes: state.savedThemes.filter((theme) => theme.id !== id), currentTheme: state.currentTheme.id === id ? createRuneDefaultChatTheme() : state.currentTheme })),
  setActive: (id) => {
    const theme = get().savedThemes.find((item) => item.id === id);
    if (theme) set({ currentTheme: cloneTheme(theme) });
  },
  reset: () => set({ currentTheme: createRuneDefaultChatTheme() }),
}), { name: CHAT_THEME_STORAGE_KEY, version: 1 }));

const rgba = (hex: string, alpha: number) => {
  const safe = normalizeHex(hex);
  const values = [1, 3, 5].map((start) => Number.parseInt(safe.slice(start, start + 2), 16));
  return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${Math.min(1, Math.max(0, alpha))})`;
};

export function chatBubbleBackground(fill: ChatBubbleFill): string {
  if (fill.kind === 'solid') return rgba(fill.color, fill.alpha);
  if (fill.kind === 'gradient') return `linear-gradient(${fill.angle}deg, ${rgba(fill.colorA, fill.alphaA)} ${fill.stopA}%, ${rgba(fill.colorB, fill.alphaB)} ${fill.stopB}%)`;
  return rgba(fill.baseColor, fill.alpha);
}

export function chatThemeStyle(theme: ChatTheme): CSSProperties {
  if (theme.runeDefault) return {};
  const myBorder = theme.myBubble.fill.kind === 'glass' ? theme.myBubble.fill : theme.myBubble;
  const agentBorder = theme.agentBubble.fill.kind === 'glass' ? theme.agentBubble.fill : theme.agentBubble;
  return {
    '--chat-theme-my-bg': chatBubbleBackground(theme.myBubble.fill),
    '--chat-theme-my-text': theme.myBubble.textColor,
    '--chat-theme-my-border': rgba(myBorder.borderColor, myBorder.borderAlpha),
    '--chat-theme-my-border-width': `${myBorder.borderWidth}px`,
    '--chat-theme-my-radius': `${theme.myBubble.radius}px`,
    '--chat-theme-agent-bg': chatBubbleBackground(theme.agentBubble.fill),
    '--chat-theme-agent-text': theme.agentBubble.textColor,
    '--chat-theme-agent-border': rgba(agentBorder.borderColor, agentBorder.borderAlpha),
    '--chat-theme-agent-border-width': `${agentBorder.borderWidth}px`,
    '--chat-theme-agent-radius': `${theme.agentBubble.radius}px`,
    '--chat-theme-background': theme.background.mode === 'solid' ? theme.background.color : 'transparent',
    '--chat-theme-accent': theme.accent,
    '--chat-theme-my-backdrop': theme.myBubble.fill.kind === 'glass' ? `blur(${theme.myBubble.fill.blur}px) saturate(${theme.myBubble.fill.saturation})` : 'none',
    '--chat-theme-agent-backdrop': theme.agentBubble.fill.kind === 'glass' ? `blur(${theme.agentBubble.fill.blur}px) saturate(${theme.agentBubble.fill.saturation})` : 'none',
  } as CSSProperties;
}

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const safe = normalizeHex(hex);
    const channels = [1, 3, 5].map((start) => Number.parseInt(safe.slice(start, start + 2), 16) / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const [a, b] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (a + .05) / (b + .05);
}

export function approximateBubbleColor(fill: ChatBubbleFill): string {
  if (fill.kind === 'solid') return fill.color;
  if (fill.kind === 'glass') return fill.baseColor;
  const parse = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(normalizeHex(hex).slice(start, start + 2), 16));
  const a = parse(fill.colorA); const b = parse(fill.colorB);
  return `#${a.map((value, index) => Math.round((value + b[index]) / 2).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
