import { describe, expect, it } from 'vitest'

import { makeResource } from '@tests/fixtures/content.ts'

import {
  activeFacets,
  EMPTY_CRITERIA,
  FACET_KEYS,
  facetsResponsibleForEmptyResult,
  filterResources,
  hasAnyFilter,
  type FilterCriteria,
} from './filterResources.ts'

function criteria(overrides: Partial<FilterCriteria> = {}): FilterCriteria {
  return { ...EMPTY_CRITERIA, ...overrides }
}

const catalogue = [
  makeResource({
    id: 'a-video-beginner',
    title: 'Beginner video',
    resource_type: 'video',
    difficulty: 'beginner',
    cost_type: 'free',
    language: 'en',
    provider_id: 'hugging-face',
    topics: ['nlp'],
    subtopics: ['tokenization'],
    theory_vs_practice: 'theory',
    is_beginner_friendly: true,
    is_project_based: false,
    estimated_duration_minutes: 30,
    status: 'unverified',
  }),
  makeResource({
    id: 'b-course-advanced',
    title: 'Advanced course',
    resource_type: 'course',
    difficulty: 'advanced',
    cost_type: 'paid',
    language: 'fr',
    provider_id: 'stanford-university',
    topics: ['deep-learning'],
    subtopics: [],
    theory_vs_practice: 'practice',
    is_beginner_friendly: false,
    is_project_based: true,
    estimated_duration_minutes: 600,
    status: 'verified',
    url: 'https://example.com/b',
    last_verified_at: '2026-08-01',
    verified_by: 'pranav',
  }),
  makeResource({
    id: 'c-book-unknown-duration',
    title: 'A reference book',
    resource_type: 'book',
    difficulty: 'intermediate',
    cost_type: 'freemium',
    language: 'en',
    provider_id: null,
    topics: ['machine-learning'],
    subtopics: [],
    theory_vs_practice: 'balanced',
    is_beginner_friendly: false,
    is_project_based: false,
    estimated_duration_minutes: null,
    status: 'unverified',
  }),
  makeResource({
    id: 'd-broken',
    title: 'A dead link',
    resource_type: 'article',
    difficulty: 'beginner',
    topics: ['nlp'],
    status: 'broken',
    url: 'https://example.com/gone',
  }),
]

const ids = (list: ReturnType<typeof filterResources>) => list.map((r) => r.id)

describe('no filters', () => {
  it('returns everything except broken records', () => {
    // Broken links are excluded from DEFAULT results per the editorial policy.
    expect(ids(filterResources(catalogue, EMPTY_CRITERIA))).toEqual([
      'a-video-beginner',
      'b-course-advanced',
      'c-book-unknown-duration',
    ])
  })

  it('preserves input order', () => {
    const reversed = [...catalogue].reverse()
    expect(ids(filterResources(reversed, EMPTY_CRITERIA))[0]).toBe('c-book-unknown-duration')
  })

  it('does not mutate the input', () => {
    const before = catalogue.map((r) => r.id)
    filterResources(catalogue, criteria({ types: ['video'] }))
    expect(catalogue.map((r) => r.id)).toEqual(before)
  })
})

describe('each facet works on its own', () => {
  it('topics matches the topics field', () => {
    expect(ids(filterResources(catalogue, criteria({ topics: ['deep-learning'] })))).toEqual([
      'b-course-advanced',
    ])
  })

  it('topics also matches subtopics', () => {
    expect(ids(filterResources(catalogue, criteria({ topics: ['tokenization'] })))).toEqual([
      'a-video-beginner',
    ])
  })

  it('types', () => {
    expect(ids(filterResources(catalogue, criteria({ types: ['book'] })))).toEqual([
      'c-book-unknown-duration',
    ])
  })

  it('difficulties', () => {
    expect(ids(filterResources(catalogue, criteria({ difficulties: ['advanced'] })))).toEqual([
      'b-course-advanced',
    ])
  })

  it('costs', () => {
    expect(ids(filterResources(catalogue, criteria({ costs: ['free'] })))).toEqual([
      'a-video-beginner',
    ])
  })

  it('languages', () => {
    expect(ids(filterResources(catalogue, criteria({ languages: ['fr'] })))).toEqual([
      'b-course-advanced',
    ])
  })

  it('providers', () => {
    expect(ids(filterResources(catalogue, criteria({ providers: ['hugging-face'] })))).toEqual([
      'a-video-beginner',
    ])
  })

  it('providers never matches a resource with no provider', () => {
    expect(ids(filterResources(catalogue, criteria({ providers: ['anything'] })))).toEqual([])
  })

  it('statuses', () => {
    expect(ids(filterResources(catalogue, criteria({ statuses: ['verified'] })))).toEqual([
      'b-course-advanced',
    ])
  })

  it('statuses can explicitly surface broken records', () => {
    // Excluded by default, but a maintainer must be able to list them.
    expect(ids(filterResources(catalogue, criteria({ statuses: ['broken'] })))).toEqual([
      'd-broken',
    ])
  })

  it('theoryVsPractice', () => {
    expect(ids(filterResources(catalogue, criteria({ theoryVsPractice: ['practice'] })))).toEqual([
      'b-course-advanced',
    ])
  })

  it('beginnerFriendly true', () => {
    expect(ids(filterResources(catalogue, criteria({ beginnerFriendly: true })))).toEqual([
      'a-video-beginner',
    ])
  })

  it('beginnerFriendly false is a real filter, not "no filter"', () => {
    expect(ids(filterResources(catalogue, criteria({ beginnerFriendly: false })))).toEqual([
      'b-course-advanced',
      'c-book-unknown-duration',
    ])
  })

  it('projectBased', () => {
    expect(ids(filterResources(catalogue, criteria({ projectBased: true })))).toEqual([
      'b-course-advanced',
    ])
  })

  it('maxDurationMinutes', () => {
    expect(ids(filterResources(catalogue, criteria({ maxDurationMinutes: 60 })))).toEqual([
      'a-video-beginner',
    ])
  })

  it('maxDurationMinutes EXCLUDES resources with no recorded duration', () => {
    // Including them would assert "this fits in 600 minutes" about something
    // whose length nobody has established.
    const result = ids(filterResources(catalogue, criteria({ maxDurationMinutes: 600 })))
    expect(result).toEqual(['a-video-beginner', 'b-course-advanced'])
    expect(result).not.toContain('c-book-unknown-duration')
  })

  it('every declared facet is exercised by a test above', () => {
    // Guards against adding a facet and forgetting to test it.
    expect(FACET_KEYS).toHaveLength(11)
  })
})

describe('values within one facet are OR-ed', () => {
  it('adding a value inside a facet can only widen the result', () => {
    const one = filterResources(catalogue, criteria({ types: ['video'] }))
    const two = filterResources(catalogue, criteria({ types: ['video', 'book'] }))

    expect(two.length).toBeGreaterThanOrEqual(one.length)
    expect(ids(two)).toEqual(['a-video-beginner', 'c-book-unknown-duration'])
  })
})

describe('facets are AND-ed with each other', () => {
  it('narrows across facets', () => {
    expect(
      ids(filterResources(catalogue, criteria({ topics: ['nlp'], difficulties: ['beginner'] }))),
    ).toEqual(['a-video-beginner'])
  })

  it('returns nothing when facets conflict', () => {
    expect(
      ids(filterResources(catalogue, criteria({ types: ['book'], difficulties: ['advanced'] }))),
    ).toEqual([])
  })

  it('combines many facets at once', () => {
    const result = filterResources(
      catalogue,
      criteria({
        topics: ['nlp'],
        types: ['video'],
        difficulties: ['beginner'],
        costs: ['free'],
        languages: ['en'],
        providers: ['hugging-face'],
        theoryVsPractice: ['theory'],
        beginnerFriendly: true,
        projectBased: false,
        maxDurationMinutes: 60,
        statuses: ['unverified'],
      }),
    )
    expect(ids(result)).toEqual(['a-video-beginner'])
  })
})

describe('activeFacets and hasAnyFilter', () => {
  it('reports nothing active for empty criteria', () => {
    expect(activeFacets(EMPTY_CRITERIA)).toEqual([])
    expect(hasAnyFilter(EMPTY_CRITERIA)).toBe(false)
  })

  it('treats a boolean false as active', () => {
    expect(activeFacets(criteria({ projectBased: false }))).toEqual(['projectBased'])
  })

  it('counts a query as a filter even with no facets', () => {
    expect(hasAnyFilter(criteria({ query: 'nlp' }))).toBe(true)
    expect(hasAnyFilter(criteria({ query: '   ' }))).toBe(false)
  })
})

describe('facetsResponsibleForEmptyResult', () => {
  it('names the single facet that excluded everything', () => {
    // 'book' + 'advanced' has no match; dropping either alone would find one.
    const empty = criteria({ types: ['book'], difficulties: ['advanced'] })

    expect(filterResources(catalogue, empty)).toEqual([])
    expect(facetsResponsibleForEmptyResult(catalogue, empty).sort()).toEqual([
      'difficulties',
      'types',
    ])
  })

  it('ignores facets that are not the cause', () => {
    // Language 'de' matches nothing at all, so no other facet is responsible.
    const empty = criteria({ languages: ['de'], difficulties: ['beginner'] })

    expect(filterResources(catalogue, empty)).toEqual([])
    expect(facetsResponsibleForEmptyResult(catalogue, empty)).toEqual(['languages'])
  })

  it('names a lone facet that matches nothing', () => {
    // Only one filter is active, so dropping it restores results — it is the
    // thing to loosen, and saying so is the whole point of this function.
    const empty = criteria({ types: ['podcast'] })
    expect(facetsResponsibleForEmptyResult(catalogue, empty)).toEqual(['types'])
  })

  it('returns nothing when no SINGLE facet is responsible', () => {
    // Each of these three excludes everything on its own, so removing any one
    // still leaves an empty result. The honest answer is "no single culprit".
    const empty = criteria({
      types: ['podcast'],
      languages: ['de'],
      difficulties: ['advanced'],
    })

    expect(filterResources(catalogue, empty)).toEqual([])
    expect(facetsResponsibleForEmptyResult(catalogue, empty)).toEqual([])
  })

  it('returns nothing when nothing is filtered at all', () => {
    expect(facetsResponsibleForEmptyResult(catalogue, EMPTY_CRITERIA)).toEqual([])
  })
})
