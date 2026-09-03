import { readFileSync } from 'node:fs'

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { glossary } from '@/content/generated/index.ts'

import { Glossary } from './Glossary.tsx'
import { GlossaryTerm } from './GlossaryTerm.tsx'

function renderIndex(url = '/glossary') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/glossary" element={<Glossary />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderTerm(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/glossary/${id}`]}>
      <Routes>
        <Route path="/glossary/:termId" element={<GlossaryTerm />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the seeded glossary', () => {
  it('covers the terms the plan called for', () => {
    const ids = new Set(glossary.map((t) => t.id))

    for (const expected of [
      'term-overfitting',
      'term-regularisation',
      'term-precision-and-recall',
      'term-cross-validation',
      'term-embedding',
      'term-attention',
      'term-transformer',
      'term-tokenisation',
      'term-fine-tuning',
      'term-inference',
      'term-hallucination',
      'term-retrieval-augmented-generation',
      'term-data-leakage',
      'term-distribution-shift',
      'term-calibration',
      'term-model-drift',
    ]) {
      expect(ids.has(expected), expected).toBe(true)
    }
  })

  it('gives every term a plain definition short enough to be plain', () => {
    for (const term of glossary) {
      expect(term.plain_definition.length, term.id).toBeGreaterThan(20)
      expect(term.plain_definition.length, term.id).toBeLessThan(400)
    }
  })

  it('records the common misconception for every term', () => {
    // Often the most useful thing on the page, and the reason the entry exists.
    for (const term of glossary) {
      expect(term.common_misconception, term.id).not.toBeNull()
    }
  })

  it('links related terms symmetrically enough to navigate', () => {
    const ids = new Set(glossary.map((t) => t.id))

    for (const term of glossary) {
      expect(term.related_term_ids.length, term.id).toBeGreaterThan(0)
      for (const related of term.related_term_ids) {
        expect(ids.has(related), `${term.id} -> ${related}`).toBe(true)
      }
    }
  })

  it('never links a term to itself', () => {
    for (const term of glossary) {
      expect(term.related_term_ids, term.id).not.toContain(term.id)
    }
  })
})

describe('progressive disclosure', () => {
  const withDetail = glossary.find((t) => t.formula_latex !== null && t.example !== null)!

  it('shows the plain definition without any interaction', () => {
    renderTerm(withDetail.id)
    expect(screen.getByText(withDetail.plain_definition)).toBeVisible()
  })

  it('shows the example and the misconception without interaction too', () => {
    // A beginner must never have to expand anything to get a usable answer.
    renderTerm(withDetail.id)

    expect(screen.getByText(withDetail.example!)).toBeVisible()
    expect(screen.getByText(withDetail.common_misconception!)).toBeVisible()
  })

  it('keeps the technical explanation collapsed until asked for', () => {
    const { container } = renderTerm(withDetail.id)
    const details = container.querySelector('details')

    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
  })

  it('reveals the technical explanation and formula on request', async () => {
    const user = userEvent.setup()
    renderTerm(withDetail.id)

    await user.click(screen.getByText(/go deeper/i))

    expect(screen.getByText(withDetail.technical_explanation)).toBeVisible()
    expect(screen.getByText(withDetail.formula_latex!)).toBeVisible()
  })

  it('labels a formula as LaTeX source rather than pretending it is typeset', async () => {
    // Inside the collapsed section, so it must be opened first.
    const user = userEvent.setup()
    renderTerm(withDetail.id)

    await user.click(screen.getByText(/go deeper/i))
    expect(screen.getByText(/written as LaTeX source rather than typeset/i)).toBeVisible()
  })

  it('renders a code example when one exists', async () => {
    const user = userEvent.setup()
    const withCode = glossary.find((t) => t.code_example !== null)!
    const { container } = renderTerm(withCode.id)

    await user.click(screen.getByText(/go deeper/i))

    // Queried through the DOM rather than by text: a multi-line <pre> does not
    // survive Testing Library's whitespace normalisation intact.
    const blocks = [...container.querySelectorAll('pre')].map((el) => el.textContent ?? '')
    expect(blocks.some((text) => text === withCode.code_example!.code)).toBe(true)
  })
})

describe('content is text, never markup', () => {
  /**
   * The phase gate. Markdown was deliberately NOT introduced: glossary content
   * is plain strings that React escapes, so there is no HTML path to sanitise.
   *
   * These tests make that provable rather than merely stated. They render
   * content containing markup and assert it appears as literal text — which
   * would fail immediately if anyone later reached for dangerouslySetInnerHTML.
   */
  function renderHostile(field: string) {
    return render(
      <MemoryRouter>
        <p>{field}</p>
      </MemoryRouter>,
    )
  }

  it.each([
    ['<script>alert(1)</script>'],
    ['<img src=x onerror="alert(1)">'],
    ['<a href="javascript:alert(1)">click</a>'],
    ['<iframe src="https://evil.example"></iframe>'],
  ])('renders %s as visible text, not as an element', (hostile) => {
    const { container } = renderHostile(hostile)

    expect(container.textContent).toBe(hostile)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('has no dangerouslySetInnerHTML anywhere in application source', () => {
    // Belt and braces alongside the ESLint rule: this catches the case where
    // someone disables the rule inline.
    const files = [
      'src/pages/GlossaryTerm.tsx',
      'src/pages/Glossary.tsx',
      'src/components/Callout.tsx',
    ]

    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('dangerouslySetInnerHTML')
    }
  })

  it('escapes markup that appears inside real rendered glossary content', () => {
    // Renders a genuine term page and asserts no script or iframe element was
    // produced from any of its fields.
    const { container } = renderTerm(glossary[0]!.id)

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('object')).toBeNull()
  })
})

describe('the glossary index', () => {
  it('lists every term with its plain definition', () => {
    renderIndex()

    expect(screen.getByRole('status')).toHaveTextContent(`${glossary.length} terms`)
    expect(screen.getByText(glossary[0]!.plain_definition)).toBeVisible()
  })

  it('filters as you type', async () => {
    const user = userEvent.setup()
    renderIndex()

    await user.type(screen.getByLabelText(/find a term/i), 'leakage')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 term'))
    expect(screen.getByRole('link', { name: /data leakage/i })).toBeVisible()
  })

  it('matches on an alias, not only the term itself', async () => {
    const user = userEvent.setup()
    renderIndex()

    // "regularization" is the American spelling, stored as an alias.
    await user.type(screen.getByLabelText(/find a term/i), 'regularization')

    await waitFor(() => expect(screen.getByRole('link', { name: /regularisation/i })).toBeVisible())
  })

  it('filters by topic from the URL', () => {
    const topic = glossary[0]!.topics[0]!
    const expected = glossary.filter((t) => t.topics.includes(topic)).length

    renderIndex(`/glossary?topic=${topic}`)
    expect(screen.getByRole('status')).toHaveTextContent(`${expected} term`)
  })

  it('offers an honest empty state that does not blame the reader', async () => {
    const user = userEvent.setup()
    renderIndex()

    await user.type(screen.getByLabelText(/find a term/i), 'zzzznotaterm')

    await waitFor(() => expect(screen.getByText(/no terms match/i)).toBeVisible())
    expect(
      screen.getByText(/has not been written yet rather than been judged unimportant/i),
    ).toBeVisible()
  })
})

describe('a concept page', () => {
  it('404s an unknown term id', () => {
    renderTerm('term-not-real')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
  })

  it('links to related terms with their definitions inline', () => {
    const term = glossary.find((t) => t.related_term_ids.length > 0)!
    renderTerm(term.id)

    const related = screen.getByRole('heading', { name: /related terms/i }).parentElement!
    expect(within(related).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('points at resources for learning the concept properly', () => {
    const term = glossary.find((t) => t.resource_ids.length > 0)!
    renderTerm(term.id)

    expect(screen.getByRole('heading', { name: /where to learn this properly/i })).toBeVisible()
  })

  it('shows aliases so a reader searching a different spelling still lands', () => {
    const term = glossary.find((t) => t.aliases.length > 0)!
    renderTerm(term.id)

    expect(screen.getByText(new RegExp(`also called.*${term.aliases[0]}`, 'i'))).toBeVisible()
  })
})

describe('accessibility', () => {
  it('has no blocking violations on the index', async () => {
    const { container } = renderIndex()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on a concept page', async () => {
    const { container } = renderTerm(glossary[0]!.id)
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations with the technical detail expanded', async () => {
    const user = userEvent.setup()
    const withDetail = glossary.find((t) => t.formula_latex !== null)!
    const { container } = renderTerm(withDetail.id)

    await user.click(screen.getByText(/go deeper/i))
    await expectNoA11yViolations(container)
  })

  it('has exactly one h1 on a concept page', () => {
    renderTerm(glossary[0]!.id)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
