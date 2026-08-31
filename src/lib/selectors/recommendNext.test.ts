import { describe, expect, it } from 'vitest'

import { makeLearningPath, makeProvider, makeResource } from '@tests/fixtures/content.ts'
import { topics as realTopics } from '@/content/generated/index.ts'

import type { Provider } from '../schema/index.ts'
import {
  GOAL_TOPICS,
  recommendNext,
  suggestMore,
  type RecommendationContext,
} from './recommendNext.ts'

const TODAY = '2026-08-31'

const providersById = new Map<string, Provider>([
  ['official-co', makeProvider({ id: 'official-co', name: 'Official Co', kind: 'official' })],
])

function context(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    resources: [],
    paths: [],
    completions: {},
    checkpointCompletions: {},
    profile: { level: null, goal: null },
    providersById,
    today: TODAY,
    ...overrides,
  }
}

/** A linkable resource, since recommendations never point at a dead end. */
function resource(overrides: Parameters<typeof makeResource>[0] = {}) {
  return makeResource({ url: 'https://example.com/x', status: 'unverified', ...overrides })
}

describe('GOAL_TOPICS references the real taxonomy', () => {
  // A typo here would silently make a goal recommend nothing in particular,
  // which is invisible: the fallback still returns a plausible resource.
  const realIds = new Set(realTopics.map((t) => t.id))

  it.each(Object.entries(GOAL_TOPICS))('every topic for goal %s exists', (_goal, topicIds) => {
    for (const id of topicIds) {
      expect(realIds.has(id), `unknown topic "${id}"`).toBe(true)
    }
  })

  it('covers every goal', () => {
    expect(Object.keys(GOAL_TOPICS)).toHaveLength(6)
  })
})

describe('with nothing to go on', () => {
  it('says plainly that the suggestion is not personalised', () => {
    const rec = recommendNext(context({ resources: [resource({ id: 'a' })] }))

    expect(rec.kind).toBe('resource')
    expect(rec.reason).toMatch(/tell us your level/i)
  })

  it('reports honestly when there is nothing to suggest', () => {
    const rec = recommendNext(context({ resources: [] }))

    expect(rec.kind).toBe('nothing')
    expect(rec.reason).toMatch(/everything in the catalogue/i)
  })

  it('never suggests a resource with no link', () => {
    const rec = recommendNext(
      context({ resources: [makeResource({ id: 'no-link', url: null, status: 'unverified' })] }),
    )
    expect(rec.kind).toBe('nothing')
  })

  it('never suggests a broken or deprecated resource', () => {
    const rec = recommendNext(
      context({
        resources: [
          resource({ id: 'dead', status: 'broken' }),
          resource({ id: 'old', status: 'deprecated' }),
        ],
      }),
    )
    expect(rec.kind).toBe('nothing')
  })
})

describe('with a profile but no path', () => {
  const nlpResource = resource({ id: 'nlp-one', topics: ['nlp'] })
  const mlopsResource = resource({ id: 'mlops-one', topics: ['mlops-production'] })

  it('prefers a resource matching the stated goal', () => {
    const rec = recommendNext(
      context({
        resources: [mlopsResource, nlpResource],
        profile: { level: null, goal: 'nlp-practitioner' },
      }),
    )

    expect(rec.kind).toBe('resource')
    expect(rec.kind === 'resource' && rec.resource.id).toBe('nlp-one')
    expect(rec.reason).toMatch(/matches your goal/i)
  })

  it('ranks a more central goal topic above a peripheral one', () => {
    // For nlp-practitioner, 'nlp' is first in the list and 'nlp-evaluation-safety' last.
    const central = resource({ id: 'central', topics: ['nlp'] })
    const peripheral = resource({ id: 'peripheral', topics: ['nlp-evaluation-safety'] })

    const rec = recommendNext(
      context({
        resources: [peripheral, central],
        profile: { level: null, goal: 'nlp-practitioner' },
      }),
    )

    expect(rec.kind === 'resource' && rec.resource.id).toBe('central')
  })

  it('falls back to the curated score when nothing matches the goal', () => {
    const rec = recommendNext(
      context({
        resources: [mlopsResource],
        profile: { level: 'beginner', goal: 'nlp-practitioner' },
      }),
    )

    expect(rec.kind === 'resource' && rec.resource.id).toBe('mlops-one')
    expect(rec.reason).toMatch(/highest-ranked/i)
  })

  it('uses the same curated score the library sorts by', () => {
    // A recommendation that disagreed with the library's own ordering would be
    // confusing the moment a user went looking themselves.
    const plain = resource({
      id: 'plain',
      cost_type: 'paid',
      learning_outcomes: [],
      provider_id: null,
    })
    const strong = resource({
      id: 'strong',
      provider_id: 'official-co',
      cost_type: 'free',
      learning_outcomes: ['You will learn a thing'],
    })

    const rec = recommendNext(
      context({ resources: [plain, strong], profile: { level: null, goal: null } }),
    )

    expect(rec.kind === 'resource' && rec.resource.id).toBe('strong')
  })

  it('never suggests something already marked done', () => {
    const rec = recommendNext(
      context({
        resources: [resource({ id: 'done' }), resource({ id: 'todo' })],
        completions: { done: { at: '2026-08-01T00:00:00.000Z' } },
      }),
    )

    expect(rec.kind === 'resource' && rec.resource.id).toBe('todo')
  })

  it('is stable — the same input always gives the same suggestion', () => {
    const input = context({
      resources: [resource({ id: 'b' }), resource({ id: 'a' })],
    })

    const first = recommendNext(input)
    const second = recommendNext(input)

    expect(first).toEqual(second)
  })
})

describe('with a path in progress', () => {
  const one = resource({ id: 'item-one' })
  const two = resource({ id: 'item-two' })
  const three = resource({ id: 'item-three' })

  const path = makeLearningPath({
    id: 'path-x',
    title: 'A Test Path',
    modules: [
      {
        id: 'mod-1',
        title: 'Module one',
        summary: 'A module summary long enough to satisfy validation constraints.',
        items: [
          {
            kind: 'resource',
            resource_id: 'item-one',
            checkpoint: null,
            required: true,
            order: 1,
            note: null,
          },
          {
            kind: 'resource',
            resource_id: 'item-two',
            checkpoint: null,
            required: true,
            order: 2,
            note: null,
          },
          {
            kind: 'resource',
            resource_id: 'item-three',
            checkpoint: null,
            required: false,
            order: 3,
            note: null,
          },
        ],
      },
    ],
  })

  const base = context({ resources: [one, two, three], paths: [path] })

  it('does not treat an untouched path as in progress', () => {
    // Nothing completed yet, so this is a plain resource recommendation.
    expect(recommendNext(base).kind).toBe('resource')
  })

  it('suggests the next required item once the path is started', () => {
    const rec = recommendNext({
      ...base,
      completions: { 'item-one': { at: '2026-08-01T00:00:00.000Z' } },
    })

    expect(rec.kind).toBe('path-item')
    expect(rec.kind === 'path-item' && rec.resource.id).toBe('item-two')
    expect(rec.reason).toContain('A Test Path')
  })

  it('advances after the suggested item is completed', () => {
    // The acceptance criterion for this phase, asserted directly.
    const afterFirst = recommendNext({
      ...base,
      completions: { 'item-one': { at: '2026-08-01T00:00:00.000Z' } },
    })
    expect(afterFirst.kind === 'path-item' && afterFirst.resource.id).toBe('item-two')

    const afterSecond = recommendNext({
      ...base,
      completions: {
        'item-one': { at: '2026-08-01T00:00:00.000Z' },
        'item-two': { at: '2026-08-02T00:00:00.000Z' },
      },
    })
    expect(afterSecond.kind === 'path-item' && afterSecond.resource.id).not.toBe('item-two')
  })

  it('skips optional items when choosing the next step', () => {
    // item-three is optional, so finishing the required ones completes the path.
    const rec = recommendNext({
      ...base,
      completions: {
        'item-one': { at: '2026-08-01T00:00:00.000Z' },
        'item-two': { at: '2026-08-02T00:00:00.000Z' },
      },
    })

    expect(rec.kind).not.toBe('path-item')
  })

  it('respects module and item order', () => {
    const twoModules = makeLearningPath({
      id: 'path-y',
      title: 'Two Modules',
      modules: [
        {
          id: 'mod-a',
          title: 'First module',
          summary: 'A module summary long enough to satisfy validation constraints.',
          items: [
            {
              kind: 'resource',
              resource_id: 'item-two',
              checkpoint: null,
              required: true,
              order: 1,
              note: null,
            },
          ],
        },
        {
          id: 'mod-b',
          title: 'Second module',
          summary: 'A module summary long enough to satisfy validation constraints.',
          items: [
            {
              kind: 'resource',
              resource_id: 'item-three',
              checkpoint: null,
              required: true,
              order: 1,
              note: null,
            },
          ],
        },
      ],
    })

    const rec = recommendNext({
      ...context({ resources: [one, two, three], paths: [twoModules] }),
      // Started by completing something in the second module.
      completions: { 'item-three': { at: '2026-08-01T00:00:00.000Z' } },
    })

    expect(rec.kind === 'path-item' && rec.resource.id).toBe('item-two')
  })
})

describe('when a path is finished', () => {
  const one = resource({ id: 'only-item' })

  const finished = makeLearningPath({
    id: 'path-done',
    title: 'Finished Path',
    next_path_ids: ['path-next'],
    modules: [
      {
        id: 'mod-1',
        title: 'Module one',
        summary: 'A module summary long enough to satisfy validation constraints.',
        items: [
          {
            kind: 'resource',
            resource_id: 'only-item',
            checkpoint: null,
            required: true,
            order: 1,
            note: null,
          },
        ],
      },
    ],
  })

  const nextPath = makeLearningPath({ id: 'path-next', title: 'The Next Path' })

  it('suggests the path it points at', () => {
    const rec = recommendNext(
      context({
        resources: [one],
        paths: [finished, nextPath],
        completions: { 'only-item': { at: '2026-08-01T00:00:00.000Z' } },
      }),
    )

    expect(rec.kind).toBe('next-path')
    expect(rec.kind === 'next-path' && rec.path.id).toBe('path-next')
    expect(rec.reason).toContain('Finished Path')
  })

  it('falls back to a resource when it points nowhere', () => {
    const orphan = makeLearningPath({ ...finished, next_path_ids: [] })
    const spare = resource({ id: 'spare' })

    const rec = recommendNext(
      context({
        resources: [one, spare],
        paths: [orphan],
        completions: { 'only-item': { at: '2026-08-01T00:00:00.000Z' } },
      }),
    )

    expect(rec.kind).toBe('resource')
    expect(rec.kind === 'resource' && rec.resource.id).toBe('spare')
  })

  it('does not suggest a path that does not exist', () => {
    const dangling = makeLearningPath({ ...finished, next_path_ids: ['ghost-path'] })

    const rec = recommendNext(
      context({
        resources: [one],
        paths: [dangling],
        completions: { 'only-item': { at: '2026-08-01T00:00:00.000Z' } },
      }),
    )

    expect(rec.kind).toBe('nothing')
  })
})

describe('suggestMore', () => {
  const items = [
    resource({ id: 'a', topics: ['nlp'] }),
    resource({ id: 'b', topics: ['nlp'] }),
    resource({ id: 'c', topics: ['nlp'] }),
    resource({ id: 'd', topics: ['nlp'] }),
  ]

  it('returns the requested number of suggestions', () => {
    expect(suggestMore(context({ resources: items }), { limit: 2 })).toHaveLength(2)
  })

  it('excludes ids already shown elsewhere', () => {
    const result = suggestMore(context({ resources: items }), { excludeIds: ['a', 'b'], limit: 4 })
    expect(result.map((r) => r.id)).not.toContain('a')
    expect(result.map((r) => r.id)).not.toContain('b')
  })

  it('can filter to one resource type', () => {
    const withVideo = [
      ...items,
      resource({
        id: 'vid',
        resource_type: 'video',
        channel: null,
        playlist_url: null,
        is_part_of_course: false,
        embeddable: null,
      }),
    ]

    const result = suggestMore(context({ resources: withVideo }), { type: 'video' })
    expect(result.map((r) => r.id)).toEqual(['vid'])
  })

  it('excludes completed resources', () => {
    const result = suggestMore(
      context({ resources: items, completions: { a: { at: '2026-08-01T00:00:00.000Z' } } }),
      { limit: 4 },
    )
    expect(result.map((r) => r.id)).not.toContain('a')
  })

  it('returns an empty list rather than throwing when nothing qualifies', () => {
    expect(suggestMore(context({ resources: [] }))).toEqual([])
  })
})
