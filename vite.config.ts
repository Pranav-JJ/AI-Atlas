/// <reference types="vitest/config" />
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { encodeFallbackUrl } from './src/lib/spa-fallback.ts'
import { STATIC_ROUTES } from './src/routes-manifest.ts'

/**
 * GitHub Pages serves this site from a subpath, so every asset and route
 * reference must be base-aware.
 *
 * Target: https://pranav-jj.github.io/AI-Atlas/
 * (GitHub lowercases the username in the hostname but preserves the repository
 * name's case in the path, so the base is '/AI-Atlas/', not '/ai-atlas/'.)
 *
 * This value is only the LOCAL default. CI overrides it from
 * actions/configure-pages, so renaming the repository or adding a custom domain
 * needs no code change here. It must have a leading AND trailing slash.
 */
const basePath = process.env.VITE_BASE_PATH ?? '/AI-Atlas/'

if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
  throw new Error(
    `VITE_BASE_PATH must have a leading and trailing slash (e.g. "/AI-Atlas/" or "/"), got "${basePath}"`,
  )
}

/**
 * Emits the GitHub Pages SPA deep-link fallback.
 *
 * The redirect logic is NOT written by hand here — it is the same
 * `encodeFallbackUrl` that src/lib/spa-fallback.test.ts covers, serialised into
 * the page. That keeps one tested implementation instead of a tested module plus
 * an untested copy-paste in a static HTML file, which is how this technique
 * usually rots.
 */
function spaFallback404(base: string): Plugin {
  return {
    name: 'ai-atlas:spa-fallback-404',
    apply: 'build',
    generateBundle() {
      const source = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Redirecting — AI Atlas</title>
    <script>
      (function () {
        var encodeFallbackUrl = ${encodeFallbackUrl.toString()};
        var l = window.location;
        l.replace(l.origin + encodeFallbackUrl(${JSON.stringify(base)}, l.pathname, l.search, l.hash));
      })();
    </script>
  </head>
  <body>
    <noscript>
      <p style="font-family: system-ui, sans-serif; padding: 2rem">
        This page could not be found, and restoring the address needs JavaScript.
        <a href="${base}">Go to the AI Atlas home page</a>.
      </p>
    </noscript>
  </body>
</html>
`
      this.emitFile({ type: 'asset', fileName: '404.html', source })
    },
  }
}

/**
 * Pre-renders known routes as real files so GitHub Pages serves them with a 200
 * instead of routing them through the 404 fallback. See src/routes-manifest.ts.
 */
function staticRoutes(routes: readonly string[]): Plugin {
  return {
    name: 'ai-atlas:static-routes',
    apply: 'build',
    // writeBundle, not generateBundle: Vite emits index.html after third-party
    // plugins' generateBundle hooks run, so it is not in the bundle map yet.
    // Reading the finished file from disk is also robust across Vite versions.
    async writeBundle(options) {
      const outDir = options.dir

      if (!outDir) {
        throw new Error('static-routes: could not determine the output directory')
      }

      const html = await readFile(join(outDir, 'index.html'), 'utf8')

      for (const route of routes) {
        if (route === '/') continue // already emitted as dist/index.html

        const dir = join(outDir, route.replace(/^\/+|\/+$/g, ''))
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'index.html'), html, 'utf8')
      }
    },
  }
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), spaFallback404(basePath), staticRoutes(STATIC_ROUTES)],
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
      // Thresholds are deliberately NOT enforced yet — src/lib is nearly empty until
      // Phase 2, and a threshold over an empty directory is a false green.
      include: ['src/lib/**/*.{ts,tsx}'],
    },
  },
})
