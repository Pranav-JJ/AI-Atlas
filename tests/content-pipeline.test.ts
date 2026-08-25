import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { formatIssue, loadContentSet } from '../scripts/content-pipeline.ts'
import { makeResource, makeTopic } from './fixtures/content.ts'

/**
 * End-to-end tests for the content pipeline, against real files on disk.
 *
 * The rule-level tests prove each rule works in isolation. These prove the
 * pipeline that CI actually runs picks those failures up, reports them against
 * the right file, and exits non-zero — the acceptance criterion for this phase.
 */

const created: string[] = []

async function makeContentDir(files: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ai-atlas-content-'))
  created.push(root)

  for (const [relativePath, contents] of Object.entries(files)) {
    const full = join(root, relativePath)
    await mkdir(join(full, '..'), { recursive: true })
    await writeFile(
      full,
      typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2),
      'utf8',
    )
  }

  return root
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const TODAY = '2026-08-25'

describe('the real content set', () => {
  // This is the check that matters most day to day: it makes the shipped
  // catalogue's validity a test result, not just something a script says.
  it('loads and validates with no errors', async () => {
    const { issues, set } = await loadContentSet({ root: 'content', today: TODAY })
    const errors = issues.filter((i) => i.severity === 'error')

    if (errors.length > 0) {
      throw new Error(`content/ is invalid:\n${errors.map(formatIssue).join('\n')}`)
    }

    expect(set.topics.length).toBeGreaterThan(0)
    expect(set.resources.length).toBeGreaterThan(0)
  })

  it('ships no record claiming to be verified without evidence', async () => {
    const { set } = await loadContentSet({ root: 'content', today: TODAY })

    for (const { record } of set.resources) {
      if (record.status === 'verified') {
        expect(record.url).not.toBeNull()
        expect(record.last_verified_at).not.toBeNull()
        expect(record.verified_by).not.toBeNull()
      }
    }
  })

  it('ships no http:// or credential-bearing urls', async () => {
    const { set } = await loadContentSet({ root: 'content', today: TODAY })

    for (const { record } of set.resources) {
      if (record.url !== null) {
        expect(record.url.startsWith('https://')).toBe(true)
        expect(record.url).not.toMatch(/^https:\/\/[^/@]*@/)
      }
    }
  })
})

describe('deliberately broken content is rejected', () => {
  const validTopics = [makeTopic({ id: 'test-topic' })]

  it('reports invalid JSON against the offending file', async () => {
    const root = await makeContentDir({
      'topics.json': '[{ "id": "broken", ',
    })
    const { issues } = await loadContentSet({ root, today: TODAY })

    expect(issues.some((i) => i.message.includes('invalid JSON'))).toBe(true)
    expect(issues[0]?.file).toMatch(/topics\.json$/)
  })

  it('rejects a resource with an http url and names the record', async () => {
    const root = await makeContentDir({
      'topics.json': validTopics,
      'resources/bad.json': [makeResource({ id: 'insecure', url: 'http://example.com/x' })],
    })
    const { issues } = await loadContentSet({ root, today: TODAY })
    const errors = issues.filter((i) => i.severity === 'error')

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]?.recordId).toBe('insecure')
    expect(errors[0]?.file).toMatch(/resources\/bad\.json$/)
  })

  it('rejects a record claiming verified with no verification date', async () => {
    const root = await makeContentDir({
      'topics.json': validTopics,
      'resources/bad.json': [
        makeResource({
          id: 'overclaiming',
          status: 'verified',
          url: 'https://example.com/x',
          last_verified_at: null,
          verified_by: 'someone',
        }),
      ],
    })
    const { issues } = await loadContentSet({ root, today: TODAY })

    expect(issues.some((i) => i.message.includes('requires last_verified_at'))).toBe(true)
  })

  it('rejects a dangling topic reference', async () => {
    const root = await makeContentDir({
      'topics.json': validTopics,
      'resources/bad.json': [makeResource({ id: 'orphan', topics: ['no-such-topic'] })],
    })
    const { issues } = await loadContentSet({ root, today: TODAY })

    expect(issues.some((i) => i.message.includes('unknown topic "no-such-topic"'))).toBe(true)
  })

  it('rejects duplicate ids across different files', async () => {
    const root = await makeContentDir({
      'topics.json': validTopics,
      'resources/a.json': [makeResource({ id: 'clash' })],
      'resources/b.json': [makeResource({ id: 'clash' })],
    })
    const { issues } = await loadContentSet({ root, today: TODAY })
    const duplicate = issues.find((i) => i.rule === 1)

    expect(duplicate).toBeDefined()
    // The message must point at the OTHER file, or you cannot find the clash.
    expect(duplicate?.message).toMatch(/resources[/\\]a\.json/)
  })

  it('does not run cross-record rules when records failed to parse', async () => {
    // Otherwise a single malformed record buries the real error under a pile of
    // phantom "unknown topic" failures from everything that referenced it.
    const root = await makeContentDir({
      'topics.json': '[{ "id": ',
      'resources/bad.json': [makeResource({ id: 'a', topics: ['test-topic'] })],
    })
    const { issues } = await loadContentSet({ root, today: TODAY })

    expect(issues.some((i) => i.message.includes('invalid JSON'))).toBe(true)
    expect(issues.some((i) => i.rule === 2)).toBe(false)
  })
})

describe('freshness is evaluated against the injected date, not the clock', () => {
  const verifiedOn = (date: string) =>
    makeResource({
      id: 'aging',
      status: 'verified',
      url: 'https://example.com/x',
      last_verified_at: date,
      verified_by: 'pranav',
    })

  it('is fresh at 180 days and stale at 181', async () => {
    const root = await makeContentDir({
      'topics.json': [makeTopic({ id: 'test-topic' })],
      'resources/r.json': [verifiedOn('2026-02-26')],
    })

    const fresh = await loadContentSet({ root, today: '2026-08-25' })
    expect(fresh.issues.filter((i) => i.rule === 9)).toHaveLength(0)

    const stale = await loadContentSet({ root, today: '2026-08-26' })
    expect(stale.issues.filter((i) => i.rule === 9)).toHaveLength(1)
  })
})

describe('formatIssue produces something a contributor can act on', () => {
  it('includes the file, the record id and the rule', async () => {
    const root = await makeContentDir({
      'topics.json': [makeTopic({ id: 'test-topic' })],
      'resources/bad.json': [makeResource({ id: 'orphan', topics: ['ghost'] })],
    })
    const { issues } = await loadContentSet({ root, today: TODAY })
    const text = formatIssue(issues.find((i) => i.rule === 2)!)

    expect(text).toMatch(/orphan/)
    expect(text).toMatch(/rule 2/)
    expect(text).toMatch(/bad\.json/)
    expect(text).toMatch(/unknown topic "ghost"/)
  })
})
