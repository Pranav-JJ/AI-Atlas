import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { App } from './App.tsx'
import { STATIC_ROUTES } from './routes-manifest.ts'

/**
 * The manifest and the route table are two lists that must agree.
 *
 * If a route is pre-rendered but not actually routed, GitHub Pages serves it with
 * a confident HTTP 200 and the app then renders "Page not found" into it — the
 * worst of both worlds, and invisible without this check.
 */
describe('STATIC_ROUTES', () => {
  it.each([...STATIC_ROUTES])('%s resolves to a real page, not the 404 view', (route) => {
    render(createElement(MemoryRouter, { initialEntries: [route] }, createElement(App)))

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).not.toHaveTextContent(/page not found/i)
  })

  it('declares every route with a leading slash and no trailing slash', () => {
    for (const route of STATIC_ROUTES) {
      expect(route.startsWith('/')).toBe(true)
      if (route !== '/') expect(route.endsWith('/')).toBe(false)
    }
  })

  it('contains no duplicates', () => {
    expect(new Set(STATIC_ROUTES).size).toBe(STATIC_ROUTES.length)
  })
})
