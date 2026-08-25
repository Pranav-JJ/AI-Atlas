import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'

import { App } from './App.tsx'

describe('App (Phase 0 scaffold)', () => {
  it('renders exactly one h1 naming the product', () => {
    render(<App />)

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('AI Atlas')
  })

  it('exposes a skip-to-content link targeting the main landmark', () => {
    render(<App />)

    const skipLink = screen.getByRole('link', { name: /skip to content/i })
    expect(skipLink).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('states honestly that this is a scaffold rather than implying working features', () => {
    render(<App />)

    expect(
      screen.getByText(/no content, routes, search or progress tracking exist yet/i),
    ).toBeVisible()
  })

  it('has no blocking accessibility violations', async () => {
    const { container } = render(<App />)
    await expectNoA11yViolations(container)
  })
})
