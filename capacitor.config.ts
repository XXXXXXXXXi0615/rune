import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lunartide.app',
  appName: 'Rune',
  webDir: 'dist',
  plugins: {
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
    StatusBar: { overlaysWebView: false },
  },
  includePlugins: [
    '@capacitor/app',
    '@capacitor/keyboard',
    '@capacitor/network',
    '@capacitor/status-bar',
    'capacitor-secure-storage-plugin',
  ],
};

export default config;
