/**
 * Checks every external URL in content/ and writes a report.
 *
 *   node scripts/check-links.ts                 # check everything
 *   node scripts/check-links.ts --out report.md # also write the issue body
 *   node scripts/check-links.ts --limit 5       # check a handful, for a smoke test
 *
 * Two rules govern this script:
 *
 *   1. It NEVER edits content. Deciding a link is dead is an editorial call,
 *      and a script that rewrites records on a 404 will eventually delete
 *      something because a CDN had a bad afternoon.
 *   2. It NEVER fails a build. It exits 0 whatever it finds, including when the
 *      network is entirely unavailable. Third-party flakiness must not gate
 *      publishing — the report is the output, not the exit code.
 */
import { writeFile } from 'node:fs/promises'

import {
  classifyHttpStatus,
  classifyTransportError,
  formatConsoleReport,
  formatIssueBody,
  needsReview,
  summarise,
  type LinkCheckResult,
  type LinkTarget,
} from '../src/lib/linkcheck.ts'
import { loadContentSet } from './content-pipeline.ts'

/** Polite settings. We are a guest on every one of these servers. */
const CONCURRENCY = 4
const TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 3_000
const BETWEEN_REQUESTS_MS = 150

/** Identifies us honestly, so an operator can see who is knocking. */
const USER_AGENT =
  'AI-Atlas-link-check/1.0 (+https://github.com/Pranav-JJ/AI-Atlas; scheduled availability check)'

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : (process.argv[index + 1] ?? null)
}

/** Every external URL in the catalogue, with where it came from. */
async function collectTargets(): Promise<LinkTarget[]> {
  const { set } = await loadContentSet()
  const targets: LinkTarget[] = []

  const add = (recordId: string, file: string, field: string, url: unknown) => {
    if (typeof url === 'string' && url.startsWith('https://')) {
      targets.push({ recordId, file, field, url })
    }
  }

  for (const { file, record } of set.providers) {
    add(record.id, file, 'site_url', record.site_url)
  }

  for (const { file, record } of set.resources) {
    const anyRecord = record as unknown as Record<string, unknown>

    add(record.id, file, 'url', record.url)
    add(record.id, file, 'license_url', anyRecord.license_url)
    add(record.id, file, 'documentation_url', anyRecord.documentation_url)
    add(record.id, file, 'code_url', anyRecord.code_url)
    add(record.id, file, 'playlist_url', anyRecord.playlist_url)
  }

  // De-duplicate: the same URL often appears as both a link and its own
  // documentation, and there is no reason to ask twice.
  const seen = new Set<string>()
  return targets.filter((target) => {
    const key = `${target.recordId}::${target.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function requestOnce(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    })
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Checks one URL.
 *
 * HEAD first because it is cheaper for the host, then GET if HEAD is refused or
 * errors — plenty of servers do not implement HEAD properly, and treating that
 * as a dead link would be wrong. One retry for transient failures.
 */
async function checkOne(target: LinkTarget): Promise<LinkCheckResult> {
  const base = { ...target, httpStatus: null, finalUrl: null, detail: null }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let response = await requestOnce(target.url, 'HEAD')

      if (response.status === 403 || response.status === 405 || response.status >= 500) {
        response = await requestOnce(target.url, 'GET')
      }

      const status = classifyHttpStatus(response.status)

      // Retry once on a server error before believing it.
      if (status === 'server-error' && attempt === 0) {
        await sleep(RETRY_DELAY_MS)
        continue
      }

      return {
        ...base,
        status,
        httpStatus: response.status,
        finalUrl: response.url !== target.url ? response.url : null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (attempt === 0) {
        await sleep(RETRY_DELAY_MS)
        continue
      }

      return { ...base, status: classifyTransportError(message), detail: message }
    }
  }

  return { ...base, status: 'unreachable', detail: 'exhausted retries' }
}

/** Runs checks a few at a time, with a small gap, so we are not a nuisance. */
async function runAll(targets: readonly LinkTarget[]): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = []
  const queue = [...targets]

  async function worker() {
    while (queue.length > 0) {
      const target = queue.shift()
      if (!target) return

      results.push(await checkOne(target))
      await sleep(BETWEEN_REQUESTS_MS)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return results
}

const limit = arg('limit')
const outPath = arg('out')

const allTargets = await collectTargets()
const targets = limit !== null ? allTargets.slice(0, Number(limit)) : allTargets

console.log(`Checking ${targets.length} URLs (${CONCURRENCY} at a time, ${TIMEOUT_MS}ms timeout)`)
console.log('')

const results = await runAll(targets)
// Stable order, so a report diff shows real changes rather than race outcomes.
results.sort((a, b) => a.recordId.localeCompare(b.recordId) || a.field.localeCompare(b.field))

console.log(formatConsoleReport(results))

if (outPath !== null) {
  const body = formatIssueBody(results, {
    checkedAt: new Date().toISOString().slice(0, 10),
    runUrl: process.env.GITHUB_RUN_URL ?? null,
  })
  await writeFile(outPath, body, 'utf8')
  console.log('')
  console.log(`  Issue body written to ${outPath}`)
}

const summary = summarise(results)
console.log('')
console.log(
  needsReview(results).length > 0
    ? `  ${summary.gone} URL(s) need a human look. Nothing has been changed automatically.`
    : '  Nothing needs attention.',
)

/*
 * Always zero. The report is the output; the exit code is not a verdict on the
 * catalogue, and a failing network must never look like a failing build.
 */
process.exit(0)
