/**
 * Static routes that are pre-rendered as real files at build time.
 *
 * GitHub Pages has no rewrite rules, so an SPA route is normally served by
 * 404.html — which works, but costs an HTTP 404 status, a redirect flash, and
 * makes the page look broken to anything that does not run JavaScript.
 *
 * For routes known at build time we instead emit a copy of index.html at that
 * path (`/about` -> `dist/about/index.html`), so Pages serves it directly with a
 * 200. The 404.html fallback then only has to handle genuinely dynamic routes
 * such as /library/:resourceId.
 *
 * Asset URLs inside index.html are absolute (they include the base path), so a
 * copy works correctly at any directory depth.
 *
 * KEEP IN SYNC with the route table in src/App.tsx. The test in
 * src/routes-manifest.test.ts fails if a route is declared here but not routed.
 */
export const STATIC_ROUTES = ['/', '/about'] as const

export type StaticRoute = (typeof STATIC_ROUTES)[number]
