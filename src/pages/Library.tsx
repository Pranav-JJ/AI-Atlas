import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Callout, EmptyState, ResourceCardItem, Skeleton } from '@/components/index.ts'
import { providers, resources, topics } from '@/content/generated/index.ts'
import { FilterRail } from '@/features/library/FilterRail.tsx'
import { SearchInput } from '@/features/library/SearchInput.tsx'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { parseLibraryState, serializeLibraryState } from '@/lib/library/urlState.ts'
import { useUserStore } from '@/lib/storage/store.ts'
import { loadSearchIndex, applySearchOrder, runSearch } from '@/lib/search/runSearch.ts'
import type { SearchIndex } from '@/lib/search/runSearch.ts'
import {
  activeFacets,
  facetsResponsibleForEmptyResult,
  FACET_LABELS,
  filterResources,
  hasAnyFilter,
  type FilterCriteria,
} from '@/lib/selectors/filterResources.ts'
import {
  defaultSortFor,
  SORT_LABELS,
  SORT_OPTIONS,
  sortResources,
  type SortOption,
} from '@/lib/selectors/sortResources.ts'

const PAGE_SIZE = 24

const providersById = new Map(providers.map((p) => [p.id, p]))

/** Facet counts over the WHOLE catalogue, so a filter never reads as "0" for
 *  something that exists — counts describe the catalogue, not the current view. */
const topicCounts = new Map<string, number>()
const typeCounts = new Map<string, number>()

for (const resource of resources) {
  for (const id of new Set([...resource.topics, ...resource.subtopics])) {
    topicCounts.set(id, (topicCounts.get(id) ?? 0) + 1)
  }
  typeCounts.set(resource.resource_type, (typeCounts.get(resource.resource_type) ?? 0) + 1)
}

const languages = [...new Set(resources.map((r) => r.language))].sort()
const providersWithResources = providers.filter((p) =>
  resources.some((r) => r.provider_id === p.id),
)

export function Library() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseLibraryState(searchParams), [searchParams])
  const { criteria } = state

  const sort: SortOption = state.sort ?? defaultSortFor(criteria.query)
  const shown = state.shown ?? PAGE_SIZE
  const learnerLevel = useUserStore((s) => s.profile.level)

  useDocumentMeta(
    'Resource library',
    'Search and filter the AI Atlas catalogue by topic, type, difficulty, cost, duration and verification status.',
  )

  /* ---- search index: lazily loaded, only when a query is actually typed ---- */

  const [index, setIndex] = useState<SearchIndex | null>(null)
  const needsIndex = criteria.query.trim().length > 0

  useEffect(() => {
    if (!needsIndex || index !== null) return

    let cancelled = false

    void loadSearchIndex().then((loaded) => {
      if (!cancelled) setIndex(loaded)
    })

    return () => {
      cancelled = true
    }
  }, [needsIndex, index])

  /* ---- results: search first, then facets, then sort ---- */

  const results = useMemo(() => {
    // Text relevance decides what is relevant; facets decide what is
    // admissible. Keeping them in this order means neither needs to know
    // about the other.
    const searched =
      needsIndex && index
        ? applySearchOrder(resources, runSearch(index, criteria.query))
        : [...resources]

    return sortResources(filterResources(searched, criteria), sort, {
      providersById,
      today: new Date().toISOString().slice(0, 10),
      learnerLevel,
    })
  }, [criteria, sort, index, needsIndex, learnerLevel])

  const visible = results.slice(0, shown)
  const awaitingIndex = needsIndex && index === null

  /* ---- URL is the single source of truth for all of the above ---- */

  const update = useCallback(
    (changes: Partial<FilterCriteria>, options: { resetShown?: boolean } = {}) => {
      const next = serializeLibraryState({
        criteria: { ...criteria, ...changes },
        sort: state.sort,
        // Narrowing the results should return to the top of the list rather
        // than leaving the user deep in a page that no longer exists.
        shown: options.resetShown === false ? state.shown : null,
      })
      setSearchParams(next)
    },
    [criteria, state.sort, state.shown, setSearchParams],
  )

  const setQuery = useCallback((query: string) => update({ query }), [update])

  const clearAll = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams])

  function setSort(nextSort: SortOption) {
    setSearchParams(serializeLibraryState({ criteria, sort: nextSort, shown: null }))
  }

  function showMore() {
    setSearchParams(serializeLibraryState({ criteria, sort: state.sort, shown: shown + PAGE_SIZE }))
  }

  const active = activeFacets(criteria)
  const culprits = results.length === 0 ? facetsResponsibleForEmptyResult(resources, criteria) : []

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Resource library</h1>
        <p className="text-fg-muted mt-3 leading-relaxed">
          {resources.length} curated resources. Every entry says who made it, why it earns your
          time, and whether anyone has checked it.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Filters" className="lg:sticky lg:top-20 lg:self-start">
          <FilterRail
            criteria={criteria}
            options={{
              topics,
              providers: providersWithResources,
              languages,
              counts: { topics: topicCounts, types: typeCounts },
            }}
            onChange={update}
            onClear={clearAll}
            activeCount={active.length}
          />
        </aside>

        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SearchInput value={criteria.query} onChange={setQuery} />
            </div>

            <div>
              <label htmlFor="sort" className="text-fg mb-1.5 block text-sm font-medium">
                Sort by
              </label>
              {/* A native select: accessible for free, and zero extra JavaScript. */}
              <select
                id="sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
                className="border-border-interactive bg-surface text-fg rounded-lg border px-3 py-2 text-sm"
              >
                {SORT_OPTIONS.filter(
                  // "Best match" only means something when there is a query.
                  (option) => option !== 'relevance' || criteria.query.trim().length > 0,
                ).map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Announced politely so a screen reader user learns the result count
              changed without losing their place. */}
          <p aria-live="polite" role="status" className="text-fg-muted mt-4 text-sm">
            {awaitingIndex
              ? 'Searching…'
              : `${results.length} ${results.length === 1 ? 'resource' : 'resources'}${
                  hasAnyFilter(criteria) ? ' match your filters' : ''
                }`}
          </p>

          {sort === 'curated' && !needsIndex ? (
            <p className="text-fg-subtle mt-1 text-xs">
              Ordered by a published, deterministic score. Popularity is never an input.
            </p>
          ) : null}

          {awaitingIndex ? (
            <ul className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  {/* Only the first skeleton is announced, so a screen reader
                      hears "loading" once rather than six times. */}
                  {i === 0 ? (
                    <Skeleton className="h-40 w-full" label="Loading the search index" />
                  ) : (
                    <Skeleton className="h-40 w-full" />
                  )}
                </li>
              ))}
            </ul>
          ) : results.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="No resources match these filters"
              description={
                <>
                  {culprits.length > 0 ? (
                    <>
                      Loosening{' '}
                      <strong className="text-fg font-semibold">
                        {culprits.map((key) => FACET_LABELS[key]).join(' or ')}
                      </strong>{' '}
                      would bring results back.
                    </>
                  ) : (
                    <>
                      Nothing in the catalogue matches this combination. The catalogue is curated
                      and still growing, so a gap means nobody has added something good yet.
                    </>
                  )}
                </>
              }
              action={
                hasAnyFilter(criteria) ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Clear all filters
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              <ul className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {visible.map((resource) => (
                  <ResourceCardItem
                    key={resource.id}
                    resource={resource}
                    provider={
                      resource.provider_id ? providersById.get(resource.provider_id) : undefined
                    }
                    backTo={searchParams.toString()}
                  />
                ))}
              </ul>

              {visible.length < results.length ? (
                <div className="mt-8 flex flex-col items-center gap-2">
                  {/* A real button, not scroll-triggered loading: infinite scroll
                      traps keyboard users above the footer and makes the page
                      length unpredictable. */}
                  <button
                    type="button"
                    onClick={showMore}
                    className="border-border-interactive text-fg hover:bg-surface-subtle rounded border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Show {Math.min(PAGE_SIZE, results.length - visible.length)} more
                  </button>
                  <p className="text-fg-subtle text-xs">
                    Showing {visible.length} of {results.length}
                  </p>
                </div>
              ) : null}
            </>
          )}

          {criteria.statuses.includes('broken') ? (
            <Callout tone="warn" className="mt-8" title="Showing broken links">
              These links were reported dead and are normally hidden. They are listed here for
              maintenance; their links are disabled.
            </Callout>
          ) : null}
        </div>
      </div>
    </>
  )
}
