import { daysBetween } from '../content/rules.ts'
import type { AnyResource, Difficulty, Provider } from '../schema/index.ts'
import { STALE_AFTER_DAYS } from '../schema/index.ts'

/**
 * Ordering for the resource library.
 *
 * The default is a transparent, deterministic score. POPULARITY IS NOT AN INPUT
 * — no view counts, no stars, no "trending" — because those measure reach rather
 * than quality and are trivially gamed. See EDITORIAL_POLICY.md; the weights
 * below and the table in that document are the same decision written twice, and
 * a test asserts they agree.
 */

export const SORT_OPTIONS = [
  'curated',
  'relevance',
  'title',
  'duration-asc',
  'duration-desc',
  'recently-added',
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]

export const SORT_LABELS: Record<SortOption, string> = {
  curated: 'Curated',
  relevance: 'Best match',
  title: 'Title (A–Z)',
  'duration-asc': 'Shortest first',
  'duration-desc': 'Longest first',
  'recently-added': 'Recently added',
}

/** One term of the curated score, kept nameable so the UI can explain itself. */
export interface ScoreReason {
  points: number
  reason: string
}

export interface ScoreContext {
  providersById: ReadonlyMap<string, Provider>
  /** ISO date, injected so scoring is deterministic and testable. */
  today: string
  /** The learner's stated level. Null until a profile exists (Phase 5). */
  learnerLevel: Difficulty | null
}

/**
 * Breaks the curated score into its named terms.
 *
 * Returned rather than summed internally so the resource detail page can render
 * "why this ranks where it does" from the same computation that produced the
 * ordering — an explanation derived separately would eventually disagree with it.
 */
export function explainCuratedScore(resource: AnyResource, context: ScoreContext): ScoreReason[] {
  const reasons: ScoreReason[] = []

  if (resource.status === 'verified') {
    reasons.push({ points: 3, reason: 'A person has verified this link and its details' })
  }

  const provider = resource.provider_id
    ? context.providersById.get(resource.provider_id)
    : undefined
  if (provider && (provider.kind === 'official' || provider.kind === 'academic')) {
    reasons.push({
      points: 2,
      reason: `Published by ${provider.name}, ${provider.kind === 'official' ? 'an official source' : 'an academic source'}`,
    })
  }

  if (context.learnerLevel !== null && resource.difficulty === context.learnerLevel) {
    reasons.push({ points: 2, reason: `Matches your stated level (${context.learnerLevel})` })
  }

  if (resource.cost_type === 'free') {
    reasons.push({ points: 1, reason: 'Free to access' })
  }

  if (resource.learning_outcomes.length > 0) {
    reasons.push({ points: 1, reason: 'States what you will be able to do afterwards' })
  }

  if (
    resource.last_verified_at !== null &&
    daysBetween(resource.last_verified_at, context.today) <= STALE_AFTER_DAYS
  ) {
    reasons.push({ points: 1, reason: 'Verified within the last 180 days' })
  }

  if (resource.status === 'stale') {
    reasons.push({ points: -2, reason: 'Not re-checked in over 180 days' })
  }

  if (resource.status === 'broken') {
    reasons.push({ points: -5, reason: 'Link reported broken' })
  }

  return reasons
}

export function curatedScore(resource: AnyResource, context: ScoreContext): number {
  return explainCuratedScore(resource, context).reduce((total, r) => total + r.points, 0)
}

/** Ascending comparator over an optional number, with nulls always last. */
function byNullableNumber(a: number | null, b: number | null, descending = false): number {
  if (a === null && b === null) return 0
  // Unknown duration sorts last in BOTH directions: it is missing information,
  // not a very short or very long resource.
  if (a === null) return 1
  if (b === null) return -1

  return descending ? b - a : a - b
}

/**
 * Sorts a result set.
 *
 * Every comparator falls back to id, so ordering is total and stable: two
 * resources that tie must not swap places between renders, or the list appears
 * to shuffle on its own.
 *
 * `relevance` preserves the incoming order, because that order came from the
 * search index and re-sorting it would discard the ranking.
 */
export function sortResources(
  resources: readonly AnyResource[],
  sort: SortOption,
  context: ScoreContext,
): AnyResource[] {
  const items = [...resources]

  if (sort === 'relevance') return items

  const byId = (a: AnyResource, b: AnyResource) => a.id.localeCompare(b.id)

  switch (sort) {
    case 'curated': {
      // Score once per resource rather than on every comparison.
      const scores = new Map(items.map((r) => [r.id, curatedScore(r, context)]))
      return items.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || byId(a, b))
    }

    case 'title':
      return items.sort((a, b) => a.title.localeCompare(b.title) || byId(a, b))

    case 'duration-asc':
      return items.sort(
        (a, b) =>
          byNullableNumber(a.estimated_duration_minutes, b.estimated_duration_minutes) ||
          byId(a, b),
      )

    case 'duration-desc':
      return items.sort(
        (a, b) =>
          byNullableNumber(a.estimated_duration_minutes, b.estimated_duration_minutes, true) ||
          byId(a, b),
      )

    case 'recently-added':
      return items.sort((a, b) => b.added_at.localeCompare(a.added_at) || byId(a, b))
  }
}

/** The sort to use when the user has not chosen one. */
export function defaultSortFor(query: string): SortOption {
  return query.trim().length > 0 ? 'relevance' : 'curated'
}
