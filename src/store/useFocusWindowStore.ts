import { create } from 'zustand';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';

const STORAGE_KEY = 'clawd_pact_window';
const LAYOUT_VERSION = 'clawd_focus_window_layout_v2';
const DEFAULT_W = 420;
const DEFAULT_H = 520;
const MIN_W = 360;
const MIN_H = 440;
const MAX_W = 560;
const MAX_H = 720;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(min, value), max);
}

function sizeBounds() {
  const maxWidth = Math.min(MAX_W, window.innerWidth * 0.9);
  const maxHeight = Math.min(MAX_H, window.innerHeight * 0.9);
  return {
    minWidth: Math.min(MIN_W, maxWidth),
    minHeight: Math.min(MIN_H, maxHeight),
    maxWidth,
    maxHeight,
  };
}

function safePosition(x: number, y: number, width: number, height: number) {
  const margin = 14;
  const safeTop = 64 + (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0') || 0);
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  const minY = Math.min(safeTop, maxY);
  return {
    x: clamp(x, margin, maxX),
    y: clamp(y, minY, maxY),
  };
}

interface WindowState {
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

function load(): WindowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.layoutVersion !== LAYOUT_VERSION) {
        const fresh = defaultState();
        save(fresh);
        return fresh;
      }
      const bounds = sizeBounds();
      const restored = { ...defaultState(), ...parsed };
      const width = clamp(Number(restored.width) || DEFAULT_W, bounds.minWidth, bounds.maxWidth);
      const height = clamp(Number(restored.height) || DEFAULT_H, bounds.minHeight, bounds.maxHeight);
      const position = safePosition(Number(restored.x) || defaultState().x, Number(restored.y) || defaultState().y, width, height);
      return {
        ...restored,
        ...position,
        width,
        height,
      };
    }
  } catch {}
  return defaultState();
}

function defaultState(): WindowState {
  return {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: Math.max(16, window.innerWidth - DEFAULT_W - 32),
    y: Math.max(82, Math.min(180, Math.round(window.innerHeight * 0.18))),
    width: DEFAULT_W,
    height: DEFAULT_H,
  };
}

function save(s: WindowState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({
    layoutVersion: LAYOUT_VERSION,
    x: s.x, y: s.y, width: s.width, height: s.height,
    isMaximized: s.isMaximized,
  })); } catch {}
}

interface FocusWindowStore extends WindowState {
  openWindow: () => void;
  closeWindow: () => void;
  minimizeWindow: () => void;
  toggleMinimized: () => void;
  maximizeWindow: () => void;
  restoreWindow: () => void;
  toggleMaximized: () => void;
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  setFrame: (x: number, y: number, width: number, height: number) => void;
  bringToFront: () => void;
}

export const useFocusWindowStore = create<FocusWindowStore>((set, get) => ({
  ...load(),

  openWindow: () => set((s) => {
    const bounds = sizeBounds();
    const width = clamp(s.width, bounds.minWidth, bounds.maxWidth);
    const height = clamp(s.height, bounds.minHeight, bounds.maxHeight);
    const position = safePosition(s.x, s.y, width, height);
    const next = { ...s, ...position, width, height, isOpen: true, isMinimized: false };
    save(next);
    return next;
  }),

  closeWindow: () => set((s) => {
    useFocusIslandStore.getState().showCompact();
    const next = { ...s, isOpen: false, isMinimized: false };
    save(next);
    return next;
  }),

  minimizeWindow: () => set((s) => {
    useFocusIslandStore.getState().showCompact();
    const next = { ...s, isMinimized: true };
    save(next);
    return next;
  }),

  toggleMinimized: () => {
    const s = get();
    if (s.isMinimized) s.openWindow();
    else s.minimizeWindow();
  },

  maximizeWindow: () => set((s) => {
    const next = { ...s, isMaximized: true, isMinimized: false, isOpen: true };
    save(next);
    return next;
  }),

  restoreWindow: () => set((s) => {
    const next = { ...s, isMaximized: false, isOpen: true };
    save(next);
    return next;
  }),

  toggleMaximized: () => {
    const s = get();
    if (s.isMaximized) s.restoreWindow();
    else s.maximizeWindow();
  },

  setPosition: (x, y) => set((s) => {
    const position = safePosition(x, y, s.width, s.height);
    const next = { ...s, ...position };
    save(next);
    return next;
  }),

  setSize: (width, height) => set((s) => {
    const bounds = sizeBounds();
    const w = clamp(width, bounds.minWidth, bounds.maxWidth);
    const h = clamp(height, bounds.minHeight, bounds.maxHeight);
    const position = safePosition(s.x, s.y, w, h);
    const next = { ...s, ...position, width: w, height: h };
    save(next);
    return next;
  }),

  setFrame: (x, y, width, height) => set((s) => {
    const bounds = sizeBounds();
    const w = clamp(width, bounds.minWidth, bounds.maxWidth);
    const h = clamp(height, bounds.minHeight, bounds.maxHeight);
    const position = safePosition(x, y, w, h);
    const next = { ...s, ...position, width: w, height: h };
    save(next);
    return next;
  }),

  bringToFront: () => set((s) => ({ ...s })), // zustand re-render forces re-mount for z-index
}));
