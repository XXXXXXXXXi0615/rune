/**
 * Native Shell Bridge — Phase 1.1
 *
 * Coordinates state between the React SPA and the native iOS shell
 * (FloatingTabBar, keyboard, safe-area, theme).
 *
 * All bridge messages are versioned.  Unknown messages are silently ignored.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { setNativeDockRect } from '@/features/desktopPet/PetSafeRegionResolver';

// ── Capacitor Plugin Type ────────────────────────────────────

interface ShellBridgePlugin {
  ready(data: { bridgeVersion: string; route: string; accessState: string; generationId: string }): Promise<{ bridgeVersion: string; readyCount: number; generationId: string; dockInstallCount: number }>;
  accessStateChanged(data: { state: string }): Promise<void>;
  routeChanged(data: { route: string }): Promise<void>;
  themeChanged(data: Record<string, string>): Promise<void>;
  requestHaptic(): Promise<void>;
  getDockMetrics(): Promise<NativeDockMetrics>;
  getSafeAreaInsets(): Promise<{ top: number; bottom: number; left: number; right: number }>;
  getTheme(): Promise<Record<string, string>>;
}

const ShellBridge = registerPlugin<ShellBridgePlugin>('ShellBridge');

// ── Types ────────────────────────────────────────────────────

export interface NativeDockMetrics {
  x: number; y: number; width: number; height: number;
}

export interface NativeShellState {
  dockVisible: boolean;
  accessState: string; // 'onboarding'|'locked'|'unlocked'|'recovery'
  selectedTab: string;
  keyboardVisible: boolean;
  dockHeight: number;
  occupiedBottom: number;
  navigationGenerationId: number;
  dockMetrics: NativeDockMetrics;
}

export type NativeShellListener = (state: NativeShellState) => void;

/**
 * Stable generation ID for the current Web document.
 * Changes only on WebView reload (new document), not on HMR or re-notify.
 */
const shellGenerationId = `${Math.floor(performance.timeOrigin)}-${Math.floor(Math.random() * 1e6)}`;

// ── Bridge singleton ─────────────────────────────────────────

class NativeShellBridge {
  private listeners = new Set<NativeShellListener>();
  private readyCount = 0;
  private lastState: NativeShellState = {
    dockVisible: false,
    accessState: 'onboarding',
    selectedTab: 'home',
    keyboardVisible: false,
    dockHeight: 0,
    occupiedBottom: 20, // safe area only
    navigationGenerationId: 0,
    dockMetrics: { x: 0, y: 0, width: 0, height: 0 },
  };

  /** True when running inside Capacitor native shell. */
  get isNativeShell(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** True when running in the iOS native shell (SwiftUI dock present). */
  get isIOSShell(): boolean {
    return this.isNativeShell && Capacitor.getPlatform() === 'ios';
  }

  subscribe(fn: NativeShellListener): () => void {
    this.listeners.add(fn);
    // Push current state immediately
    fn({ ...this.lastState });
    return () => this.listeners.delete(fn);
  }

  getState(): NativeShellState {
    return { ...this.lastState };
  }

  // ── Web → Native messages ──

  private async call(method: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.isNativeShell) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ShellBridge as any)?.[method]?.(data);
    } catch {
      /* plugin not loaded yet — silently ignore */
    }
  }

  async notifyReady(route = '/', accessState = 'onboarding'): Promise<void> {
    await this.call('ready', { bridgeVersion: '1', route, accessState, generationId: shellGenerationId });
  }

  async notifyAccessStateChanged(state: string): Promise<void> {
    await this.call('accessStateChanged', { state });
  }

  async notifyRouteChanged(route: string): Promise<void> {
    await this.call('routeChanged', { route });
  }

  async notifyThemeChanged(theme: Record<string, string>): Promise<void> {
    await this.call('themeChanged', theme);
  }

  async requestHaptic(): Promise<void> {
    await this.call('requestHaptic');
  }

  // ── Handle inbound native state ──

  handleNativeEvent(detail: NativeShellState): void {
    this.lastState = { ...this.lastState, ...detail };
    // Phase 1.1: update CLAWD reserved region
    if (detail.dockVisible && detail.dockMetrics?.width > 0) {
      setNativeDockRect(detail.dockMetrics);
    } else {
      setNativeDockRect(null);
    }
    for (const fn of this.listeners) fn({ ...this.lastState });
  }
}

export const nativeShellBridge = new NativeShellBridge();

// ── React hook ────────────────────────────────────────────────

import { useEffect, useState, useSyncExternalStore } from 'react';

let shellSnapshot: NativeShellState = nativeShellBridge.getState();
const shellSubscribers = new Set<() => void>();

function subscribeShell(cb: () => void) {
  shellSubscribers.add(cb);
  return () => shellSubscribers.delete(cb);
}

function getShellSnapshot(): NativeShellState {
  return shellSnapshot;
}

// Init: register the bridge event handler
if (typeof window !== 'undefined') {
  window.addEventListener('nativeShellStateChanged', ((e: CustomEvent) => {
    nativeShellBridge.handleNativeEvent(e.detail);
    shellSnapshot = nativeShellBridge.getState();
    for (const cb of shellSubscribers) cb();
  }) as EventListener);
}

/** React hook: read the native shell state (useSyncExternalStore for consistency). */
export function useNativeShellState(): NativeShellState {
  return useSyncExternalStore(subscribeShell, getShellSnapshot);
}

/**
 * Send the web route to native when it changes.
 * Call this inside your route change handler.
 */
export function notifyRouteToNative(route: string): void {
  nativeShellBridge.notifyRouteChanged(route);
}

/**
 * Notify native of auth/access state changes.
 * 'onboarding' | 'locked' | 'unlocked' | 'recovery'
 */
export function notifyAccessStateToNative(state: string): void {
  nativeShellBridge.notifyAccessStateChanged(state);
}

/**
 * Push current theme snapshot to native dock.
 */
export function notifyThemeToNative(theme: Record<string, string>): void {
  nativeShellBridge.notifyThemeChanged(theme);
}

/**
 * Set `data-native-shell="ios"` and safe-area CSS vars on the root element,
 * consumed once by the shared App Shell.
 */
export function setupNativeShellAttributes(): void {
  if (!nativeShellBridge.isIOSShell) return;
  const root = document.documentElement;
  root.dataset.nativeShell = 'ios';
  root.classList.add('native-shell');
}

// ── Status Bar Sync ──────────────────────────────────────────
// dark theme → light status bar content (readable on dark bg)
// light theme → dark status bar content (readable on light bg)

import { Style } from '@capacitor/status-bar';

export async function setStatusBarForTheme(themeMode: 'light' | 'dark'): Promise<void> {
  if (!nativeShellBridge.isIOSShell) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    // Dark theme → light status bar content; light theme → dark content
    await StatusBar.setStyle({ style: themeMode === 'dark' ? Style.Light : Style.Dark });
  } catch { /* plugin not available in browser */ }
}

// Listen for native theme changes
if (typeof window !== 'undefined') {
  window.addEventListener('nativeThemeChanged', ((e: CustomEvent) => {
    const mode = e.detail?.mode as 'light' | 'dark' || 'dark';
    setStatusBarForTheme(mode);
  }) as EventListener);
}

// ── Deep Link Auth Policy ───────────────────────────────────

let pendingDeepLink: string | null = null;

export function setPendingDeepLink(route: string): void {
  pendingDeepLink = route;
}

export function consumePendingDeepLink(): string | null {
  const r = pendingDeepLink;
  pendingDeepLink = null;
  return r;
}

/**
 * Resolve deep link destination under access state policy.
 * - onboarding → save + redirect to setup
 * - locked → save + show Moon Gate
 * - unlocked → navigate (or restore pending)
 */
export function resolveDeepLink(route: string, accessState: string): string | null {
  if (accessState === 'onboarding') {
    setPendingDeepLink(route);
    return '/onboarding';
  }
  if (accessState === 'locked') {
    setPendingDeepLink(route);
    return '/login';
  }
  if (accessState === 'recovery') {
    return null; // Don't override recovery flow
  }
  // unlocked: restore pending or use requested
  const pending = consumePendingDeepLink();
  return pending || route;
}

// ── CLAWD Native Dock Metrics Consumer ──────────────────────

/**
 * Returns the native dock rect in viewport coordinates for use in
 * PetSafeRegionResolver.  Cached from the last nativeShellStateChanged event.
 * Returns null on desktop / non-iOS.
 */
export function getNativeDockRect(): { x: number; y: number; width: number; height: number } | null {
  if (!nativeShellBridge.isIOSShell) return null;
  const state = nativeShellBridge.getState();
  if (!state.dockVisible) return null;
  const { x, y, width, height } = state.dockMetrics;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}
