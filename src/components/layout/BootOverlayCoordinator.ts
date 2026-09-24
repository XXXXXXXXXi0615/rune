import { useSyncExternalStore } from 'react';

type BootOverlaySnapshot = {
  shellReady: boolean;
  splashVisible: boolean;
  globalOverlaysReady: boolean;
};

let snapshot: BootOverlaySnapshot = {
  shellReady: false,
  splashVisible: typeof document !== 'undefined' && Boolean(document.getElementById('pre-splash')),
  globalOverlaysReady: false,
};

const listeners = new Set<() => void>();

function publish(next: BootOverlaySnapshot) {
  if (
    snapshot.shellReady === next.shellReady
    && snapshot.splashVisible === next.splashVisible
    && snapshot.globalOverlaysReady === next.globalOverlaysReady
  ) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function signalShellReady() {
  publish({ ...snapshot, shellReady: true, globalOverlaysReady: !snapshot.splashVisible });
  document.documentElement.dataset.shellReady = 'true';
  if (!snapshot.splashVisible) document.documentElement.dataset.globalOverlaysReady = 'true';
}

export function signalBootSplashRemoved() {
  publish({ ...snapshot, splashVisible: false, globalOverlaysReady: snapshot.shellReady });
  if (snapshot.shellReady) document.documentElement.dataset.globalOverlaysReady = 'true';
}

export function onShellReady(listener: () => void) {
  if (snapshot.shellReady) {
    queueMicrotask(listener);
    return () => undefined;
  }
  const wrapped = () => {
    if (!snapshot.shellReady) return;
    listeners.delete(wrapped);
    listener();
  };
  listeners.add(wrapped);
  return () => listeners.delete(wrapped);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

const serverSnapshot: BootOverlaySnapshot = {
  shellReady: false,
  splashVisible: true,
  globalOverlaysReady: false,
};

export function useBootOverlaySnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}

export function useGlobalOverlaysReady() {
  return useBootOverlaySnapshot().globalOverlaysReady;
}
