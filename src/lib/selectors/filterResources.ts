import type {
  AnyResource,
  CostType,
  Difficulty,
  ResourceType,
  Status,
  TheoryVsPractice,
} from '../schema/index.ts'

/**
 * The library's filter model.
 *
 * Semantics, applied consistently across every facet:
 *   - WITHIN a facet, values are OR-ed   (type: video OR course)
 *   - ACROSS facets, they are AND-ed     (type video AND difficulty beginner)
 *
 * That is what people expect from faceted search, and it is the only combination
 * where adding a value inside a facet can never shrink the result set.
 */
export interface FilterCriteria {
  /** Free-text query. Applied by the search index, not here — see runSearch. */
  query: string
  topics: string[]
  types: ResourceType[]
  difficulties: Difficulty[]
  costs: CostType[]
  languages: string[]
  providers: string[]
  /** Verification state. Empty means "the default set", which excludes broken. */
  statuses: Status[]
  theoryVsPractice: TheoryVsPractice[]
  beginnerFriendly: boolean | null
  projectBased: boolean | null
  /** Upper bound in minutes, inclusive. */
  maxDurationMinutes: number | null
}

export const EMPTY_CRITERIA: FilterCriteria = {
  query: '',
  topics: [],
  types: [],
  difficulties: [],
  costs: [],
  languages: [],
  providers: [],
  statuses: [],
  theoryVsPractice: [],
  beginnerFriendly: null,
  projectBased: null,
  maxDurationMinutes: null,
}

/** Facets a user can narrow by, for reporting which ones caused an empty result. */
export const FACET_KEYS = [
  'topics',
  'types',
  'difficulties',
  'costs',
  'languages',
  'providers',
  'statuses',
  'theoryVsPractice',
  'beginnerFriendly',
  'projectBased',
  'maxDurationMinutes',
] as const

export type FacetKey = (typeof FACET_KEYS)[number]

/** Human labels, used in the empty state and the active-filter summary. */
export const FACET_LABELS: Record<FacetKey, string> = {
  topics: 'Topic',
  types: 'Type',
  difficulties: 'Difficulty',
  costs: 'Cost',
  languages: 'Language',
  providers: 'Provider',
  statuses: 'Verification',
  theoryVsPractice: 'Theory vs practice',
  beginnerFriendly: 'Beginner-friendly',
  projectBased: 'Project-based',
  maxDurationMinutes: 'Duration',
}

/** True when the user has narrowed by this facet at all. */
export function isFacetActive(criteria: FilterCriteria, key: FacetKey): boolean {
  const value = criteria[key]

  if (Array.isArray(value)) return value.length > 0
  return value !== null
}

export function activeFacets(criteria: FilterCriteria): FacetKey[] {
  return FACET_KEYS.filter((key) => isFacetActive(criteria, key))
}

export function hasAnyFilter(criteria: FilterCriteria): boolean {
  return criteria.query.trim().length > 0 || activeFacets(criteria).length > 0
}

/**
 * Whether one resource passes one facet.
 *
 * Split out so the empty-state can ask "which single facet is responsible for
 * excluding everything?" without duplicating any of the matching rules.
 */
export function matchesFacet(
  resource: AnyResource,
  criteria: FilterCriteria,
  key: FacetKey,
): boolean {
  switch (key) {
    case 'topics':
      return (
        criteria.topics.length === 0 ||
        criteria.topics.some((t) => resource.topics.includes(t) || resource.subtopics.includes(t))
      )

    case 'types':
      return criteria.types.length === 0 || criteria.types.includes(resource.resource_type)

    case 'difficulties':
      return (
        criteria.difficulties.length === 0 || criteria.difficulties.includes(resource.difficulty)
      )

    case 'costs':
      return criteria.costs.length === 0 || criteria.costs.includes(resource.cost_type)

    case 'languages':
      return criteria.languages.length === 0 || criteria.languages.includes(resource.language)

    case 'providers':
      return (
        criteria.providers.length === 0 ||
        (resource.provider_id !== null && criteria.providers.includes(resource.provider_id))
      )

    case 'statuses':
      // Broken records are excluded from DEFAULT results, per the editorial
      // policy, but remain findable when explicitly asked for — a maintainer
      // needs to be able to list them.
      if (criteria.statuses.length === 0) return resource.status !== 'broken'
      return criteria.statuses.includes(resource.status)

    case 'theoryVsPractice':
      return (
        criteria.theoryVsPractice.length === 0 ||
        criteria.theoryVsPractice.includes(resource.theory_vs_practice)
      )

    case 'beginnerFriendly':
      return (
        criteria.beginnerFriendly === null ||
        resource.is_beginner_friendly === criteria.beginnerFriendly
      )

    case 'projectBased':
      return criteria.projectBased === null || resource.is_project_based === criteria.projectBased

    case 'maxDurationMinutes': {
      if (criteria.maxDurationMinutes === null) return true

      // A resource with no recorded duration is EXCLUDED when a limit is set.
      // Including it would silently assert "this fits in 60 minutes" about
      // something whose length nobody has established.
      if (resource.estimated_duration_minutes === null) return false

      return resource.estimated_duration_minutes <= criteria.maxDurationMinutes
    }
  }
}

/** Applies every facet. Text search is applied separately, before this. */
export function filterResources(
  resources: readonly AnyResource[],
  criteria: FilterCriteria,
): AnyResource[] {
  return resources.filter((resource) =>
    FACET_KEYS.every((key) => matchesFacet(resource, criteria, key)),
  )
}

/**
 * Which active facets are, on their own, excluding everything.
 *
 * Powers an empty state that says WHICH filter to loosen rather than only that
 * nothing matched. A facet is "responsible" when removing it alone would
 * produce results.
 */
export function facetsResponsibleForEmptyResult(
  resources: readonly AnyResource[],
  criteria: FilterCriteria,
): FacetKey[] {
  const active = activeFacets(criteria)

  return active.filter((candidate) => {
    const others = active.filter((key) => key !== candidate)
    const survivors = resources.filter((resource) =>
      others.every((key) => matchesFacet(resource, criteria, key)),
    )
    return survivors.length > 0
  })
}
