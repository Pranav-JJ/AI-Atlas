/**
 * GitHub Pages SPA deep-link fallback.
 *
 * Pages is a static file server with no rewrite rules. A request for
 * `/AI-Atlas/library?q=nlp` finds no such file and serves `404.html`.
 *
 * The workaround: `404.html` encodes the requested route into the query string
 * and redirects to `index.html`, which decodes it back and rewrites history
 * before the router ever reads `location`. The user sees one redirect and lands
 * on the right route with query and hash intact.
 *
 *   requested   /AI-Atlas/library?q=nlp&type=video#results
 *   encoded     /AI-Atlas/?/library&q=nlp~and~type=video#results
 *   decoded     /AI-Atlas/library?q=nlp&type=video#results
 *
 * `&` is escaped to `~and~` because the encoded form uses `&` as its own
 * separator between the path and the original query.
 *
 * IMPORTANT: these functions are inlined verbatim into `404.html` at build time
 * (see the `spaFallback404` plugin in vite.config.ts) via Function.prototype
 * .toString(). They must therefore stay completely self-contained — no imports,
 * no references to module scope, no optional chaining on globals, nothing that
 * would break outside a bundle.
 */

const AMPERSAND_ESCAPE = '~and~'

/**
 * Runs in 404.html. Builds the `<base>/?/<route>` URL to redirect to.
 *
 * @param base     the Vite base path, with leading and trailing slash ('/AI-Atlas/' or '/')
 * @param pathname the requested pathname
 * @param search   the requested query string, including '?' (or '')
 * @param hash     the requested hash, including '#' (or '')
 */
export function encodeFallbackUrl(
  base: string,
  pathname: string,
  search: string,
  hash: string,
): string {
  const escape = '~and~'

  const route = pathname.indexOf(base) === 0 ? pathname.slice(base.length) : pathname.slice(1)

  const encodedRoute = route.split('&').join(escape)
  const encodedQuery = search ? '&' + search.slice(1).split('&').join(escape) : ''

  return base + '?/' + encodedRoute + encodedQuery + hash
}

/**
 * Runs in the app before the router mounts. Reverses `encodeFallbackUrl` and
 * rewrites the address bar via history.replaceState, leaving no extra entry in
 * the back stack.
 *
 * Returns the restored URL, or null if this was not a fallback redirect.
 */
export function decodeFallbackUrl(pathname: string, search: string, hash: string): string | null {
  // A fallback redirect always looks like `?/...`. Anything else is a normal visit.
  if (search.charAt(0) !== '?' || search.charAt(1) !== '/') return null

  const decoded = search
    .slice(1)
    .split('&')
    .map(function (part) {
      return part.split(AMPERSAND_ESCAPE).join('&')
    })
    .join('?')

  // pathname is the base with a trailing slash; `decoded` supplies its own leading slash.
  return pathname.replace(/\/$/, '') + decoded + hash
}

/**
 * Applies the fallback redirect, if one is pending, to the real browser history.
 * Call this once, before the router reads location.
 */
export function applyFallbackRedirect(): void {
  if (typeof window === 'undefined') return

  const { pathname, search, hash } = window.location
  const restored = decodeFallbackUrl(pathname, search, hash)

  if (restored !== null) {
    window.history.replaceState(null, '', restored)
  }
}
