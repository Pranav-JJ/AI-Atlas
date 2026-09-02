import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { topics } from '@/content/generated/index.ts'

import { App } from './App.tsx'
import { STATIC_ROUTES } from './routes-manifest.ts'

function renderAt(path: string): ReturnType<typeof render> {
  const ui: ReactElement = (
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
  return render(ui)
}

/** Every route the app is expected to render, including a dynamic one. */
const ALL_ROUTES = [...STATIC_ROUTES, '/topics/nlp', '/does-not-exist']

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('routing', () => {
  it('renders the home page at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Atlas')
  })

  it('renders the topic map at /topics', () => {
    renderAt('/topics')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/topic map/i)
  })

  it('renders a real topic at /topics/:topicId', () => {
    renderAt('/topics/nlp')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /natural language processing/i,
    )
  })

  it('renders the methodology page at /about', () => {
    renderAt('/about')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /methodology and source policy/i,
    )
  })

  it('404s an unknown topic id rather than rendering an empty topic page', () => {
    renderAt('/topics/not-a-real-topic')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
  })

  it('renders the project explorer at /projects', async () => {
    renderAt('/projects')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/project ideas/i)
  })

  it('renders the papers index at /papers', async () => {
    renderAt('/papers')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /papers and research/i,
    )
  })

  it('renders the dataset explorer at /datasets', async () => {
    renderAt('/datasets')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /datasets and benchmarks/i,
    )
  })

  it('renders the learning paths index at /paths', async () => {
    renderAt('/paths')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/learning paths/i)
  })

  it('renders a real path at /paths/:pathId', async () => {
    renderAt('/paths/path-nlp-foundations')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/nlp foundations/i)
  })

  it('renders the progress page at /progress', async () => {
    renderAt('/progress')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/your progress/i)
  })

  it('renders onboarding at /onboarding', async () => {
    renderAt('/onboarding')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /where are you starting/i,
    )
  })

  it('renders the resource library at /library', async () => {
    renderAt('/library')
    // Code-split, so the heading arrives after the Suspense fallback.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/resource library/i)
  })

  it('404s an unknown route, naming the path that was missed', () => {
    renderAt('/nowhere-at-all')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
    expect(screen.getByText('/nowhere-at-all')).toBeVisible()
  })

  it('does not expose routes for features that are not built yet', async () => {
    // A stub page behind a working link is worse than an honest 404.
    // findBy, not getBy: the route tree sits inside a Suspense boundary, so the
    // first paint can be the fallback rather than the page.
    for (const path of ['/glossary', '/nothing-here']) {
      const { unmount } = renderAt(path)
      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
      unmount()
    }
  })
})

describe('page structure', () => {
  it.each(ALL_ROUTES)('has exactly one h1 at %s', async (path) => {
    renderAt(path)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.each(ALL_ROUTES)('never skips a heading level at %s', async (path) => {
    const { container } = renderAt(path)
    await screen.findByRole('heading', { level: 1 })
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
      Number(h.tagName[1]),
    )

    let previous = levels[0] ?? 1
    for (const level of levels) {
      expect(
        level - previous,
        `jumped from h${previous} to h${level} at ${path}`,
      ).toBeLessThanOrEqual(1)
      previous = level
    }
  })

  it('exposes a skip-to-content link targeting the main landmark', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('puts the skip link first in the tab order', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.tab()
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveFocus()
  })

  it('has exactly one main landmark', () => {
    renderAt('/')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})

describe('app shell', () => {
  it('shows primary navigation on every route', () => {
    renderAt('/topics/nlp')
    const nav = screen.getByRole('navigation', { name: 'Primary' })

    expect(within(nav).getByRole('link', { name: 'Topics' })).toBeVisible()
    expect(within(nav).getByRole('link', { name: 'Methodology' })).toBeVisible()
  })

  it('does not link to features that do not exist yet', () => {
    // The footer lists them as plain text under "Planned" instead. Scoped to the
    // footer because some of these words legitimately appear elsewhere on the
    // page — "Learning paths" is also a catalogue count on the home page.
    renderAt('/')
    const footer = within(screen.getByRole('contentinfo'))

    for (const label of [/^Glossary$/]) {
      expect(footer.queryByRole('link', { name: label })).not.toBeInTheDocument()
      expect(footer.getByText(label)).toBeVisible()
    }
  })

  it('does not announce the mobile navigation twice to screen readers', () => {
    renderAt('/')
    // Header nav + footer nav are exposed; the duplicated mobile bar is not.
    const navNames = screen
      .getAllByRole('navigation')
      .map((n) => n.getAttribute('aria-label'))
      .filter(Boolean)

    expect(navNames).toEqual(['Primary', 'Footer'])
  })

  it('offers the theme toggle from every page', () => {
    renderAt('/about')
    expect(screen.getByRole('radiogroup', { name: /colour theme/i })).toBeVisible()
  })
})

describe('topic pages use real catalogue content', () => {
  it('lists every domain on the topic map', () => {
    renderAt('/topics')
    for (const label of ['Foundations', 'Machine Learning', 'Deep Learning']) {
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(label, 'i') })).toBeVisible()
    }
  })

  it('states that the taxonomy is one map rather than the curriculum', () => {
    renderAt('/topics')
    expect(screen.getByText(/not a claim about the only correct/i)).toBeVisible()
  })

  it('shows breadcrumbs on a nested topic', () => {
    renderAt('/topics/attention')
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })

    expect(within(crumbs).getByRole('link', { name: 'Topics' })).toBeVisible()
    expect(within(crumbs).getByRole('link', { name: /deep learning/i })).toBeVisible()
  })

  it('shows assumed background as prerequisites, framed as guidance not gates', () => {
    renderAt('/topics/attention')
    expect(screen.getByText(/prerequisites, not gates/i)).toBeVisible()
  })

  it('shows resource counts as counts, never percentages', () => {
    renderAt('/topics')
    expect(screen.getAllByText(/\d+ resources?$/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\d+% of/)).not.toBeInTheDocument()
  })

  it('renders an honest empty state for a topic with no resources', () => {
    // Pick a topic that genuinely has nothing tagged to it.
    const empty = topics.find((t) => t.id === 'governance-compliance')
    expect(empty).toBeDefined()

    renderAt(`/topics/${empty!.id}`)
    expect(screen.getByText(/nobody has added something good yet/i)).toBeVisible()
  })

  it('marks every resource link with its verification state', () => {
    renderAt('/topics/text-preprocessing-tokenization')
    // Every seeded resource is unverified, and each one says so.
    expect(screen.getAllByText('Unverified').length).toBeGreaterThan(0)
  })

  it('opens resource links safely in a new tab', () => {
    renderAt('/topics/text-preprocessing-tokenization')
    const external = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('target') === '_blank')

    expect(external.length).toBeGreaterThan(0)
    for (const link of external) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})

describe('accessibility', () => {
  it.each(ALL_ROUTES)('has no blocking violations at %s', async (path) => {
    const { container } = renderAt(path)
    await screen.findByRole('heading', { level: 1 })
    await expectNoA11yViolations(container)
  })

  it.each(ALL_ROUTES)('reaches every interactive element by keyboard at %s', async (path) => {
    const { container } = renderAt(path)
    await screen.findByRole('heading', { level: 1 })

    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )
    expect(focusable.length).toBeGreaterThan(0)

    for (const element of focusable) {
      const tabIndex = element.getAttribute('tabindex')
      // -1 is allowed only for the mobile nav duplicate, which is aria-hidden
      // and mirrors links that ARE reachable in the header.
      if (tabIndex === '-1') {
        expect(element.closest('[aria-hidden="true"]')).not.toBeNull()
        continue
      }
      // A positive tabindex would reorder the tab sequence unpredictably.
      expect(Number(tabIndex ?? 0)).toBeLessThanOrEqual(0)
    }
  })
})
