import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { McpClientFacade } from '@/features/mcp/McpClientFacade';

export async function initializeMobileShell() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add('capacitor-native');

  await StatusBar.setOverlaysWebView({ overlay: false });
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  await Keyboard.setResizeMode({ mode: KeyboardResize.Native });

  await Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('keyboard-open'));
  await Keyboard.addListener('keyboardWillHide', () => document.documentElement.classList.remove('keyboard-open'));
  await Network.addListener('networkStatusChange', (status) => {
    document.documentElement.classList.toggle('is-offline', !status.connected);
  });
  const status = await Network.getStatus();
  document.documentElement.classList.toggle('is-offline', !status.connected);

  await App.addListener('appStateChange', ({ isActive }) => {
    document.documentElement.classList.toggle('app-inactive', !isActive);
    if (isActive) void McpClientFacade.reconnectKnownServers();
  });
  await App.addListener('appUrlOpen', ({ url }) => {
    const incoming = new URL(url);
    const path = `${incoming.pathname}${incoming.search}${incoming.hash}`;
    window.history.pushState({}, '', path || '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
