import { Link, useLocation } from 'react-router'

import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'

/**
 * Rendered for any unmatched route.
 *
 * Note this is the React 404, reached AFTER the GitHub Pages fallback has already
 * restored the requested URL. The static dist/404.html is a different thing: it
 * only redirects, and is never seen for longer than a moment.
 */
export function NotFound() {
  const { pathname } = useLocation()

  useDocumentMeta('Page not found')

  return (
    <>
      <p className="text-fg-subtle font-mono text-sm tracking-wide uppercase">404</p>

      <h1 className="text-fg mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>

      <p className="text-fg-muted mt-4 leading-relaxed">
        There is nothing at <code className="text-fg font-mono text-[0.9em]">{pathname}</code>.
      </p>

      <p className="text-fg-muted mt-3 leading-relaxed">
        Much of AI Atlas has not been built yet, so this is far more likely to be a page that does
        not exist yet than a broken link. The topic map and methodology pages are live.
      </p>

      <p className="mt-6 flex flex-wrap gap-4">
        <Link to="/" className="text-accent underline underline-offset-2">
          Go to the home page
        </Link>
        <Link to="/topics" className="text-accent underline underline-offset-2">
          Browse the topic map
        </Link>
      </p>
    </>
  )
}
