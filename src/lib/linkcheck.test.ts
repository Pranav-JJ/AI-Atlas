import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  classifyHttpStatus,
  classifyTransportError,
  couldNotCheck,
  formatConsoleReport,
  formatIssueBody,
  ISSUE_LABEL,
  ISSUE_TITLE,
  needsReview,
  summarise,
  type LinkCheckResult,
} from './linkcheck.ts'

function result(overrides: Partial<LinkCheckResult> = {}): LinkCheckResult {
  return {
    recordId: 'res-example',
    field: 'url',
    file: 'content/resources/example.json',
    url: 'https://example.com/thing',
    status: 'ok',
    httpStatus: 200,
    finalUrl: null,
    detail: null,
    ...overrides,
  }
}

describe('classifying an HTTP response', () => {
  it.each([200, 201, 204, 301, 302, 308, 399])('treats %s as ok', (status) => {
    expect(classifyHttpStatus(status)).toBe('ok')
  })

  it.each([404, 410])('treats %s as gone — the server says there is nothing there', (status) => {
    expect(classifyHttpStatus(status)).toBe('gone')
  })

  it.each([401, 403, 405, 429])('treats %s as blocked, not as gone', (status) => {
    // Bot protection, rate limits and refused methods are extremely common for
    // automated requests, and say nothing about whether the link works.
    expect(classifyHttpStatus(status)).toBe('blocked')
  })

  it.each([500, 502, 503, 504])('treats %s as a server error, not as gone', (status) => {
    expect(classifyHttpStatus(status)).toBe('server-error')
  })

  it('treats an unfamiliar 4xx as blocked rather than gone', () => {
    // Guessing in this direction costs a line in a report; guessing the other
    // way costs a real resource being marked dead.
    expect(classifyHttpStatus(418)).toBe('blocked')
    expect(classifyHttpStatus(451)).toBe('blocked')
  })
})

describe('classifying a transport failure', () => {
  it.each([
    ['getaddrinfo ENOTFOUND example.com'],
    ['The operation was aborted due to timeout'],
    ['connect ECONNREFUSED'],
    ['unable to verify the first certificate'],
    [''],
  ])('treats "%s" as unreachable rather than gone', (message) => {
    expect(classifyTransportError(message)).toBe('unreachable')
  })
})

describe('what gets raised for review', () => {
  const results = [
    result({ recordId: 'a', status: 'ok' }),
    result({ recordId: 'b', status: 'gone', httpStatus: 404 }),
    result({ recordId: 'c', status: 'blocked', httpStatus: 403 }),
    result({ recordId: 'd', status: 'server-error', httpStatus: 503 }),
    result({ recordId: 'e', status: 'unreachable', httpStatus: null, detail: 'timeout' }),
  ]

  it('raises only definitively-gone links', () => {
    // The whole point: a checker that cries wolf gets ignored.
    expect(needsReview(results).map((r) => r.recordId)).toEqual(['b'])
  })

  it('records everything unverifiable separately, without actioning it', () => {
    expect(couldNotCheck(results).map((r) => r.recordId)).toEqual(['c', 'd', 'e'])
  })

  it('counts every category', () => {
    expect(summarise(results)).toEqual({
      total: 5,
      ok: 1,
      gone: 1,
      blocked: 1,
      serverError: 1,
      unreachable: 1,
      skipped: 0,
    })
  })
})

describe('the issue body', () => {
  const meta = { checkedAt: '2026-09-04', runUrl: 'https://example.com/run/1' }

  it('states outright that nothing was changed automatically', () => {
    const body = formatIssueBody([result()], meta)
    expect(body).toMatch(/Nothing in `content\/` has been changed/)
  })

  it('says so plainly when nothing needs attention', () => {
    const body = formatIssueBody([result(), result({ recordId: 'b' })], meta)

    expect(body).toContain('## No links need attention')
    expect(body).not.toContain('appear')
  })

  it('lists broken links with the file to edit', () => {
    const body = formatIssueBody(
      [result({ recordId: 'res-dead', status: 'gone', httpStatus: 404 })],
      meta,
    )

    expect(body).toContain('res-dead')
    expect(body).toContain('content/resources/example.json')
    expect(body).toContain('HTTP 404')
  })

  it('tells the maintainer what to do, including resetting verification on a moved URL', () => {
    // A new URL has not been verified just because the old one was.
    const body = formatIssueBody([result({ status: 'gone', httpStatus: 404 })], meta)

    expect(body).toMatch(/set `status: "broken"`/)
    expect(body).toMatch(/reset `last_verified_at`/)
  })

  it('keeps unverifiable results collapsed and labelled as not evidence', () => {
    const body = formatIssueBody(
      [result({ status: 'blocked', httpStatus: 403 }), result({ recordId: 'b', status: 'ok' })],
      meta,
    )

    expect(body).toContain('<details>')
    expect(body).toMatch(/could not be checked \(not necessarily broken\)/)
    expect(body).toMatch(/None of this is evidence that a link is dead/)
  })

  it('omits the collapsed section entirely when everything was checkable', () => {
    const body = formatIssueBody([result()], meta)
    expect(body).not.toContain('<details>')
  })

  it('shows a redirect target when one differs from the requested URL', () => {
    const body = formatIssueBody(
      [
        result({
          status: 'gone',
          httpStatus: 404,
          finalUrl: 'https://example.com/moved',
        }),
      ],
      meta,
    )

    expect(body).toContain('https://example.com/moved')
  })

  it('links back to the run that produced it', () => {
    expect(formatIssueBody([result()], meta)).toContain('https://example.com/run/1')
  })

  it('omits the run link when there is none', () => {
    const body = formatIssueBody([result()], { checkedAt: '2026-09-04', runUrl: null })
    expect(body).not.toContain('Workflow run')
  })

  it('is stable for the same input, so an unchanged report produces no churn', () => {
    const results = [result({ status: 'gone', httpStatus: 404 })]
    expect(formatIssueBody(results, meta)).toBe(formatIssueBody(results, meta))
  })
})

describe('the console report', () => {
  it('separates what is actionable from what merely could not be checked', () => {
    const output = formatConsoleReport([
      result({ recordId: 'dead', status: 'gone', httpStatus: 404 }),
      result({ recordId: 'refused', status: 'blocked', httpStatus: 403 }),
    ])

    expect(output).toContain('Appear to be gone:')
    expect(output).toContain('Could not be checked (not evidence of breakage):')
    expect(output.indexOf('Appear to be gone:')).toBeLessThan(
      output.indexOf('Could not be checked'),
    )
  })

  it('omits sections that would be empty', () => {
    const output = formatConsoleReport([result()])

    expect(output).not.toContain('Appear to be gone:')
    expect(output).not.toContain('Could not be checked')
  })
})

describe('the workflow matches the library', () => {
  // The workflow hard-codes the issue title and label. If either drifts from
  // the constants here, runs would start opening a second issue every week.
  const workflow = readFileSync('.github/workflows/link-check.yml', 'utf8')

  it('uses the same issue title', () => {
    expect(workflow).toContain(ISSUE_TITLE)
  })

  it('uses the same label', () => {
    expect(workflow).toContain(ISSUE_LABEL)
  })

  it('never fails the job on a checker error', () => {
    expect(workflow).toMatch(/\|\| true/)
  })

  it('asks for no write access to repository contents', () => {
    // The checker must never be able to edit content, and permissions are the
    // enforcement rather than the intention.
    expect(workflow).toMatch(/contents:\s*read/)
    expect(workflow).not.toMatch(/contents:\s*write/)
  })

  it('runs on a schedule and can be triggered by hand', () => {
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain('workflow_dispatch:')
  })
})

describe('the checker script cannot edit content', () => {
  const script = readFileSync('scripts/check-links.ts', 'utf8')

  it('never writes into content/', () => {
    expect(script).not.toMatch(/writeFile\([^)]*content\//)
  })

  it('exits zero deliberately, so a flaky network is not a failed build', () => {
    expect(script).toContain('process.exit(0)')
    expect(script).not.toContain('process.exit(1)')
  })
})
