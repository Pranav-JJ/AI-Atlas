import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { buildReportUrl, REPO_URL } from '@/lib/repo.ts'

import { ReportProblem } from './ReportProblem.tsx'

const context = {
  recordId: 'res-example',
  title: 'An Example Resource',
  url: 'https://example.com/thing',
  kind: 'resource' as const,
}

describe('buildReportUrl', () => {
  it('points at this repository', () => {
    expect(buildReportUrl(context).startsWith(`${REPO_URL}/issues/new?`)).toBe(true)
  })

  it('prefills the record id and the recorded URL', () => {
    // Someone who has to compose a report from scratch usually will not.
    const params = new URL(buildReportUrl(context)).searchParams

    expect(params.get('body')).toContain('res-example')
    expect(params.get('body')).toContain('https://example.com/thing')
  })

  it('names the record in the title', () => {
    const params = new URL(buildReportUrl(context)).searchParams
    expect(params.get('title')).toContain('An Example Resource')
  })

  it('says "(none recorded)" rather than leaving the URL blank', () => {
    const params = new URL(buildReportUrl({ ...context, url: null })).searchParams
    expect(params.get('body')).toContain('(none recorded)')
  })

  it('offers the reporter the categories we actually act on', () => {
    const body = new URL(buildReportUrl(context)).searchParams.get('body') ?? ''

    expect(body).toMatch(/link is dead/i)
    expect(body).toMatch(/metadata is inaccurate/i)
    expect(body).toMatch(/licence details are wrong/i)
  })

  it('escapes values into the query string safely', () => {
    const nasty = buildReportUrl({ ...context, title: 'A & B "quoted" <tag>' })

    // Parses cleanly and round-trips, rather than producing a malformed URL.
    expect(() => new URL(nasty)).not.toThrow()
    expect(new URL(nasty).searchParams.get('title')).toContain('A & B "quoted" <tag>')
  })

  it('labels the issue so reports can be found', () => {
    expect(new URL(buildReportUrl(context)).searchParams.get('labels')).toBe('content-report')
  })
})

describe('ReportProblem', () => {
  it('renders a safe external link', () => {
    render(
      <MemoryRouter>
        <ReportProblem context={context} />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /report it/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('tells the reader the form is prefilled', () => {
    render(
      <MemoryRouter>
        <ReportProblem context={context} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/prefilled with what we would need to know/i)).toBeVisible()
  })
})
