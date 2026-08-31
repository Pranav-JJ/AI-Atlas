import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { resources } from '@/content/generated/index.ts'
import type { SafeStorage } from '@/lib/storage/safeStorage.ts'
import { __resetStoreForTests, useUserStore } from '@/lib/storage/store.ts'

import { Dashboard } from './Dashboard.tsx'

function memoryStorage(): SafeStorage {
  const map = new Map<string, string>()
  return {
    read: (k) => map.get(k) ?? null,
    write: (k, v) => {
      map.set(k, v)
      return true
    },
    remove: (k) => {
      map.delete(k)
    },
    availability: 'available',
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

/** A linkable resource from the real catalogue, for realistic assertions. */
const linkable = resources.filter((r) => r.url !== null)
const first = linkable[0]!
const second = linkable[1]!

beforeEach(() => {
  __resetStoreForTests(memoryStorage())
})

describe('a brand-new visitor', () => {
  it('is greeted by name, not by an empty dashboard', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Atlas')
  })

  it('shows NO zeroed counters or empty progress widgets', () => {
    // The acceptance criterion for this phase. "0 saved, 0 done, 0%" tells a new
    // arrival nothing and reads as broken.
    renderDashboard()

    expect(screen.queryByText(/0 saved/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/0 marked done/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows no percentage anywhere on the page', () => {
    const { container } = renderDashboard()
    expect(container.textContent).not.toMatch(/\d+\s?%/)
  })

  it('offers exactly one call to action, plus a way to skip it', () => {
    renderDashboard()

    expect(screen.getByRole('link', { name: /set your starting point/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /just browse the library/i })).toBeVisible()
    // "Not now" is for returning users; a first visit has nothing to dismiss.
    expect(screen.queryByRole('button', { name: /not now/i })).not.toBeInTheDocument()
  })

  it('still suggests something, and says the suggestion is not personalised', () => {
    renderDashboard()

    const start = screen.getByRole('heading', { name: 'Start here' }).parentElement!.parentElement!
    expect(within(start).getByText(/tell us your level for better suggestions/i)).toBeVisible()
  })

  it('hides the sections that would be empty', () => {
    renderDashboard()

    expect(screen.queryByRole('heading', { name: 'Saved' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recently viewed' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /what you have covered/i }),
    ).not.toBeInTheDocument()
  })

  it('says plainly that learning paths are not built yet', () => {
    // Rather than rendering a progress bar with nothing behind it.
    renderDashboard()
    expect(screen.getByText(/learning paths are not in the catalogue yet/i)).toBeVisible()
  })
})

describe('a returning visitor', () => {
  it('greets them differently and summarises their state', () => {
    useUserStore.getState().toggleBookmark(first.id)
    useUserStore.getState().toggleCompletion(second.id)
    renderDashboard()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/welcome back/i)
    expect(screen.getByText(/1 saved, 1 marked done/i)).toBeVisible()
  })

  it('lists saved resources', () => {
    useUserStore.getState().toggleBookmark(first.id)
    renderDashboard()

    const saved = screen.getByRole('heading', { name: 'Saved' }).parentElement!.parentElement!
    expect(within(saved).getByRole('link', { name: first.title })).toBeVisible()
  })

  it('lists recently viewed resources', () => {
    useUserStore.getState().recordView(first.id)
    renderDashboard()

    expect(screen.getByRole('heading', { name: 'Recently viewed' })).toBeVisible()
  })

  it('offers to resume the most recent unfinished thing', () => {
    useUserStore.getState().recordView(first.id)
    renderDashboard()

    expect(screen.getByRole('heading', { name: /pick up where you left off/i })).toBeVisible()
  })

  it('does not offer to resume something already finished', () => {
    useUserStore.getState().recordView(first.id)
    useUserStore.getState().toggleCompletion(first.id)
    renderDashboard()

    expect(
      screen.queryByRole('heading', { name: /pick up where you left off/i }),
    ).not.toBeInTheDocument()
  })

  it('does not repeat the recommendation in the resume slot', () => {
    // Showing the same resource twice in adjacent cards looks like a bug.
    renderDashboard()
    const startHeading = screen.getByRole('heading', { name: 'Start here' })
    const recommended = startHeading.parentElement!.parentElement!.textContent ?? ''

    const resume = screen.queryByRole('heading', { name: /pick up where you left off/i })
    if (resume) {
      const resumeText = resume.parentElement!.parentElement!.textContent ?? ''
      expect(recommended === resumeText).toBe(false)
    }
  })

  it('still shows the onboarding prompt if they never set a profile', () => {
    useUserStore.getState().toggleBookmark(first.id)
    renderDashboard()

    expect(screen.getByRole('link', { name: /set your starting point/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /not now/i })).toBeVisible()
  })

  it('lets the onboarding prompt be dismissed for good', async () => {
    const user = userEvent.setup()
    useUserStore.getState().toggleBookmark(first.id)
    renderDashboard()

    await user.click(screen.getByRole('button', { name: /not now/i }))

    expect(screen.queryByRole('link', { name: /set your starting point/i })).not.toBeInTheDocument()
  })

  it('hides the prompt once a profile exists', () => {
    useUserStore.getState().setLevel('beginner')
    renderDashboard()

    expect(screen.queryByRole('link', { name: /set your starting point/i })).not.toBeInTheDocument()
  })
})

describe('the recommendation reflects the profile', () => {
  it('states that it matches a stated goal', () => {
    useUserStore.getState().setGoal('nlp-practitioner')
    useUserStore.getState().setLevel('beginner')
    renderDashboard()

    const start = screen.getByRole('heading', { name: 'Start here' }).parentElement!.parentElement!
    expect(within(start).getByText(/matches your goal/i)).toBeVisible()
  })

  it('advances after the recommended resource is completed', () => {
    // The acceptance criterion: completing the suggestion moves it on.
    useUserStore.getState().setGoal('nlp-practitioner')
    const { unmount } = renderDashboard()

    const startSection = () =>
      screen.getByRole('heading', { name: 'Start here' }).parentElement!.parentElement!
    const firstTitle = within(startSection()).getAllByRole('link')[0]!.textContent!

    // Find and complete whichever resource was recommended.
    const recommended = resources.find((r) => r.title === firstTitle)
    expect(recommended).toBeDefined()
    unmount()

    useUserStore.getState().toggleCompletion(recommended!.id)
    renderDashboard()

    const nextTitle = within(startSection()).getAllByRole('link')[0]!.textContent
    expect(nextTitle).not.toBe(firstTitle)
  })
})

describe('topic coverage', () => {
  it('is hidden until something has been completed', () => {
    renderDashboard()
    expect(
      screen.queryByRole('heading', { name: /what you have covered/i }),
    ).not.toBeInTheDocument()
  })

  it('reports counts, never percentages', () => {
    useUserStore.getState().toggleCompletion(first.id)
    const { container } = renderDashboard()

    expect(screen.getByRole('heading', { name: /what you have covered/i })).toBeVisible()
    expect(screen.getAllByText(/completed of \d+ in the catalogue/i).length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/\d+\s?%/)
  })

  it('says outright that a count is not a measure of knowledge', () => {
    useUserStore.getState().toggleCompletion(first.id)
    renderDashboard()

    expect(screen.getByText(/not a measure of how much of a subject you know/i)).toBeVisible()
  })
})

describe('quick links', () => {
  it('links only to surfaces that exist', () => {
    renderDashboard()
    const section = screen.getByRole('heading', { name: /go somewhere/i }).parentElement!
      .parentElement!

    const hrefs = within(section)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))

    expect(hrefs).toEqual(['/library', '/topics', '/progress'])
    expect(hrefs).not.toContain('/glossary')
    expect(hrefs).not.toContain('/projects')
  })
})

describe('accessibility', () => {
  it('has no blocking violations on a first visit', async () => {
    const { container } = renderDashboard()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations for a returning visitor', async () => {
    useUserStore.getState().setLevel('intermediate')
    useUserStore.getState().setGoal('build-llm-apps')
    useUserStore.getState().toggleBookmark(first.id)
    useUserStore.getState().toggleCompletion(second.id)
    useUserStore.getState().recordView(first.id)

    const { container } = renderDashboard()
    await expectNoA11yViolations(container)
  })

  it('has exactly one h1', () => {
    renderDashboard()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
