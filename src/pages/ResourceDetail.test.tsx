import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { makeProvider, makeResource } from '@tests/fixtures/content.ts'

/**
 * The seeded catalogue contains no broken or link-less records, so the states
 * that matter most for honesty cannot be exercised against it. These tests
 * substitute a small catalogue that does contain them.
 */
vi.mock('@/content/generated/index.ts', () => ({
  topics: [
    {
      id: 'nlp',
      name: 'NLP',
      domain: 'nlp',
      parentId: null,
      short_definition: 'Working with human language, in enough words to pass validation.',
      prerequisiteTopics: [],
      order: 0,
    },
  ],
  providers: [
    makeProvider({ id: 'official-co', name: 'Official Co', kind: 'official' }),
    makeProvider({ id: 'a-blogger', name: 'A Blogger', kind: 'community' }),
  ],
  resources: [
    makeResource({
      id: 'good',
      title: 'A working resource',
      url: 'https://example.com/good',
      provider_id: 'official-co',
      status: 'verified',
      last_verified_at: '2026-08-01',
      verified_by: 'pranav',
      topics: ['nlp'],
      cost_type: 'free',
      learning_outcomes: ['Do the thing'],
      quality_notes: 'Written by the vendor whose product it documents.',
    }),
    makeResource({
      id: 'no-link',
      title: 'An entry awaiting sourcing',
      url: null,
      status: 'unverified',
      topics: ['nlp'],
    }),
    makeResource({
      id: 'dead',
      title: 'A dead link',
      url: 'https://example.com/gone',
      status: 'broken',
      topics: ['nlp'],
    }),
    makeResource({
      id: 'community',
      title: 'A community post',
      url: 'https://example.com/post',
      provider_id: 'a-blogger',
      status: 'unverified',
      topics: ['nlp'],
    }),
    makeResource({
      id: 'earns-nothing',
      title: 'A paid, unverified entry from nobody in particular',
      url: null,
      status: 'unverified',
      topics: ['nlp'],
      provider_id: null,
      cost_type: 'paid',
      learning_outcomes: [],
    }),
    makeResource({
      id: 'a-paper',
      title: 'A preprint',
      resource_type: 'paper',
      url: 'https://example.com/paper',
      status: 'unverified',
      topics: ['nlp'],
      authors: ['A. Researcher'],
      year: 2021,
      venue: null,
      peer_review_status: 'unknown',
      abstract_summary: null,
      key_idea: null,
      code_url: null,
      dataset_ids: [],
    }),
  ],
  contentManifest: {
    contentVersion: 'test',
    generatedAt: '2026-08-27',
    counts: {},
    verification: {},
  },
  learningPaths: [],
  projects: [],
  glossary: [],
}))

const { ResourceDetail } = await import('./ResourceDetail.tsx')

function renderDetail(id: string, search = '') {
  return render(
    <MemoryRouter initialEntries={[`/library/${id}${search}`]}>
      <Routes>
        <Route path="/library/:resourceId" element={<ResourceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('a normal resource', () => {
  it('renders the title as the page heading', () => {
    renderDetail('good')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A working resource')
  })

  it('offers the external link, safely', () => {
    renderDetail('good')
    const link = screen.getByRole('link', { name: /open at official co/i })

    expect(link).toHaveAttribute('href', 'https://example.com/good')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('labels our editorial opinion as ours, not the source’s', () => {
    renderDetail('good')
    expect(screen.getByText(/our editorial opinion, not a claim made by the source/i)).toBeVisible()
  })

  it('shows caveats when the record carries them', () => {
    renderDetail('good')
    expect(screen.getByText(/written by the vendor/i)).toBeVisible()
  })

  it('shows no verification banner for a verified record', () => {
    // The banner exists to flag doubt. A verified record has none to flag.
    renderDetail('good')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

describe('honest link states', () => {
  it('renders NO button for a resource with no url', () => {
    renderDetail('no-link')

    expect(screen.queryByRole('link', { name: /open at/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no link has been recorded/i)).toBeVisible()
  })

  it('renders NO live link for a broken resource', () => {
    renderDetail('dead')

    expect(screen.queryByRole('link', { name: /open at/i })).not.toBeInTheDocument()
    expect(screen.getByText(/reported broken and has been disabled/i)).toBeVisible()
    // The dead URL must not appear as an href anywhere on the page.
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('https://example.com/gone')
  })

  it('warns that an unverified record has not been checked by a person', () => {
    renderDetail('no-link')
    const banner = screen.getByRole('note')

    expect(banner).toHaveTextContent(/nobody has opened this link/i)
  })

  it('says explicitly that an automated check is not a human verification', () => {
    renderDetail('community')
    expect(screen.getByText(/not the same as a person confirming/i)).toBeVisible()
  })
})

describe('provenance', () => {
  it('labels community-created material as such', () => {
    renderDetail('community')
    expect(screen.getByText(/community-created/i)).toBeVisible()
  })

  it('reports peer review as unknown rather than omitting it', () => {
    // An arXiv identifier is not evidence of peer review. Wording now comes
    // from PaperClaims, which states the status and why it is not assumed.
    renderDetail('a-paper')
    expect(screen.getByText(/publication status unknown/i)).toBeVisible()
    expect(screen.getByText(/not evidence either way/i)).toBeVisible()
  })

  it('shows "Never" rather than a blank for an unverified record', () => {
    renderDetail('no-link')
    expect(screen.getByText('Never')).toBeVisible()
  })

  it('shows "None recorded" rather than a blank venue', () => {
    renderDetail('a-paper')
    expect(screen.getByText('None recorded')).toBeVisible()
  })

  it('omits the summary section entirely when neither summary exists', () => {
    // This fixture has no abstract_summary and no key_idea, so PaperClaims must
    // render nothing rather than two empty labelled boxes. The populated case is
    // covered against real content in Papers.test.tsx.
    renderDetail('a-paper')

    expect(screen.queryByRole('heading', { name: /what the source says/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /our reading/i })).not.toBeInTheDocument()
    // Publication status is still rendered, because it is never optional.
    expect(screen.getByText('Peer review')).toBeVisible()
  })
})

describe('ranking explanation', () => {
  it('lists the terms that produced the score', () => {
    renderDetail('good')

    expect(screen.getByText(/a person has verified this link/i)).toBeVisible()
    expect(screen.getByText(/published by official co/i)).toBeVisible()
    expect(screen.getByText(/free to access/i)).toBeVisible()
  })

  it('shows a total that equals the sum of the listed terms', () => {
    renderDetail('good')
    // +3 verified, +2 official, +1 free, +1 outcomes, +1 fresh = 8
    expect(screen.getByText(/curated score:/i)).toHaveTextContent('8')
  })

  it('says plainly when a record earns nothing, rather than hiding the section', () => {
    // Paid, unverified, no provider, no stated outcomes: every term scores zero.
    renderDetail('earns-nothing')
    expect(screen.getByText(/earns no ranking points yet/i)).toBeVisible()
    expect(screen.getByText(/curated score:/i)).toHaveTextContent('0')
  })

  it('repeats that popularity is never an input', () => {
    renderDetail('good')
    expect(screen.getByText(/popularity is never an input/i)).toBeVisible()
  })
})

describe('navigation', () => {
  it('404s an unknown resource id', () => {
    renderDetail('not-a-real-id')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
  })

  it('returns to the filtered view the user came from', () => {
    renderDetail('good', `?from=${encodeURIComponent('type=video&level=beginner')}`)
    const back = screen.getByRole('link', { name: 'Library' })

    expect(back).toHaveAttribute('href', '/library?type=video&level=beginner')
  })

  it('falls back to the plain library when there is no context to return to', () => {
    renderDetail('good')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/library')
  })
})

describe('accessibility', () => {
  it.each(['good', 'no-link', 'dead', 'a-paper'])(
    'has no blocking violations for %s',
    async (id) => {
      const { container } = renderDetail(id)
      await expectNoA11yViolations(container)
    },
  )

  it('has exactly one h1', () => {
    renderDetail('good')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
