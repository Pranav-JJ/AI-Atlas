import { Route, Routes, useLocation } from 'react-router'

import { AppShell } from './app/AppShell.tsx'
import { ErrorBoundary } from './components/index.ts'
import { About } from './pages/About.tsx'
import { Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { TopicDetail } from './pages/TopicDetail.tsx'
import { Topics } from './pages/Topics.tsx'

/**
 * Route table.
 *
 * Only routes that render real content are declared. Stub routes for features
 * that do not exist yet are deliberately omitted — an empty page behind a
 * working link is worse than an honest 404, because it costs the user a click
 * to discover the same thing.
 *
 * Library, paths and progress arrive in Phases 4 to 7.
 */
export function App() {
  const { pathname } = useLocation()

  return (
    <AppShell>
      {/* Keyed by route so a crash on one page clears when the user navigates
          away, instead of leaving the boundary stuck on every subsequent page. */}
      <ErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/topics/:topicId" element={<TopicDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </AppShell>
  )
}
