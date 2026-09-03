import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Chip, EmptyState } from '@/components/index.ts'
import { glossary, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { getTopic } from '@/lib/selectors/topics.ts'

const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term))
const glossaryTopics = [...new Set(sorted.flatMap((t) => t.topics))].sort()

/** Matches the term, its aliases, or its plain definition. */
function matches(entry: (typeof sorted)[number], query: string): boolean {
  if (query.length === 0) return true

  const haystack = [entry.term, ...entry.aliases, entry.plain_definition].join(' ').toLowerCase()
  return haystack.includes(query)
}

export function Glossary() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')

  useDocumentMeta(
    'Glossary',
    'Plain-language definitions of the terms that come up constantly in AI and machine learning, each with the misconception people usually arrive with.',
  )

  const selectedTopics = searchParams.getAll('topic')
  const normalisedQuery = query.trim().toLowerCase()

  const filtered = useMemo(
    () =>
      sorted.filter(
        (entry) =>
          matches(entry, normalisedQuery) &&
          (selectedTopics.length === 0 || selectedTopics.some((t) => entry.topics.includes(t))),
      ),
    [normalisedQuery, selectedTopics],
  )

  function toggleTopic(value: string) {
    const next = new URLSearchParams(searchParams)
    const current = next.getAll('topic')

    next.delete('topic')
    for (const existing of current.filter((v) => v !== value)) next.append('topic', existing)
    if (!current.includes(value)) next.append('topic', value)

    setSearchParams(next)
  }

  const hasFilters = selectedTopics.length > 0 || normalisedQuery.length > 0

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Glossary</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          {sorted.length} terms that come up constantly and are rarely defined. Every entry leads
          with a plain-language definition, and says what people usually get wrong about it — the
          technical detail is one click away rather than in your way.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Glossary filters" className="lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="text-fg text-sm font-semibold">Filter by topic</h2>
            {selectedTopics.length > 0 ? (
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="text-accent text-sm underline underline-offset-2"
              >
                Clear
              </button>
            ) : null}
          </div>

          <fieldset className="border-border mt-3 border-t pt-4">
            <legend className="sr-only">Topic</legend>
            <div className="space-y-1.5">
              {glossaryTopics.map((topicId) => (
                <label key={topicId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTopics.includes(topicId)}
                    onChange={() => toggleTopic(topicId)}
                    className="accent-accent h-4 w-4 shrink-0"
                  />
                  <span className="text-fg-muted">
                    {getTopic(topics, topicId)?.name ?? topicId}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </aside>

        <div>
          <div>
            <label htmlFor="glossary-search" className="text-fg mb-1.5 block text-sm font-medium">
              Find a term
            </label>
            <input
              id="glossary-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “recall”, “drift”, “leakage”"
              className="border-border-interactive bg-surface text-fg placeholder:text-fg-subtle w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="text-fg-subtle mt-1 text-xs">
              {/* 19 terms need no search index; a substring match is enough. */}
              Searches the term, its other names, and the plain definition.
            </p>
          </div>

          <p role="status" aria-live="polite" className="text-fg-muted mt-4 text-sm">
            {filtered.length} {filtered.length === 1 ? 'term' : 'terms'}
            {hasFilters ? ' match' : ''}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No terms match"
              description="The glossary is small and still growing. If a term you expected is missing, it has not been written yet rather than been judged unimportant."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSearchParams(new URLSearchParams())
                  }}
                  className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
                >
                  Clear search and filters
                </button>
              }
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((entry) => (
                <li key={entry.id}>
                  <article className="border-border bg-surface hover:border-border-strong rounded-lg border p-4 transition-colors">
                    <h2 className="text-fg text-sm font-medium">
                      <Link
                        to={`/glossary/${entry.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {entry.term}
                      </Link>
                    </h2>

                    {entry.aliases.length > 0 ? (
                      <p className="text-fg-subtle mt-0.5 text-xs">
                        Also called {entry.aliases.join(', ')}
                      </p>
                    ) : null}

                    {/* The plain definition is always visible, on every surface. */}
                    <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                      {entry.plain_definition}
                    </p>

                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {entry.topics.map((topicId) => (
                        <li key={topicId}>
                          <Chip>{getTopic(topics, topicId)?.name ?? topicId}</Chip>
                        </li>
                      ))}
                    </ul>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
