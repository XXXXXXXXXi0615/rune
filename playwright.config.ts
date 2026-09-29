import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const voiceFixture = fileURLToPath(new URL('./e2e/fixtures/voice-input.wav', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /voice-runtime\.spec\.ts/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'chrome-local',
      testIgnore: /voice-runtime\.spec\.ts/,
      use: { channel: 'chrome' },
    },
    {
      name: 'webkit',
      testIgnore: /voice-runtime\.spec\.ts/,
      use: { browserName: 'webkit' },
    },
    {
      name: 'voice-fake-mic',
      testMatch: /voice-runtime\.spec\.ts/,
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${voiceFixture}`,
          ],
        },
        permissions: ['microphone'],
      },
    },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
