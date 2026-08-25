import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'

import { App } from './App.tsx'

function renderAt(path: string): ReturnType<typeof render> {
  const ui: ReactElement = (
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
  return render(ui)
}

describe('routing', () => {
  it('renders the home page at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Atlas')
  })

  it('renders the methodology page at /about', () => {
    renderAt('/about')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /methodology and source policy/i,
    )
  })

  it('renders a 404 for an unknown route, naming the path that was missed', () => {
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
    expect(screen.getByText('/does-not-exist')).toBeVisible()
  })

  it('does not expose routes for features that are not built yet', () => {
    // A stub page behind a working link is worse than an honest 404.
    renderAt('/library')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
  })
})

describe('page structure', () => {
  it.each(['/', '/about', '/nope'])('has exactly one h1 at %s', (path) => {
    renderAt(path)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('exposes a skip-to-content link targeting the main landmark', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('states honestly that this is a scaffold rather than implying working features', () => {
    renderAt('/')
    expect(screen.getByText(/no content, search or progress tracking exists yet/i)).toBeVisible()
  })
})

describe('accessibility', () => {
  it.each(['/', '/about', '/nope'])('has no blocking violations at %s', async (path) => {
    const { container } = renderAt(path)
    await expectNoA11yViolations(container)
  })
})
