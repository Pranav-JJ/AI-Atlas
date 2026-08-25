/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages serves this site from a subpath (https://<user>.github.io/ai-atlas/),
 * so every asset and route reference must be base-aware.
 *
 * VITE_BASE_PATH is the single place that changes if the repo is renamed, moved to
 * a user/org root site, or pointed at a custom domain (all of which use '/').
 * It must have a leading AND trailing slash.
 */
const basePath = process.env.VITE_BASE_PATH ?? '/ai-atlas/'

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Phase 13 acceptance criterion: >=90% lines on src/lib/**.
      // Thresholds are deliberately NOT enforced yet — src/lib is empty until Phase 2,
      // and a threshold over an empty directory is a false green.
      include: ['src/lib/**/*.{ts,tsx}'],
    },
  },
})
