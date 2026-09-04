/**
 * Link-health classification and reporting.
 *
 * Pure: no network, no filesystem, no GitHub. The runner in
 * scripts/check-links.ts does the fetching and hands results here, so the
 * judgement calls — which are the part that matters — are testable offline.
 *
 * The governing principle is that a checker which cries wolf gets ignored, and
 * an ignored checker is worse than none. A great many sites block automated
 * requests, rate-limit CI address ranges, or reject HEAD; none of that is
 * evidence that a link is dead. So the classification separates
 *
 *   "this is gone"        — worth a human's attention
 *   "we could not check"  — worth recording, not worth acting on
 *
 * and only the first is ever raised for review.
 */

export const LINK_STATUSES = [
  'ok',
  'gone',
  'blocked',
  'server-error',
  'unreachable',
  'skipped',
] as const

export type LinkStatus = (typeof LINK_STATUSES)[number]

/** Where a URL came from, so a report points at something you can edit. */
export interface LinkTarget {
  /** Record id that owns the URL. */
  recordId: string
  /** Field it came from, e.g. "url" or "license_url". */
  field: string
  /** Content file, so the fix location is unambiguous. */
  file: string
  url: string
}

export interface LinkCheckResult extends LinkTarget {
  status: LinkStatus
  /** HTTP status where one was received. */
  httpStatus: number | null
  /** Final URL after redirects, when it differs from the requested one. */
  finalUrl: string | null
  /** Error text for transport-level failures. */
  detail: string | null
}

/**
 * Turns an HTTP status into a judgement.
 *
 *   404 / 410  the server positively says there is nothing here.
 *   401 / 403  we were refused. Extremely common for bot protection, and says
 *              nothing about whether a human with a browser would succeed.
 *   405 / 429  method not allowed, or rate limited. Our problem, not the link's.
 *   5xx        the server is having trouble. Transient until proven otherwise.
 */
export function classifyHttpStatus(status: number): LinkStatus {
  if (status >= 200 && status < 400) return 'ok'
  if (status === 404 || status === 410) return 'gone'
  if (status === 401 || status === 403 || status === 405 || status === 429) return 'blocked'
  if (status >= 500) return 'server-error'

  // Any other 4xx is ambiguous. Treated as blocked rather than gone, because
  // guessing wrong in that direction costs nothing but a line in a report.
  return 'blocked'
}

/**
 * Transport failures — DNS, TLS, connection refused, timeout — are never proof.
 *
 * Every one maps to "unreachable" deliberately. It would be easy to treat a DNS
 * failure as stronger evidence than a timeout, but a CI runner's resolver, a
 * transient outage and a genuinely retired domain are indistinguishable from
 * here, and the difference does not change what a human should do about it.
 */
export function classifyTransportError(_message: string): LinkStatus {
  return 'unreachable'
}

/** Only these warrant a human going and looking. */
export function needsReview(results: readonly LinkCheckResult[]): LinkCheckResult[] {
  return results.filter((r) => r.status === 'gone')
}

/** Recorded for context, explicitly NOT actioned. */
export function couldNotCheck(results: readonly LinkCheckResult[]): LinkCheckResult[] {
  return results.filter(
    (r) => r.status === 'blocked' || r.status === 'server-error' || r.status === 'unreachable',
  )
}

export interface LinkCheckSummary {
  total: number
  ok: number
  gone: number
  blocked: number
  serverError: number
  unreachable: number
  skipped: number
}

export function summarise(results: readonly LinkCheckResult[]): LinkCheckSummary {
  const count = (status: LinkStatus) => results.filter((r) => r.status === status).length

  return {
    total: results.length,
    ok: count('ok'),
    gone: count('gone'),
    blocked: count('blocked'),
    serverError: count('server-error'),
    unreachable: count('unreachable'),
    skipped: count('skipped'),
  }
}

/** The title used for the single tracking issue, so runs update rather than pile up. */
export const ISSUE_TITLE = 'Link health: URLs needing a human look'

export const ISSUE_LABEL = 'link-health'

function describe(result: LinkCheckResult): string {
  const code =
    result.httpStatus !== null ? `HTTP ${result.httpStatus}` : (result.detail ?? 'no response')
  const redirect =
    result.finalUrl !== null && result.finalUrl !== result.url ? ` → ${result.finalUrl}` : ''

  return `${code}${redirect}`
}

/**
 * The issue body.
 *
 * Written for someone deciding what to do, not for a machine: it leads with
 * what is actionable, states plainly that nothing was changed automatically,
 * and keeps the unverifiable results in a collapsed section so they do not
 * drown the real findings.
 */
export function formatIssueBody(
  results: readonly LinkCheckResult[],
  meta: { checkedAt: string; runUrl: string | null },
): string {
  const summary = summarise(results)
  const broken = needsReview(results)
  const unknown = couldNotCheck(results)

  const lines: string[] = []

  lines.push(`_Last checked ${meta.checkedAt}._`)
  lines.push('')
  lines.push(
    'This issue is rewritten by the scheduled link-health check. ' +
      '**Nothing in `content/` has been changed** — marking a link broken is an editorial ' +
      'decision, not something a script should make.',
  )
  lines.push('')

  if (broken.length === 0) {
    lines.push('## No links need attention')
    lines.push('')
    lines.push(
      `${summary.ok} of ${summary.total} URLs responded. Nothing returned a definitive 404 or 410.`,
    )
  } else {
    lines.push(
      `## ${broken.length} link${broken.length === 1 ? '' : 's'} appear${broken.length === 1 ? 's' : ''} to be gone`,
    )
    lines.push('')
    lines.push('The server positively reported these as missing. Worth opening each one yourself.')
    lines.push('')
    lines.push('| Record | Field | URL | Response | File |')
    lines.push('| --- | --- | --- | --- | --- |')

    for (const result of broken) {
      lines.push(
        `| \`${result.recordId}\` | \`${result.field}\` | ${result.url} | ${describe(result)} | \`${result.file}\` |`,
      )
    }

    lines.push('')
    lines.push('**If a link really is dead**, set `status: "broken"` on the record. The interface')
    lines.push('then disables the link rather than letting it fail silently. If the resource has')
    lines.push('simply moved, update the URL and reset `last_verified_at` — a new URL has not been')
    lines.push('verified just because the old one was.')
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(
    `**Summary** — ${summary.ok} ok · ${summary.gone} gone · ${summary.blocked} blocked · ` +
      `${summary.serverError} server error · ${summary.unreachable} unreachable`,
  )

  if (unknown.length > 0) {
    lines.push('')
    lines.push('<details>')
    lines.push(
      `<summary>${unknown.length} URL${unknown.length === 1 ? '' : 's'} could not be checked (not necessarily broken)</summary>`,
    )
    lines.push('')
    lines.push(
      'Automated requests are frequently refused, rate limited, or blocked by bot protection. ' +
        'None of this is evidence that a link is dead, so these are listed for context only.',
    )
    lines.push('')
    lines.push('| Record | URL | Result |')
    lines.push('| --- | --- | --- |')

    for (const result of unknown) {
      lines.push(`| \`${result.recordId}\` | ${result.url} | ${describe(result)} |`)
    }

    lines.push('')
    lines.push('</details>')
  }

  if (meta.runUrl !== null) {
    lines.push('')
    lines.push(`[Workflow run](${meta.runUrl})`)
  }

  return lines.join('\n')
}

/** Console output for a local run. */
export function formatConsoleReport(results: readonly LinkCheckResult[]): string {
  const summary = summarise(results)
  const broken = needsReview(results)
  const unknown = couldNotCheck(results)

  const lines: string[] = []

  lines.push(
    `  ${summary.ok} ok · ${summary.gone} gone · ${summary.blocked} blocked · ` +
      `${summary.serverError} server error · ${summary.unreachable} unreachable`,
  )

  if (broken.length > 0) {
    lines.push('')
    lines.push('  Appear to be gone:')
    for (const result of broken) {
      lines.push(`    ${result.recordId} (${result.field}) ${result.url} — ${describe(result)}`)
    }
  }

  if (unknown.length > 0) {
    lines.push('')
    lines.push('  Could not be checked (not evidence of breakage):')
    for (const result of unknown) {
      lines.push(`    ${result.recordId} ${result.url} — ${describe(result)}`)
    }
  }

  return lines.join('\n')
}
