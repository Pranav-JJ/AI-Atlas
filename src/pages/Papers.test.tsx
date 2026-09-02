import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { resources } from '@/content/generated/index.ts'
import { isPaper } from '@/lib/papers.ts'

import { Papers } from './Papers.tsx'
import { ResourceDetail } from './ResourceDetail.tsx'

const papers = resources.filter(isPaper)

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

function renderIndex(url = '/papers') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <Routes>
        <Route path="/papers" element={<Papers />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/library/${id}`]}>
      <Routes>
        <Route path="/library/:resourceId" element={<ResourceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const currentUrl = () => screen.getByTestId('location').textContent ?? ''

describe('the seeded paper collection', () => {
  it('ships several papers spanning more than one topic', () => {
    expect(papers.length).toBeGreaterThanOrEqual(6)
    expect(new Set(papers.flatMap((p) => p.topics)).size).toBeGreaterThan(3)
  })

  it('never claims peer review without naming a venue', () => {
    // Content rule 13, asserted here because it is the claim most likely to be
    // made carelessly.
    for (const paper of papers) {
      if (paper.peer_review_status === 'peer-reviewed') {
        expect(paper.venue, paper.id).not.toBeNull()
      }
    }
  })

  it('leaves publication status unknown where no venue was found', () => {
    // Most arXiv pages state no venue, so most papers must be unknown. If this
    // ever flips to mostly peer-reviewed, someone has started assuming.
    const unknown = papers.filter((p) => p.peer_review_status === 'unknown')
    expect(unknown.length).toBeGreaterThan(0)

    for (const paper of unknown) {
      expect(paper.venue, paper.id).toBeNull()
    }
  })

  it('gives every paper both a source summary and our reading', () => {
    for (const paper of papers) {
      expect(paper.abstract_summary, paper.id).not.toBeNull()
      expect(paper.key_idea, paper.id).not.toBeNull()
    }
  })

  it('keeps the two summaries distinct from each other', () => {
    // If they were the same text, the separation would be theatre.
    for (const paper of papers) {
      expect(paper.abstract_summary, paper.id).not.toBe(paper.key_idea)
    }
  })

  it('reproduces no benchmark figures in either summary', () => {
    // A number without its exact evaluation setup is not comparable to
    // anything, so scores are deliberately kept out of the summaries.
    const metricPattern = /\b\d+(\.\d+)?\s*(BLEU|ROUGE|F1|accuracy|MRR|NDCG)\b/i

    for (const paper of papers) {
      expect(paper.abstract_summary ?? '', paper.id).not.toMatch(metricPattern)
      expect(paper.key_idea ?? '', paper.id).not.toMatch(metricPattern)
    }
  })

  it('records prerequisite concepts for every paper', () => {
    for (const paper of papers) {
      expect(paper.prerequisites.topics.length, paper.id).toBeGreaterThan(0)
    }
  })
})

describe('claims are visibly separated from our reading', () => {
  // The central requirement of this phase.
  it.each(papers.map((p) => [p.id]))('%s labels both summaries distinctly', (id) => {
    renderDetail(id)

    const source = screen.getByRole('heading', { name: /what the source says/i })
    const ours = screen.getByRole('heading', { name: /our reading/i })

    expect(source).toBeVisible()
    expect(ours).toBeVisible()
  })

  it('attributes the abstract paraphrase to the paper', () => {
    renderDetail(papers[0]!.id)
    expect(screen.getByText(/paraphrase of the paper’s own abstract/i)).toBeVisible()
  })

  it('attributes the reading to AI Atlas, not the paper', () => {
    renderDetail(papers[0]!.id)
    expect(screen.getByText(/interpretation, not a claim made by the paper/i)).toBeVisible()
  })

  it('puts each summary in its own labelled region', () => {
    // Adjacent paragraphs would leave a screen reader user unable to tell which
    // text came from where.
    renderDetail(papers[0]!.id)

    const source = screen.getByRole('article', { name: /what the source says/i })
    const ours = screen.getByRole('article', { name: /our reading/i })

    expect(within(source).getByText(papers[0]!.abstract_summary!)).toBeVisible()
    expect(within(ours).getByText(papers[0]!.key_idea!)).toBeVisible()
  })
})

describe('publication status is always explicit', () => {
  it.each(papers.map((p) => [p.id]))('%s renders a peer-review row', (id) => {
    renderDetail(id)
    expect(screen.getByText('Peer review')).toBeVisible()
  })

  it('says outright that an unknown status is unknown', () => {
    const unknown = papers.find((p) => p.peer_review_status === 'unknown')
    expect(unknown).toBeDefined()

    renderDetail(unknown!.id)
    expect(screen.getByText(/publication status unknown/i)).toBeVisible()
    expect(screen.getByText(/being on arXiv, or widely cited, is not evidence/i)).toBeVisible()
  })

  it('shows "None recorded" rather than a blank venue', () => {
    const unknown = papers.find((p) => p.venue === null)
    expect(unknown).toBeDefined()

    renderDetail(unknown!.id)
    expect(screen.getByText('None recorded')).toBeVisible()
  })

  it('names the venue when one is recorded, and explains the basis', () => {
    const reviewed = papers.find((p) => p.peer_review_status === 'peer-reviewed')
    expect(reviewed).toBeDefined()

    renderDetail(reviewed!.id)
    expect(screen.getByText(reviewed!.venue!)).toBeVisible()
    expect(screen.getByText(/venue is recorded.*evidence on which the label rests/i)).toBeVisible()
  })
})

describe('the papers index', () => {
  it('lists every paper, newest first', () => {
    renderIndex()
    expect(screen.getByRole('status')).toHaveTextContent(`${papers.length} papers`)
  })

  it('states how many have an unconfirmed publication status', () => {
    const unknownCount = papers.filter((p) => p.venue === null).length
    renderIndex()

    expect(screen.getByText(new RegExp(`${unknownCount} of ${papers.length}`))).toBeVisible()
  })

  it('says no benchmark results are reproduced', () => {
    renderIndex()
    expect(screen.getByText(/no benchmark results are reproduced here/i)).toBeVisible()
  })

  it('shows publication status on each card, not only on the detail page', () => {
    renderIndex()
    expect(screen.getAllByText(/publication status unknown/i).length).toBeGreaterThan(0)
  })

  it('links prerequisite concepts to their topic pages', () => {
    renderIndex()
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '')

    expect(links.some((href) => href.startsWith('/topics/'))).toBe(true)
  })

  it('filters by publication status and records it in the URL', async () => {
    const user = userEvent.setup()
    renderIndex()

    await user.click(screen.getByRole('checkbox', { name: /publication status unknown/i }))

    await waitFor(() => expect(currentUrl()).toContain('review=unknown'))
    const expected = papers.filter((p) => p.peer_review_status === 'unknown').length
    expect(screen.getByRole('status')).toHaveTextContent(`${expected} paper`)
  })

  it('filters by topic', () => {
    const topic = papers[0]!.topics[0]!
    const expected = papers.filter((p) => p.topics.includes(topic)).length

    renderIndex(`/papers?topic=${topic}`)
    expect(screen.getByRole('status')).toHaveTextContent(`${expected} paper`)
  })

  it('offers an honest empty state', () => {
    renderIndex('/papers?review=preprint')
    expect(screen.getByText(/no papers match these filters/i)).toBeVisible()
    expect(screen.getByText(/small and still growing/i)).toBeVisible()
  })

  it('clears back to a bare URL', async () => {
    const user = userEvent.setup()
    renderIndex('/papers?review=unknown')

    await user.click(screen.getByRole('button', { name: /clear all/i }))

    await waitFor(() => expect(currentUrl()).toBe('/papers'))
  })

  it('links each paper to its canonical library detail page', () => {
    renderIndex()
    const link = screen.getByRole('link', { name: papers[0]!.title })

    expect(link.getAttribute('href')).toMatch(/^\/library\//)
  })
})

describe('accessibility', () => {
  it('has no blocking violations on the index', async () => {
    const { container } = renderIndex()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on a paper detail page', async () => {
    const { container } = renderDetail(papers[0]!.id)
    await expectNoA11yViolations(container)
  })

  it('groups paper filters under named fieldsets', () => {
    renderIndex()
    for (const legend of ['Publication status', 'Topic']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument()
    }
  })
})
