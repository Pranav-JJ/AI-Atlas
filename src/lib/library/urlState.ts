import { EMPTY_CRITERIA, type FilterCriteria } from '../selectors/filterResources.ts'
import { SORT_OPTIONS, type SortOption } from '../selectors/sortResources.ts'
import {
  COST_TYPES,
  DIFFICULTIES,
  RESOURCE_TYPES,
  STATUSES,
  THEORY_VS_PRACTICE,
  type CostType,
  type Difficulty,
  type ResourceType,
  type Status,
  type TheoryVsPractice,
} from '../schema/index.ts'

/**
 * The URL is the source of truth for library state.
 *
 * Everything the user narrows by is encoded in the query string, which makes a
 * filtered view shareable, restorable on reload, and correct under the back
 * button — none of which is true of state kept in a component.
 *
 * Unknown or malformed values are DROPPED rather than rejected. A URL is
 * user-editable and arrives from bookmarks, other people and older versions of
 * the app; a stray parameter should narrow the view incorrectly at worst, never
 * produce an error page.
 */

const PARAM = {
  query: 'q',
  topics: 'topic',
  types: 'type',
  difficulties: 'level',
  costs: 'cost',
  languages: 'lang',
  providers: 'provider',
  statuses: 'status',
  theoryVsPractice: 'style',
  beginnerFriendly: 'beginner',
  projectBased: 'project',
  maxDurationMinutes: 'maxmins',
  sort: 'sort',
  /** How many items are revealed; keeps "Show more" stable across a reload. */
  shown: 'shown',
} as const

export interface LibraryState {
  criteria: FilterCriteria
  /** Null means "use the default for the current query". */
  sort: SortOption | null
  shown: number | null
}

function readAll(params: URLSearchParams, key: string, allowed?: readonly string[]): string[] {
  const values = params
    .getAll(key)
    // Also accept a comma-separated single parameter, which is what people
    // produce when editing a URL by hand.
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  const unique = [...new Set(values)]

  return allowed ? unique.filter((value) => allowed.includes(value)) : unique
}

function readBoolean(params: URLSearchParams, key: string): boolean | null {
  const value = params.get(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function readPositiveInt(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key)
  if (raw === null) return null

  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) return null

  return value
}

export function parseLibraryState(params: URLSearchParams): LibraryState {
  const sort = params.get(PARAM.sort)

  return {
    criteria: {
      ...EMPTY_CRITERIA,
      query: params.get(PARAM.query)?.trim() ?? '',
      // Topic, language and provider ids are open sets, so they cannot be
      // validated against a fixed list here. A value that matches nothing simply
      // returns no results, which is the honest outcome.
      topics: readAll(params, PARAM.topics),
      languages: readAll(params, PARAM.languages),
      providers: readAll(params, PARAM.providers),
      types: readAll(params, PARAM.types, RESOURCE_TYPES) as ResourceType[],
      difficulties: readAll(params, PARAM.difficulties, DIFFICULTIES) as Difficulty[],
      costs: readAll(params, PARAM.costs, COST_TYPES) as CostType[],
      statuses: readAll(params, PARAM.statuses, STATUSES) as Status[],
      theoryVsPractice: readAll(
        params,
        PARAM.theoryVsPractice,
        THEORY_VS_PRACTICE,
      ) as TheoryVsPractice[],
      beginnerFriendly: readBoolean(params, PARAM.beginnerFriendly),
      projectBased: readBoolean(params, PARAM.projectBased),
      maxDurationMinutes: readPositiveInt(params, PARAM.maxDurationMinutes),
    },
    sort:
      sort !== null && (SORT_OPTIONS as readonly string[]).includes(sort)
        ? (sort as SortOption)
        : null,
    shown: readPositiveInt(params, PARAM.shown),
  }
}

/**
 * Serialises state back to a query string.
 *
 * Only non-default values are written, so an unfiltered library has a clean URL
 * and "clear all" genuinely returns to `/library` rather than to a URL full of
 * empty parameters.
 */
export function serializeLibraryState(state: LibraryState): URLSearchParams {
  const params = new URLSearchParams()
  const { criteria } = state

  if (criteria.query.trim().length > 0) params.set(PARAM.query, criteria.query.trim())

  const appendAll = (key: string, values: readonly string[]) => {
    // Sorted so that the same selection always produces the same URL, whatever
    // order the checkboxes were ticked in.
    for (const value of [...values].sort()) params.append(key, value)
  }

  appendAll(PARAM.topics, criteria.topics)
  appendAll(PARAM.types, criteria.types)
  appendAll(PARAM.difficulties, criteria.difficulties)
  appendAll(PARAM.costs, criteria.costs)
  appendAll(PARAM.languages, criteria.languages)
  appendAll(PARAM.providers, criteria.providers)
  appendAll(PARAM.statuses, criteria.statuses)
  appendAll(PARAM.theoryVsPractice, criteria.theoryVsPractice)

  if (criteria.beginnerFriendly !== null) {
    params.set(PARAM.beginnerFriendly, String(criteria.beginnerFriendly))
  }
  if (criteria.projectBased !== null) {
    params.set(PARAM.projectBased, String(criteria.projectBased))
  }
  if (criteria.maxDurationMinutes !== null) {
    params.set(PARAM.maxDurationMinutes, String(criteria.maxDurationMinutes))
  }

  if (state.sort !== null) params.set(PARAM.sort, state.sort)
  if (state.shown !== null) params.set(PARAM.shown, String(state.shown))

  return params
}

export { PARAM as LIBRARY_PARAMS }
