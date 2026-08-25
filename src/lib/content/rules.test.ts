import { describe, expect, it } from 'vitest'

import {
  makeContentSet,
  makeGlossaryTerm,
  makeLearningPath,
  makePathItem,
  makeProject,
  makeProvider,
  makeResource,
  makeTopic,
} from '@tests/fixtures/content.ts'

import {
  applyStaleDowngrade,
  checkCrossRecordRules,
  daysBetween,
  findStaleRecords,
  type ContentIssue,
} from './rules.ts'

const TODAY = '2026-08-25'

function rules(issues: ContentIssue[]): number[] {
  return [...new Set(issues.map((i) => i.rule))].sort((a, b) => a - b)
}

function errorsOnly(issues: ContentIssue[]): ContentIssue[] {
  return issues.filter((i) => i.severity === 'error')
}

describe('a well-formed content set produces no issues', () => {
  it('validates cleanly', () => {
    const set = makeContentSet({
      topics: [makeTopic()],
      providers: [makeProvider()],
      resources: [makeResource()],
    })
    expect(checkCrossRecordRules(set, TODAY)).toEqual([])
  })
})

describe('rule 1 — ids are unique across the entire content set', () => {
  it('rejects two resources sharing an id', () => {
    const set = makeContentSet({
      resources: [makeResource({ id: 'duplicate' }), makeResource({ id: 'duplicate' })],
    })
    const issues = checkCrossRecordRules(set, TODAY)

    expect(rules(issues)).toContain(1)
    expect(issues[0]?.message).toMatch(/duplicate id "duplicate"/)
  })

  it('rejects a collision ACROSS collections, not just within one', () => {
    // Ids appear in URLs and in saved user progress, so a project colliding with
    // a resource would silently corrupt both.
    const set = makeContentSet({
      topics: [makeTopic({ id: 'shared-id' })],
      resources: [makeResource({ id: 'shared-id', topics: ['shared-id'] })],
    })

    expect(rules(checkCrossRecordRules(set, TODAY))).toContain(1)
  })

  it('names the file the earlier definition came from', () => {
    const set = makeContentSet({
      resources: [makeResource({ id: 'dupe' }), makeResource({ id: 'dupe' })],
    })
    const issue = checkCrossRecordRules(set, TODAY)[0]

    expect(issue?.file).toBe('content/resources/test.json')
    expect(issue?.recordId).toBe('dupe')
    expect(issue?.message).toMatch(/already defined in content\/resources\/test\.json/)
  })
})

describe('rule 2 — topic references must resolve', () => {
  it('rejects a resource tagged with an unknown topic', () => {
    const set = makeContentSet({ resources: [makeResource({ topics: ['no-such-topic'] })] })
    const issues = checkCrossRecordRules(set, TODAY)

    expect(rules(issues)).toContain(2)
    expect(issues[0]?.message).toMatch(/unknown topic "no-such-topic"/)
    expect(issues[0]?.field).toBe('topics')
  })

  it('rejects an unknown parentId on a topic', () => {
    const set = makeContentSet({ topics: [makeTopic({ parentId: 'ghost-parent' })] })
    expect(rules(checkCrossRecordRules(set, TODAY))).toContain(2)
  })

  it('rejects an unknown prerequisite topic', () => {
    const set = makeContentSet({ topics: [makeTopic({ prerequisiteTopics: ['ghost'] })] })
    expect(rules(checkCrossRecordRules(set, TODAY))).toContain(2)
  })

  it('rejects an unknown topic on a project and on a glossary term', () => {
    const set = makeContentSet({
      projects: [makeProject({ topics: ['ghost'] })],
      glossary: [makeGlossaryTerm({ topics: ['ghost'] })],
    })
    expect(errorsOnly(checkCrossRecordRules(set, TODAY))).toHaveLength(2)
  })
})

describe('rule 3 — record references must resolve', () => {
  it('rejects an unknown provider_id', () => {
    const set = makeContentSet({ resources: [makeResource({ provider_id: 'ghost-provider' })] })
    const issues = checkCrossRecordRules(set, TODAY)

    expect(rules(issues)).toContain(3)
    expect(issues[0]?.message).toMatch(/unknown provider "ghost-provider"/)
  })

  it('rejects a path item pointing at a resource that does not exist', () => {
    const set = makeContentSet({
      paths: [makeLearningPath()],
    })
    const issues = checkCrossRecordRules(set, TODAY)

    expect(rules(issues)).toContain(3)
    // The field path must locate the item inside the module, not just the path.
    expect(issues[0]?.field).toMatch(/modules\.test-module\.items\[order=1\]\.resource_id/)
  })

  it('accepts a path item whose resource exists', () => {
    const set = makeContentSet({
      resources: [makeResource({ id: 'test-resource' })],
      paths: [makeLearningPath()],
    })
    expect(errorsOnly(checkCrossRecordRules(set, TODAY))).toEqual([])
  })

  it('rejects an unknown next_path_id', () => {
    const set = makeContentSet({
      resources: [makeResource({ id: 'test-resource' })],
      paths: [makeLearningPath({ next_path_ids: ['ghost-path'] })],
    })
    expect(rules(checkCrossRecordRules(set, TODAY))).toContain(3)
  })

  it('rejects a dataset_ids reference that points at a non-dataset resource', () => {
    // The referenced id exists, but it is a tutorial, not a dataset.
    const set = makeContentSet({
      resources: [
        makeResource({ id: 'not-a-dataset' }),
        makeResource({
          id: 'test-paper',
          resource_type: 'paper',
          authors: [],
          year: null,
          venue: null,
          peer_review_status: 'unknown',
          abstract_summary: null,
          key_idea: null,
          code_url: null,
          dataset_ids: ['not-a-dataset'],
        }),
      ],
    })

    const issues = checkCrossRecordRules(set, TODAY)
    expect(issues.some((i) => i.message.includes('unknown dataset "not-a-dataset"'))).toBe(true)
  })

  it('rejects an unknown related_term_id on a glossary entry', () => {
    const set = makeContentSet({ glossary: [makeGlossaryTerm({ related_term_ids: ['ghost'] })] })
    expect(rules(checkCrossRecordRules(set, TODAY))).toContain(3)
  })
})

describe('rule 10 — the topic graph must be acyclic', () => {
  it('detects a two-node parent cycle', () => {
    const set = makeContentSet({
      topics: [makeTopic({ id: 'a', parentId: 'b' }), makeTopic({ id: 'b', parentId: 'a' })],
    })
    const issues = checkCrossRecordRules(set, TODAY)

    expect(rules(issues)).toContain(10)
    expect(issues.find((i) => i.rule === 10)?.message).toMatch(/parent cycle/)
  })

  it('detects a topic that is its own parent', () => {
    const set = makeContentSet({ topics: [makeTopic({ id: 'a', parentId: 'a' })] })
    expect(rules(checkCrossRecordRules(set, TODAY))).toContain(10)
  })

  it('detects a longer prerequisite cycle', () => {
    const set = makeContentSet({
      topics: [
        makeTopic({ id: 'a', prerequisiteTopics: ['b'] }),
        makeTopic({ id: 'b', prerequisiteTopics: ['c'] }),
        makeTopic({ id: 'c', prerequisiteTopics: ['a'] }),
      ],
    })
    const issue = checkCrossRecordRules(set, TODAY).find((i) => i.rule === 10)

    expect(issue?.message).toMatch(/prerequisite cycle/)
    // The message must show the loop so it can actually be fixed.
    expect(issue?.message).toMatch(/a -> b -> c -> a|b -> c -> a -> b|c -> a -> b -> c/)
  })

  it('accepts a deep but acyclic hierarchy', () => {
    const set = makeContentSet({
      topics: [
        makeTopic({ id: 'root', parentId: null }),
        makeTopic({ id: 'mid', parentId: 'root' }),
        makeTopic({ id: 'leaf', parentId: 'mid', prerequisiteTopics: ['mid', 'root'] }),
      ],
    })
    expect(checkCrossRecordRules(set, TODAY)).toEqual([])
  })

  it('accepts a diamond, which is not a cycle', () => {
    const set = makeContentSet({
      topics: [
        makeTopic({ id: 'top' }),
        makeTopic({ id: 'left', prerequisiteTopics: ['top'] }),
        makeTopic({ id: 'right', prerequisiteTopics: ['top'] }),
        makeTopic({ id: 'bottom', prerequisiteTopics: ['left', 'right'] }),
      ],
    })
    expect(checkCrossRecordRules(set, TODAY)).toEqual([])
  })
})

describe('rule 12 — duplicate urls are a warning, not an error', () => {
  it('flags two records sharing a url', () => {
    const set = makeContentSet({
      resources: [
        makeResource({ id: 'first', url: 'https://example.com/same' }),
        makeResource({ id: 'second', url: 'https://example.com/same' }),
      ],
    })
    const issues = checkCrossRecordRules(set, TODAY)
    const duplicate = issues.find((i) => i.rule === 12)

    expect(duplicate?.severity).toBe('warning')
    expect(duplicate?.message).toMatch(/also used by "first"/)
  })

  it('does not flag multiple records with a null url', () => {
    const set = makeContentSet({
      resources: [
        makeResource({ id: 'a', url: null, status: 'unverified' }),
        makeResource({ id: 'b', url: null, status: 'unverified' }),
      ],
    })
    expect(checkCrossRecordRules(set, TODAY)).toEqual([])
  })
})

describe('rule 9 — verification freshness', () => {
  const verified = (last_verified_at: string) =>
    makeResource({
      id: 'aging',
      status: 'verified',
      url: 'https://example.com/guide',
      last_verified_at,
      verified_by: 'pranav',
    })

  it('does not flag a recent verification', () => {
    const set = makeContentSet({ resources: [verified('2026-08-01')] })
    expect(findStaleRecords(set, TODAY)).toEqual([])
  })

  it('flags a verification older than 180 days', () => {
    const set = makeContentSet({ resources: [verified('2025-01-01')] })
    const issues = findStaleRecords(set, TODAY)

    expect(issues).toHaveLength(1)
    expect(issues[0]?.severity).toBe('warning')
    expect(issues[0]?.message).toMatch(/downgraded to "stale"/)
  })

  it('treats exactly 180 days as still fresh, and 181 as stale', () => {
    // 2026-08-25 minus 180 days.
    const set180 = makeContentSet({ resources: [verified('2026-02-26')] })
    expect(daysBetween('2026-02-26', TODAY)).toBe(180)
    expect(findStaleRecords(set180, TODAY)).toEqual([])

    const set181 = makeContentSet({ resources: [verified('2026-02-25')] })
    expect(daysBetween('2026-02-25', TODAY)).toBe(181)
    expect(findStaleRecords(set181, TODAY)).toHaveLength(1)
  })

  it('never flags an unverified record, which has no verification to age', () => {
    const set = makeContentSet({ resources: [makeResource({ url: null, status: 'unverified' })] })
    expect(findStaleRecords(set, TODAY)).toEqual([])
  })

  it('is deterministic — the same set and date always give the same answer', () => {
    const set = makeContentSet({ resources: [verified('2025-01-01')] })
    expect(findStaleRecords(set, TODAY)).toEqual(findStaleRecords(set, TODAY))
  })
})

describe('applyStaleDowngrade', () => {
  const aged = makeResource({
    id: 'aging',
    status: 'verified',
    url: 'https://example.com/guide',
    last_verified_at: '2025-01-01',
    verified_by: 'pranav',
  })

  it('rewrites an aged record to "stale"', () => {
    const set = makeContentSet({ resources: [aged] })
    const downgraded = applyStaleDowngrade(set, TODAY)

    expect(downgraded.resources[0]?.record.status).toBe('stale')
  })

  it('does not mutate the input set', () => {
    // Staleness is DERIVED. The build must never rewrite content files, or
    // re-verifying would mean editing a field the build already changed.
    const set = makeContentSet({ resources: [aged] })
    applyStaleDowngrade(set, TODAY)

    expect(set.resources[0]?.record.status).toBe('verified')
  })

  it('leaves fresh records untouched', () => {
    const fresh = makeResource({
      id: 'fresh',
      status: 'verified',
      url: 'https://example.com/x',
      last_verified_at: '2026-08-20',
      verified_by: 'pranav',
    })
    const set = makeContentSet({ resources: [fresh] })

    expect(applyStaleDowngrade(set, TODAY).resources[0]?.record.status).toBe('verified')
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1)
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('handles a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('handles a year boundary', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })
})

describe('issue reports are actionable', () => {
  it('every issue names a file and, where possible, a record id', () => {
    const set = makeContentSet({
      resources: [makeResource({ topics: ['ghost'], provider_id: 'ghost-provider' })],
      paths: [
        makeLearningPath({
          modules: [
            {
              id: 'm',
              title: 'Module',
              summary: 'A summary long enough to satisfy the minimum length rule.',
              items: [makePathItem({ resource_id: 'ghost-resource' })],
            },
          ],
        }),
      ],
    })

    const issues = checkCrossRecordRules(set, TODAY)
    expect(issues.length).toBeGreaterThan(0)

    for (const issue of issues) {
      expect(issue.file).toMatch(/^content\//)
      expect(issue.recordId).not.toBeNull()
      expect(issue.message.length).toBeGreaterThan(10)
    }
  })
})
