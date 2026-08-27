import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router'

import { AppShell } from './app/AppShell.tsx'
import { ErrorBoundary, Skeleton } from './components/index.ts'
import { About } from './pages/About.tsx'
import { Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { TopicDetail } from './pages/TopicDetail.tsx'
import { Topics } from './pages/Topics.tsx'

/*
 * The library and resource detail pages are code-split.
 *
 * They pull in the filter rail, the sort controls and (indirectly) the search
 * runtime, none of which the home or topic pages need. Splitting keeps the
 * initial download to what the first screen actually uses.
 */
const Library = lazy(() => import('./pages/Library.tsx').then((m) => ({ default: m.Library })))
const ResourceDetail = lazy(() =>
  import('./pages/ResourceDetail.tsx').then((m) => ({ default: m.ResourceDetail })),
)

function RouteFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" label="Loading page" />
      <Skeleton className="h-5 w-full max-w-prose" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/**
 * Route table.
 *
 * Only routes that render real content are declared. Stub routes for features
 * that do not exist yet are deliberately omitted — an empty page behind a
 * working link is worse than an honest 404, because it costs the user a click
 * to discover the same thing.
 *
 * Bookmarks, progress and learning paths arrive in Phases 5 to 7.
 */
export function App() {
  const { pathname } = useLocation()

  return (
    <AppShell>
      {/* Keyed by route so a crash on one page clears when the user navigates
          away, instead of leaving the boundary stuck on every subsequent page. */}
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/library/:resourceId" element={<ResourceDetail />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/topics/:topicId" element={<TopicDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}
