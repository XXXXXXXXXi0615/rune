import { rmSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function companionReleaseGatePlugin(includeLogos: boolean): Plugin {
  return {
    name: 'lunartide-companion-release-gate',
    apply: 'build',
    closeBundle() {
      if (!includeLogos) {
        rmSync(path.resolve(__dirname, 'dist/assets/companion-pets/logos'), { recursive: true, force: true })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const includeLocalOnlyLogos = env.VITE_COMPANION_RELEASE_CHANNEL === 'local'
    || env.VITE_LOGOS_PUBLIC_APPROVED === 'true'

  return ({
  // Local development and ordinary builds stay rooted at `/`. Only the
  // dedicated GitHub Pages build receives the repository sub-path.
  base: mode === 'pages' ? '/lunartide/' : '/',
  plugins: [react(), companionReleaseGatePlugin(includeLocalOnlyLogos)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    cssMinify: false,
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true,
  },
  })
})
