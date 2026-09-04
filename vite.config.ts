/// <reference types="vitest/config" />
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { encodeFallbackUrl } from './src/lib/spa-fallback.ts'
import { NO_FLASH_SCRIPT } from './src/lib/theme.ts'
import { formatTitle, type RouteMeta } from './src/lib/routeMeta.ts'

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
 * Injects the theme bootstrap into <head>, before any stylesheet or script.
 *
 * It must run render-blocking: otherwise the browser paints the default light
 * palette and React corrects it a moment later, which a dark-mode user sees as a
 * white flash on every single page load.
 *
 * Injected from src/lib/theme.ts rather than pasted into index.html so the
 * storage key and the logic cannot drift from the module that owns them.
 */
function themeBootstrap(): Plugin {
  return {
    name: 'ai-atlas:theme-bootstrap',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { 'data-theme-bootstrap': '' },
              children: NO_FLASH_SCRIPT,
              injectTo: 'head-prepend',
            },
          ],
        }
      },
    },
  }
}

/**
 * The absolute origin, needed for canonical URLs and Open Graph tags, which
 * cannot be relative. Overridable for a fork or a custom domain.
 */
const siteOrigin = (process.env.VITE_SITE_URL ?? 'https://pranav-jj.github.io').replace(/\/$/, '')

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Rewrites one page's <head> for a specific route.
 *
 * Replaces the title and description that index.html ships with, and adds
 * canonical and Open Graph tags. Social crawlers do not run JavaScript, so
 * metadata applied by React at runtime never reaches a link preview — this is
 * the only place per-route sharing metadata can actually come from on a static
 * host.
 */
function renderHeadFor(html: string, route: RouteMeta, base: string): string {
  const url = `${siteOrigin}${base}${route.path === '/' ? '' : route.path.replace(/^\//, '')}`
  const title = escapeHtml(formatTitle(route.title))
  const description = escapeHtml(route.description)

  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="AI Atlas" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ].join('\n    ')

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace('</head>', `    ${tags}\n  </head>`)
}

function buildSitemap(routes: readonly RouteMeta[], base: string, lastmod: string): string {
  const entries = routes
    .map((route) => {
      const url = `${siteOrigin}${base}${route.path === '/' ? '' : route.path.replace(/^\//, '')}`
      return [
        '  <url>',
        `    <loc>${escapeHtml(url)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority.toFixed(1)}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

/**
 * Pre-renders every route as a real file with its own metadata.
 *
 * Two things this buys on a host with no rewrite rules: a true HTTP 200 with no
 * redirect flash, and a correct link preview when someone shares the page.
 * Each file is a copy of index.html with a rewritten head, which costs a couple
 * of kilobytes per route and needs no rendering framework.
 */
function staticRoutes(): Plugin {
  return {
    name: 'ai-atlas:static-routes',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir

      if (!outDir) {
        throw new Error('static-routes: could not determine the output directory')
      }

      // Imported here, not at module scope: the file is generated by prebuild
      // and may not exist when the config is first evaluated.
      const { allRoutes } = (await import('./src/content/generated/routes.ts')) as {
        allRoutes: readonly RouteMeta[]
      }

      const indexPath = join(outDir, 'index.html')
      const template = await readFile(indexPath, 'utf8')
      const lastmod = new Date().toISOString().slice(0, 10)

      for (const route of allRoutes) {
        const html = renderHeadFor(template, route, basePath)

        if (route.path === '/') {
          await writeFile(indexPath, html, 'utf8')
          continue
        }

        const dir = join(outDir, route.path.replace(/^\/+|\/+$/g, ''))
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'index.html'), html, 'utf8')
      }

      await writeFile(
        join(outDir, 'sitemap.xml'),
        buildSitemap(allRoutes, basePath, lastmod),
        'utf8',
      )

      await writeFile(
        join(outDir, 'robots.txt'),
        ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteOrigin}${basePath}sitemap.xml`, ''].join(
          '\n',
        ),
        'utf8',
      )

      console.log(`  pre-rendered ${allRoutes.length} routes, sitemap.xml and robots.txt`)
    },
  }
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), themeBootstrap(), spaFallback404(basePath), staticRoutes()],
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
    /*
     * Well above the 5s default. Two things in this suite are legitimately slow
     * and neither indicates a problem: axe-core scanning a full page of results
     * in jsdom, and code-split routes resolving a dynamic import. Both get
     * slower again when files run in parallel. Durations are still reported, so
     * a genuine regression remains visible.
     */
    testTimeout: 30_000,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.{ts,tsx}'],
      /*
       * Enforced from Phase 13. It was deliberately left off earlier: a
       * threshold over a nearly empty directory is a false green. src/lib is
       * now substantial, so the plan's >=90% line target becomes a gate.
       */
      thresholds: { lines: 90, functions: 90, statements: 90 },
    },
  },
})
