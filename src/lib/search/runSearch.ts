import MiniSearch from 'minisearch'

import { miniSearchOptions, SEARCH_QUERY_OPTIONS, type SearchDocument } from './config.ts'

/**
 * Runtime side of search.
 *
 * The index is built at build time (scripts/build-content.ts) and only
 * deserialised here. It is loaded through a dynamic import so it becomes its own
 * chunk, fetched the first time someone opens the library rather than on every
 * page load.
 */

export type SearchIndex = MiniSearch<SearchDocument>

let indexPromise: Promise<SearchIndex> | null = null

/**
 * Loads and deserialises the prebuilt index, once per session.
 *
 * The promise is cached rather than the resolved value, so two components
 * mounting at the same time share one load instead of racing.
 */
export function loadSearchIndex(): Promise<SearchIndex> {
  indexPromise ??= import('../../content/generated/search-index.ts').then(
    ({ serializedSearchIndex }) =>
      // Must be loaded with the SAME options it was built with, or MiniSearch
      // silently returns nothing instead of failing.
      MiniSearch.loadJSON<SearchDocument>(serializedSearchIndex, miniSearchOptions()),
  )

  return indexPromise
}

/** Test seam: forget the cached index so a test can control loading. */
export function resetSearchIndexForTests(): void {
  indexPromise = null
}

/**
 * Returns matching resource ids, most relevant first.
 *
 * Ids rather than records: relevance ranking and facet filtering stay
 * independent, so each can be tested and changed without the other.
 */
export function runSearch(index: SearchIndex, query: string): string[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) return []

  return index.search(trimmed, { ...SEARCH_QUERY_OPTIONS }).map((result) => String(result.id))
}

/**
 * Reorders resources to match search ranking, dropping anything not matched.
 *
 * Applied BEFORE the facet filters: text relevance decides what is relevant,
 * facets decide what is admissible, and neither needs to know about the other.
 */
export function applySearchOrder<T extends { id: string }>(
  resources: readonly T[],
  rankedIds: readonly string[],
): T[] {
  const byId = new Map(resources.map((r) => [r.id, r]))

  return rankedIds
    .map((id) => byId.get(id))
    .filter((resource): resource is T => resource !== undefined)
}
