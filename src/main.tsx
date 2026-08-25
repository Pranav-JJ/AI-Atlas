import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from './App.tsx'
import { applyFallbackRedirect } from './lib/spa-fallback.ts'
import './styles/global.css'

/*
 * Must run before the router reads location: if this load came from the GitHub
 * Pages 404.html redirect, the real route is still encoded in the query string.
 */
applyFallbackRedirect()

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root container #root was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    {/* BASE_URL carries the Pages subpath, so every <Link> resolves correctly. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
