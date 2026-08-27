import { describe, expect, it } from 'vitest'

import { EMPTY_CRITERIA, type FilterCriteria } from '../selectors/filterResources.ts'
import { parseLibraryState, serializeLibraryState, type LibraryState } from './urlState.ts'

function state(
  criteria: Partial<FilterCriteria> = {},
  rest: Partial<LibraryState> = {},
): LibraryState {
  return {
    criteria: { ...EMPTY_CRITERIA, ...criteria },
    sort: null,
    shown: null,
    ...rest,
  }
}

function roundTrip(input: LibraryState): LibraryState {
  return parseLibraryState(serializeLibraryState(input))
}

/**
 * The canonical form of a state.
 *
 * Serialisation sorts multi-value facets on purpose, so that ticking the same
 * boxes in a different order produces the same URL. That makes sorted order the
 * canonical form, and it is what a round trip is expected to converge on — not
 * the arbitrary order the caller happened to pass in.
 */
function canonical(input: LibraryState): LibraryState {
  const sortArrays = <T>(values: T[]): T[] => [...values].sort()

  return {
    ...input,
    criteria: {
      ...input.criteria,
      query: input.criteria.query.trim(),
      topics: sortArrays(input.criteria.topics),
      types: sortArrays(input.criteria.types),
      difficulties: sortArrays(input.criteria.difficulties),
      costs: sortArrays(input.criteria.costs),
      languages: sortArrays(input.criteria.languages),
      providers: sortArrays(input.criteria.providers),
      statuses: sortArrays(input.criteria.statuses),
      theoryVsPractice: sortArrays(input.criteria.theoryVsPractice),
    },
  }
}

describe('parsing an empty query string', () => {
  it('produces empty criteria and no overrides', () => {
    expect(parseLibraryState(new URLSearchParams())).toEqual(state())
  })
})

describe('serialising', () => {
  it('writes nothing for an unfiltered library, so "clear all" gives a clean URL', () => {
    expect(serializeLibraryState(state()).toString()).toBe('')
  })

  it('writes repeated parameters for multi-value facets', () => {
    const params = serializeLibraryState(state({ types: ['video', 'course'] }))
    expect(params.getAll('type')).toEqual(['course', 'video'])
  })

  it('sorts values so the same selection always produces the same URL', () => {
    // Otherwise ticking boxes in a different order yields a different link for
    // an identical view, which breaks sharing and caching alike.
    const a = serializeLibraryState(state({ topics: ['nlp', 'attention'] })).toString()
    const b = serializeLibraryState(state({ topics: ['attention', 'nlp'] })).toString()

    expect(a).toBe(b)
  })

  it('writes booleans explicitly, including false', () => {
    expect(serializeLibraryState(state({ projectBased: false })).get('project')).toBe('false')
  })

  it('omits a null boolean entirely', () => {
    expect(serializeLibraryState(state({ projectBased: null })).has('project')).toBe(false)
  })

  it('trims the query', () => {
    expect(serializeLibraryState(state({ query: '  nlp  ' })).get('q')).toBe('nlp')
  })
})

describe('round trip', () => {
  const cases: Array<[string, LibraryState]> = [
    ['empty', state()],
    ['query only', state({ query: 'attention' })],
    ['one facet', state({ types: ['video'] })],
    ['multi-value facet', state({ topics: ['nlp', 'attention', 'transformers'] })],
    ['booleans', state({ beginnerFriendly: true, projectBased: false })],
    ['duration', state({ maxDurationMinutes: 45 })],
    [
      'everything at once',
      state(
        {
          query: 'tokenization',
          topics: ['nlp'],
          types: ['video', 'course'],
          difficulties: ['beginner'],
          costs: ['free'],
          languages: ['en'],
          providers: ['hugging-face'],
          statuses: ['unverified'],
          theoryVsPractice: ['balanced'],
          beginnerFriendly: true,
          projectBased: false,
          maxDurationMinutes: 90,
        },
        { sort: 'title', shown: 48 },
      ),
    ],
  ]

  it.each(cases)('restores %s exactly', (_name, input) => {
    expect(roundTrip(input)).toEqual(canonical(input))
  })

  it('converges after one pass — a canonical state round-trips unchanged', () => {
    for (const [, input] of cases) {
      const once = canonical(input)
      expect(roundTrip(once)).toEqual(once)
    }
  })

  it('is idempotent — serialising twice gives the same string', () => {
    const once = serializeLibraryState(cases[6]![1])
    const twice = serializeLibraryState(parseLibraryState(once))

    expect(twice.toString()).toBe(once.toString())
  })
})

describe('a URL is user-editable, so bad input is dropped rather than rejected', () => {
  it('drops an unknown enum value but keeps the valid ones', () => {
    const parsed = parseLibraryState(new URLSearchParams('type=video&type=telepathy'))
    expect(parsed.criteria.types).toEqual(['video'])
  })

  it('ignores an unknown sort', () => {
    expect(parseLibraryState(new URLSearchParams('sort=vibes')).sort).toBeNull()
  })

  it.each(['maxmins=0', 'maxmins=-5', 'maxmins=abc', 'maxmins=1.5'])('ignores %s', (qs) => {
    expect(parseLibraryState(new URLSearchParams(qs)).criteria.maxDurationMinutes).toBeNull()
  })

  it('treats a non-boolean flag as unset rather than as true', () => {
    expect(
      parseLibraryState(new URLSearchParams('beginner=yes')).criteria.beginnerFriendly,
    ).toBeNull()
  })

  it('accepts a comma-separated list, which is what hand-edited URLs look like', () => {
    const parsed = parseLibraryState(new URLSearchParams('type=video,course'))
    expect(parsed.criteria.types.sort()).toEqual(['course', 'video'])
  })

  it('de-duplicates repeated values', () => {
    const parsed = parseLibraryState(new URLSearchParams('type=video&type=video'))
    expect(parsed.criteria.types).toEqual(['video'])
  })

  it('ignores parameters it does not know', () => {
    const parsed = parseLibraryState(new URLSearchParams('utm_source=twitter&type=video'))
    expect(parsed.criteria.types).toEqual(['video'])
  })

  it('keeps open-set ids it cannot validate, so they simply match nothing', () => {
    // Topic and provider ids are not a fixed list. A value matching nothing
    // yields no results, which is honest; silently dropping it would show the
    // user an unfiltered page while their URL says otherwise.
    const parsed = parseLibraryState(new URLSearchParams('topic=not-a-real-topic'))
    expect(parsed.criteria.topics).toEqual(['not-a-real-topic'])
  })

  it('survives an empty value', () => {
    expect(parseLibraryState(new URLSearchParams('topic=&q=')).criteria.topics).toEqual([])
  })
})
