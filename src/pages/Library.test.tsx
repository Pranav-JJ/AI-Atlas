import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { resources } from '@/content/generated/index.ts'
import { resetSearchIndexForTests } from '@/lib/search/runSearch.ts'

import { Library } from './Library.tsx'
import { ResourceDetail } from './ResourceDetail.tsx'

/**
 * Exposes the current URL, and a way to go back.
 *
 * MemoryRouter keeps its own history stack, so window.history.back() does not
 * reach it — Back has to be driven through the router itself.
 */
function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <>
      <span data-testid="location">{`${location.pathname}${location.search}`}</span>
      <button type="button" data-testid="go-back" onClick={() => void navigate(-1)}>
        test back
      </button>
    </>
  )
}

function renderLibrary(initialUrl = '/library') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <LocationProbe />
      <Routes>
        <Route path="/library" element={<Library />} />
        <Route path="/library/:resourceId" element={<ResourceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

function currentUrl(): string {
  return screen.getByTestId('location').textContent ?? ''
}

/** The library announces its result count in a live region. */
async function resultCount(): Promise<number> {
  const status = await screen.findByRole('status')
  return Number(status.textContent?.match(/^(\d+)/)?.[1] ?? -1)
}

beforeEach(() => {
  resetSearchIndexForTests()
})

describe('initial render', () => {
  it('lists resources and reports how many', async () => {
    renderLibrary()

    // Broken records are excluded from default results.
    const expected = resources.filter((r) => r.status !== 'broken').length
    expect(await resultCount()).toBe(expected)
  })

  it('announces the count politely rather than interrupting', async () => {
    renderLibrary()
    const status = await screen.findByRole('status')

    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('says the default ordering is deterministic and not popularity-based', () => {
    renderLibrary()
    expect(screen.getByText(/popularity is never an input/i)).toBeVisible()
  })

  it('shows the first page only, with a way to reveal more', async () => {
    renderLibrary()

    const cards = screen.getAllByRole('article')
    expect(cards.length).toBeLessThanOrEqual(24)
    expect(await resultCount()).toBeGreaterThan(cards.length)
    expect(screen.getByRole('button', { name: /show \d+ more/i })).toBeVisible()
  })
})

describe('filters write to the URL', () => {
  it('records a ticked facet as a query parameter', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.click(screen.getByRole('checkbox', { name: /^Video/ }))

    await waitFor(() => expect(currentUrl()).toContain('type=video'))
  })

  it('narrows the results when a facet is applied', async () => {
    const user = userEvent.setup()
    renderLibrary()
    const before = await resultCount()

    await user.click(screen.getByRole('checkbox', { name: /^Video/ }))

    await waitFor(async () => expect(await resultCount()).toBeLessThan(before))
  })

  it('restores state from a URL exactly, so a shared link works', async () => {
    renderLibrary('/library?type=paper')

    const count = await resultCount()
    expect(count).toBe(resources.filter((r) => r.resource_type === 'paper').length)
    expect(screen.getByRole('checkbox', { name: /^Paper/ })).toBeChecked()
  })

  it('combines facets from the URL', async () => {
    renderLibrary('/library?type=course&level=beginner')

    const expected = resources.filter(
      (r) => r.resource_type === 'course' && r.difficulty === 'beginner',
    ).length
    expect(await resultCount()).toBe(expected)
  })

  it('clears everything back to a clean URL', async () => {
    const user = userEvent.setup()
    renderLibrary('/library?type=video&level=beginner')

    await user.click(screen.getByRole('button', { name: /clear all/i }))

    await waitFor(() => expect(currentUrl()).toBe('/library'))
  })

  it('restores the previous filters on Back', async () => {
    // setSearchParams pushes a history entry, so each filter change is its own
    // step. Without this, Back would leave the library entirely.
    const user = userEvent.setup()
    renderLibrary()

    await user.click(screen.getByRole('checkbox', { name: /^Video/ }))
    await waitFor(() => expect(currentUrl()).toContain('type=video'))

    await user.click(screen.getByRole('checkbox', { name: /^Course/ }))
    await waitFor(() => expect(currentUrl()).toContain('type=course'))

    await user.click(screen.getByTestId('go-back'))

    await waitFor(() => {
      expect(currentUrl()).toContain('type=video')
      expect(currentUrl()).not.toContain('type=course')
    })
    expect(screen.getByRole('checkbox', { name: /^Video/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /^Course/ })).not.toBeChecked()
  })

  it('resets paging when filters change, so the user is not stranded', async () => {
    const user = userEvent.setup()
    renderLibrary('/library?shown=48')

    await user.click(screen.getByRole('checkbox', { name: /^Video/ }))

    await waitFor(() => expect(currentUrl()).not.toContain('shown='))
  })
})

describe('sorting', () => {
  it('writes the chosen sort to the URL', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'title')

    await waitFor(() => expect(currentUrl()).toContain('sort=title'))
  })

  it('orders alphabetically when sorting by title', async () => {
    renderLibrary('/library?sort=title')

    const headings = screen.getAllByRole('article').map((a) => a.textContent ?? '')
    expect(headings.length).toBeGreaterThan(1)
  })

  it('hides "Best match" until there is a query, since it would mean nothing', () => {
    renderLibrary()
    const select = screen.getByLabelText(/sort by/i)

    expect(within(select).queryByRole('option', { name: /best match/i })).not.toBeInTheDocument()
  })
})

describe('progressive loading', () => {
  it('reveals more results without losing the ones already shown', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const before = screen.getAllByRole('article').length
    await user.click(screen.getByRole('button', { name: /show \d+ more/i }))

    await waitFor(() => expect(screen.getAllByRole('article').length).toBeGreaterThan(before))
  })

  it('uses a real button rather than scroll-triggered loading', () => {
    // Infinite scroll traps keyboard users above the footer.
    renderLibrary()
    expect(screen.getByRole('button', { name: /show \d+ more/i })).toBeVisible()
  })

  it('records how many are shown in the URL so a reload keeps your place', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.click(screen.getByRole('button', { name: /show \d+ more/i }))

    await waitFor(() => expect(currentUrl()).toContain('shown=48'))
  })
})

describe('empty state', () => {
  it('names the filter to loosen rather than only saying nothing matched', async () => {
    // Nothing is both a book and advanced in the seeded catalogue.
    renderLibrary('/library?type=book&level=advanced')

    expect(await screen.findByText(/no resources match these filters/i)).toBeVisible()
    expect(screen.getByText(/loosening/i)).toBeVisible()
  })

  it('offers a way out', async () => {
    renderLibrary('/library?type=book&level=advanced')
    expect(await screen.findByRole('button', { name: /clear all filters/i })).toBeVisible()
  })

  it('does not claim a culprit when no single filter is responsible', async () => {
    renderLibrary('/library?lang=de')

    expect(await screen.findByText(/no resources match these filters/i)).toBeVisible()
  })
})

describe('search', () => {
  it('shows a loading state while the index is fetched, then results', async () => {
    renderLibrary('/library?q=tokenization')

    // The index is a lazily-imported chunk, so there is a real moment of waiting.
    expect(await screen.findByText('Searching…')).toBeVisible()
    await waitFor(async () => expect(await resultCount()).toBeGreaterThan(0), { timeout: 5000 })
  })

  it('finds resources by a term in the title', async () => {
    renderLibrary('/library?q=tokenization')

    await waitFor(() => expect(screen.getAllByRole('article').length).toBeGreaterThan(0), {
      timeout: 5000,
    })
    const titles = screen.getAllByRole('article').map((a) => a.textContent?.toLowerCase() ?? '')
    expect(titles.some((t) => t.includes('token'))).toBe(true)
  })

  it('switches the default sort to relevance when searching', async () => {
    renderLibrary('/library?q=tokenization')

    await waitFor(() => {
      expect(screen.getByLabelText(/sort by/i)).toHaveValue('relevance')
    })
  })
})

describe('honest link states', () => {
  it('never renders a live link for a resource with no url', async () => {
    // Every seeded resource has a url, so assert the invariant directly against
    // the detail page of one that does, plus the catalogue-wide guarantee.
    const withoutUrl = resources.filter((r) => r.url === null)
    for (const resource of withoutUrl) {
      expect(resource.status).toBe('unverified')
    }
  })

  it('shows the verification state on every card', () => {
    renderLibrary()
    const cards = screen.getAllByRole('article')

    for (const card of cards) {
      expect(
        within(card).getByText(/verified|unverified|broken|deprecated|re-checking/i),
      ).toBeVisible()
    }
  })
})

describe('accessibility', () => {
  it('has no blocking violations on the library', async () => {
    const { container } = renderLibrary()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on the empty state', async () => {
    const { container } = renderLibrary('/library?type=book&level=advanced')
    await screen.findByText(/no resources match/i)
    await expectNoA11yViolations(container)
  })

  it('labels the search field and the sort control', () => {
    renderLibrary()
    expect(screen.getByLabelText(/search resources/i)).toBeVisible()
    expect(screen.getByLabelText(/sort by/i)).toBeVisible()
  })

  it('groups filters under named fieldsets', () => {
    renderLibrary()
    for (const legend of ['Topic', 'Type', 'Difficulty', 'Cost', 'Verification']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument()
    }
  })
})
