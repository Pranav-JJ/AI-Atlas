import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

import '@testing-library/jest-dom/vitest'

/*
 * Testing Library's 1s default for findBy* is too tight for this app: routes
 * are code-split, so a page render resolves a dynamic import first, and that is
 * measurably slower when the whole suite runs in parallel. Raising it once here
 * beats scattering per-assertion timeouts, which hide the reason.
 */
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/*
 * jsdom does not implement matchMedia, which the theme layer and the
 * prefers-reduced-motion checks both read. Default every query to "no match"
 * so tests describe the light/no-preference baseline unless they opt in.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

/*
 * jsdom lacks IntersectionObserver, used by the library's progressive loading (Phase 4).
 * The lib.dom types declare it on Window unconditionally, so the presence check has to
 * go through a widened reference — otherwise TS narrows `window` to `never`.
 */
const globalWindow = window as unknown as Record<string, unknown>

if (typeof globalWindow.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  globalWindow.IntersectionObserver = MockIntersectionObserver
}
