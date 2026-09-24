import { create } from 'zustand';

const STORAGE_KEY = 'lunartide_daily_cache_window';
const LAYOUT_VERSION = 'daily_cache_win_v3';
const DEFAULT_W = 380;
const DEFAULT_H = 500;
const MIN_W = 340;
const MIN_H = 400;
const MAX_W = 440;
const MAX_H = 680;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(min, value), max);
}

function sizeBounds() {
  return {
    minWidth: Math.min(MIN_W, window.innerWidth - 32),
    minHeight: Math.min(MIN_H, window.innerHeight * 0.9),
    maxWidth: Math.min(MAX_W, window.innerWidth - 32),
    maxHeight: Math.min(MAX_H, window.innerHeight * 0.9),
  };
}

function safePosition(x: number, y: number, width: number, height: number) {
  const margin = 14;
  const sat = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0') || 0;
  const safeTop = 56 + sat;
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

/** Default: right-aligned, 24px from right edge, below SystemTopBar (~56px) + 16px gap */
function defaultState(): WindowState {
  const w = Math.min(DEFAULT_W, Math.max(MIN_W, window.innerWidth - 32));
  const h = Math.min(DEFAULT_H, window.innerHeight * 0.9);
  return {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    x: Math.max(14, window.innerWidth - w - 24),
    y: Math.max(72, Math.min(140, Math.round(window.innerHeight * 0.1))),
    width: w,
    height: h,
  };
}

function load(): WindowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.layoutVersion !== LAYOUT_VERSION) return defaultState();
      const bounds = sizeBounds();
      const w = clamp(Number(parsed.width) || DEFAULT_W, bounds.minWidth, bounds.maxWidth);
      const h = clamp(Number(parsed.height) || DEFAULT_H, bounds.minHeight, bounds.maxHeight);
      const pos = safePosition(Number(parsed.x) || defaultState().x, Number(parsed.y) || defaultState().y, w, h);
      return { isOpen: false, isMinimized: false, isMaximized: Boolean(parsed.isMaximized), ...pos, width: w, height: h };
    }
  } catch {}
  return defaultState();
}

function save(s: WindowState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      layoutVersion: LAYOUT_VERSION,
      x: s.x, y: s.y, width: s.width, height: s.height,
      isMaximized: s.isMaximized,
    }));
  } catch {}
}

interface DailyCacheWindowStore extends WindowState {
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
}

export const useDailyCacheWindowStore = create<DailyCacheWindowStore>((set, get) => ({
  ...load(),

  openWindow: () => set((s) => {
    const bounds = sizeBounds();
    const w = clamp(s.width, bounds.minWidth, bounds.maxWidth);
    const h = clamp(s.height, bounds.minHeight, bounds.maxHeight);
    const pos = safePosition(s.x, s.y, w, h);
    const next = { ...s, ...pos, width: w, height: h, isOpen: true, isMinimized: false };
    save(next);
    return next;
  }),

  closeWindow: () => set((s) => {
    const next = { ...s, isOpen: false, isMinimized: false };
    save(next);
    return next;
  }),

  minimizeWindow: () => set((s) => {
    save({ ...s, isMinimized: true });
    return { ...s, isMinimized: true };
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
    const pos = safePosition(x, y, s.width, s.height);
    const next = { ...s, ...pos };
    save(next);
    return next;
  }),

  setSize: (width, height) => set((s) => {
    const bounds = sizeBounds();
    const w = clamp(width, bounds.minWidth, bounds.maxWidth);
    const h = clamp(height, bounds.minHeight, bounds.maxHeight);
    const pos = safePosition(s.x, s.y, w, h);
    const next = { ...s, ...pos, width: w, height: h };
    save(next);
    return next;
  }),

  setFrame: (x, y, width, height) => set((s) => {
    const bounds = sizeBounds();
    const w = clamp(width, bounds.minWidth, bounds.maxWidth);
    const h = clamp(height, bounds.minHeight, bounds.maxHeight);
    const pos = safePosition(x, y, w, h);
    const next = { ...s, ...pos, width: w, height: h };
    save(next);
    return next;
  }),
}));
