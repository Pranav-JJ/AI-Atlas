import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { makeProvider, makeResource } from '@tests/fixtures/content.ts'

import type { Provider } from '../schema/index.ts'
import {
  curatedScore,
  defaultSortFor,
  explainCuratedScore,
  SORT_OPTIONS,
  sortResources,
  type ScoreContext,
} from './sortResources.ts'

const TODAY = '2026-08-27'

const providersById = new Map<string, Provider>([
  ['official-co', makeProvider({ id: 'official-co', name: 'Official Co', kind: 'official' })],
  ['uni', makeProvider({ id: 'uni', name: 'A University', kind: 'academic' })],
  ['blogger', makeProvider({ id: 'blogger', name: 'A Blogger', kind: 'community' })],
])

function context(overrides: Partial<ScoreContext> = {}): ScoreContext {
  return { providersById, today: TODAY, learnerLevel: null, ...overrides }
}

const ids = (list: ReturnType<typeof sortResources>) => list.map((r) => r.id)

describe('curated score terms', () => {
  it('scores a bare unverified record at zero', () => {
    const bare = makeResource({
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
      status: 'unverified',
      url: null,
    })
    expect(curatedScore(bare, context())).toBe(0)
  })

  it('awards +3 for a human verification', () => {
    const verified = makeResource({
      status: 'verified',
      url: 'https://example.com/x',
      last_verified_at: '2026-08-01',
      verified_by: 'pranav',
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
    })
    // +3 verified, +1 verified within 180 days
    expect(curatedScore(verified, context())).toBe(4)
  })

  it.each([
    ['official-co', 2],
    ['uni', 2],
    ['blogger', 0],
  ])('awards provider points for %s', (provider_id, expected) => {
    const resource = makeResource({
      provider_id,
      cost_type: 'paid',
      learning_outcomes: [],
      status: 'unverified',
      url: null,
    })
    expect(curatedScore(resource, context())).toBe(expected)
  })

  it('awards +2 only when a learner level is stated and matches', () => {
    const beginner = makeResource({
      difficulty: 'beginner',
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
      status: 'unverified',
      url: null,
    })

    expect(curatedScore(beginner, context({ learnerLevel: null }))).toBe(0)
    expect(curatedScore(beginner, context({ learnerLevel: 'beginner' }))).toBe(2)
    expect(curatedScore(beginner, context({ learnerLevel: 'advanced' }))).toBe(0)
  })

  it('awards +1 for free and +1 for stated outcomes', () => {
    const resource = makeResource({
      cost_type: 'free',
      learning_outcomes: ['You will learn something'],
      provider_id: null,
      status: 'unverified',
      url: null,
    })
    expect(curatedScore(resource, context())).toBe(2)
  })

  it('penalises stale by -2 and broken by -5', () => {
    const base = {
      cost_type: 'paid' as const,
      learning_outcomes: [],
      provider_id: null,
      url: 'https://example.com/x',
      last_verified_at: null,
      verified_by: null,
    }

    expect(curatedScore(makeResource({ ...base, status: 'stale' }), context())).toBe(-2)
    expect(curatedScore(makeResource({ ...base, status: 'broken' }), context())).toBe(-5)
  })

  it('does not award the freshness point to a verification older than 180 days', () => {
    const old = makeResource({
      status: 'stale',
      url: 'https://example.com/x',
      last_verified_at: '2025-01-01',
      verified_by: 'pranav',
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
    })
    // -2 stale only; no freshness point.
    expect(curatedScore(old, context())).toBe(-2)
  })

  it('never uses a popularity signal', () => {
    // The whole point of a transparent score. Reasons are the complete list of
    // inputs, so this asserts nothing reach-based crept in.
    const resource = makeResource({
      status: 'verified',
      url: 'https://example.com/x',
      last_verified_at: '2026-08-01',
      verified_by: 'pranav',
      provider_id: 'official-co',
      cost_type: 'free',
      learning_outcomes: ['x'],
    })

    const text = explainCuratedScore(resource, context())
      .map((r) => r.reason)
      .join(' ')
      .toLowerCase()

    for (const banned of ['popular', 'view', 'star', 'trending', 'rating', 'download']) {
      expect(text).not.toContain(banned)
    }
  })
})

describe('explainCuratedScore', () => {
  it('sums to exactly the score used for ordering', () => {
    // The explanation on the detail page and the ordering must come from one
    // computation, or they eventually disagree with each other.
    const resource = makeResource({
      status: 'verified',
      url: 'https://example.com/x',
      last_verified_at: '2026-08-01',
      verified_by: 'pranav',
      provider_id: 'uni',
      cost_type: 'free',
      learning_outcomes: ['a'],
      difficulty: 'beginner',
    })
    const ctx = context({ learnerLevel: 'beginner' })

    const summed = explainCuratedScore(resource, ctx).reduce((t, r) => t + r.points, 0)
    expect(summed).toBe(curatedScore(resource, ctx))
    expect(summed).toBe(10)
  })

  it('names the provider it credited', () => {
    const resource = makeResource({ provider_id: 'uni' })
    const reasons = explainCuratedScore(resource, context()).map((r) => r.reason)

    expect(reasons.join(' ')).toContain('A University')
  })

  it('returns no reasons for a record that earns nothing', () => {
    const bare = makeResource({
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
      status: 'unverified',
      url: null,
    })
    expect(explainCuratedScore(bare, context())).toEqual([])
  })
})

describe('the score matches EDITORIAL_POLICY.md', () => {
  // These are the same decision written in two places. If the document and the
  // code drift, the site is explaining a ranking it does not actually use.
  const policy = readFileSync('EDITORIAL_POLICY.md', 'utf8')

  it.each([
    ['+3', 'verified'],
    ['+2', 'official'],
    ['+1', 'free'],
    ['-2', 'stale'],
    ['-5', 'broken'],
  ])('documents %s for %s', (points, keyword) => {
    const line = policy
      .split('\n')
      .find((l) => l.trim().startsWith(points) && l.toLowerCase().includes(keyword))

    expect(line, `EDITORIAL_POLICY.md has no "${points} ... ${keyword}" line`).toBeDefined()
  })

  it('states that popularity is not an input', () => {
    expect(policy).toMatch(/POPULARITY IS NOT AN INPUT|Popularity is not an input/i)
  })
})

describe('sortResources', () => {
  const a = makeResource({
    id: 'a',
    title: 'Zebra',
    estimated_duration_minutes: 10,
    added_at: '2026-01-01',
  })
  const b = makeResource({
    id: 'b',
    title: 'Apple',
    estimated_duration_minutes: 90,
    added_at: '2026-06-01',
  })
  const c = makeResource({
    id: 'c',
    title: 'Mango',
    estimated_duration_minutes: null,
    added_at: '2026-03-01',
  })

  it('sorts by title', () => {
    expect(ids(sortResources([a, b, c], 'title', context()))).toEqual(['b', 'c', 'a'])
  })

  it('sorts by duration ascending, with unknown durations last', () => {
    expect(ids(sortResources([c, b, a], 'duration-asc', context()))).toEqual(['a', 'b', 'c'])
  })

  it('sorts by duration descending, with unknown durations STILL last', () => {
    // Unknown is missing information, not "very long". It must not lead.
    expect(ids(sortResources([c, a, b], 'duration-desc', context()))).toEqual(['b', 'a', 'c'])
  })

  it('sorts by recently added, newest first', () => {
    expect(ids(sortResources([a, b, c], 'recently-added', context()))).toEqual(['b', 'c', 'a'])
  })

  it('sorts by curated score, highest first', () => {
    const low = makeResource({
      id: 'low',
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
    })
    const high = makeResource({
      id: 'high',
      status: 'verified',
      url: 'https://example.com/x',
      last_verified_at: '2026-08-01',
      verified_by: 'pranav',
      provider_id: 'official-co',
      cost_type: 'free',
    })

    expect(ids(sortResources([low, high], 'curated', context()))).toEqual(['high', 'low'])
  })

  it('leaves relevance order untouched', () => {
    // That order came from the search index; re-sorting would discard ranking.
    expect(ids(sortResources([c, a, b], 'relevance', context()))).toEqual(['c', 'a', 'b'])
  })

  it('breaks every tie by id, so the order is total and stable', () => {
    const x = makeResource({ id: 'x', title: 'Same', estimated_duration_minutes: 5 })
    const y = makeResource({ id: 'y', title: 'Same', estimated_duration_minutes: 5 })

    for (const sort of SORT_OPTIONS) {
      if (sort === 'relevance') continue
      expect(ids(sortResources([y, x], sort, context())), sort).toEqual(['x', 'y'])
    }
  })

  it('does not mutate the input array', () => {
    const input = [c, a, b]
    sortResources(input, 'title', context())
    expect(ids(input)).toEqual(['c', 'a', 'b'])
  })

  it('handles an empty list', () => {
    expect(sortResources([], 'curated', context())).toEqual([])
  })
})

describe('defaultSortFor', () => {
  it('uses relevance when there is a query', () => {
    expect(defaultSortFor('nlp')).toBe('relevance')
  })

  it('uses curated when there is not', () => {
    expect(defaultSortFor('')).toBe('curated')
    expect(defaultSortFor('   ')).toBe('curated')
  })
})
