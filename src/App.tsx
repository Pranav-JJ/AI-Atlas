import { Route, Routes } from 'react-router'

import { About } from './pages/About.tsx'
import { Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'

/**
 * Route table.
 *
 * Only routes that render something real are declared. Stub routes for pages
 * that do not exist yet are deliberately omitted — an empty page behind a working
 * link is worse than an honest 404. The remaining routes arrive with their
 * features in Phases 3 to 7.
 */
export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <main
        id="main"
        className="mx-auto flex min-h-dvh max-w-[var(--measure)] flex-col justify-center px-6 py-16"
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}
