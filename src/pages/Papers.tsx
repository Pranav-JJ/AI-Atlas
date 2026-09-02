import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Badge, Callout, EmptyState, VerificationChip } from '@/components/index.ts'
import { resources, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { byYearDescending, isPaper, PEER_REVIEW_LABELS, PEER_REVIEW_TONES } from '@/lib/papers.ts'
import { getTopic } from '@/lib/selectors/topics.ts'

const papers = resources.filter(isPaper).sort(byYearDescending)

const reviewStatuses = [...new Set(papers.map((p) => p.peer_review_status))].sort()
const paperTopics = [...new Set(papers.flatMap((p) => p.topics))].sort()
const withVenue = papers.filter((p) => p.venue !== null).length

export function Papers() {
  const [searchParams, setSearchParams] = useSearchParams()

  useDocumentMeta(
    'Papers and research',
    'Primary sources with their prerequisites, publication status, and a clear separation between what each paper claims and how we read it.',
  )

  const selectedReview = searchParams.getAll('review')
  const selectedTopics = searchParams.getAll('topic')

  const filtered = useMemo(
    () =>
      papers.filter((paper) => {
        if (selectedReview.length > 0 && !selectedReview.includes(paper.peer_review_status)) {
          return false
        }
        if (selectedTopics.length > 0 && !selectedTopics.some((t) => paper.topics.includes(t))) {
          return false
        }
        return true
      }),
    [selectedReview, selectedTopics],
  )

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    const current = next.getAll(key)

    next.delete(key)
    for (const existing of current.filter((v) => v !== value)) next.append(key, existing)
    if (!current.includes(value)) next.append(key, value)

    setSearchParams(next)
  }

  const hasFilters = [...searchParams.keys()].length > 0

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Papers and research</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          Primary sources, each with the concepts it assumes, a paraphrase of its own abstract, and
          — kept visibly separate — our reading of what it means.
        </p>
      </div>

      <Callout
        className="mt-6 max-w-[var(--measure)]"
        title="What we do and do not assert about these"
      >
        Publication status is recorded only where the source page states a venue. Being on arXiv, or
        being widely cited, is not evidence of peer review — so{' '}
        <strong className="text-fg font-semibold">
          {papers.length - withVenue} of {papers.length}
        </strong>{' '}
        are marked as unknown rather than assumed. No benchmark results are reproduced here, because
        a number without its exact evaluation setup is not comparable to anything.
      </Callout>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="Paper filters" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="text-fg text-sm font-semibold">Filters</h2>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="text-accent text-sm underline underline-offset-2"
              >
                Clear all
              </button>
            ) : null}
          </div>

          <fieldset className="border-border border-t pt-4">
            <legend className="text-fg pr-2 text-sm font-medium">Publication status</legend>
            <div className="mt-2 space-y-1.5">
              {reviewStatuses.map((status) => (
                <label key={status} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedReview.includes(status)}
                    onChange={() => toggle('review', status)}
                    className="accent-accent h-4 w-4 shrink-0"
                  />
                  <span className="text-fg-muted">{PEER_REVIEW_LABELS[status] ?? status}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="border-border border-t pt-4">
            <legend className="text-fg pr-2 text-sm font-medium">Topic</legend>
            <div className="mt-2 space-y-1.5">
              {paperTopics.map((topicId) => (
                <label key={topicId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTopics.includes(topicId)}
                    onChange={() => toggle('topic', topicId)}
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
          <p role="status" aria-live="polite" className="text-fg-muted text-sm">
            {filtered.length} {filtered.length === 1 ? 'paper' : 'papers'}
            {hasFilters ? ' match your filters' : ', newest first'}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No papers match these filters"
              description="The paper collection is small and still growing, so most filter combinations will find nothing yet."
              action={
                <button
                  type="button"
                  onClick={() => setSearchParams(new URLSearchParams())}
                  className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
                >
                  Clear all filters
                </button>
              }
            />
          ) : (
            <ul className="mt-4 space-y-4">
              {filtered.map((paper) => {
                const prerequisites = paper.prerequisites.topics
                  .map((id) => getTopic(topics, id))
                  .filter((t): t is NonNullable<typeof t> => t !== null)

                return (
                  <li key={paper.id}>
                    <article className="border-border bg-surface hover:border-border-strong rounded-lg border p-4 transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h2 className="text-fg text-sm font-medium">
                          <Link
                            to={`/library/${paper.id}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {paper.title}
                          </Link>
                        </h2>
                        <VerificationChip
                          status={paper.status}
                          lastVerifiedAt={paper.last_verified_at}
                        />
                      </div>

                      <p className="text-fg-subtle mt-1 text-xs">
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 ? ' and others' : ''}
                        {paper.year !== null ? ` · ${paper.year}` : ''}
                        {paper.venue !== null ? ` · ${paper.venue}` : ''}
                      </p>

                      <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                        {paper.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {/* Publication status on the card, not only the detail page. */}
                        <Badge tone={PEER_REVIEW_TONES[paper.peer_review_status] ?? 'warn'}>
                          {PEER_REVIEW_LABELS[paper.peer_review_status] ?? paper.peer_review_status}
                        </Badge>
                        <Badge>{paper.difficulty}</Badge>
                      </div>

                      {prerequisites.length > 0 ? (
                        <p className="text-fg-subtle mt-3 text-xs leading-relaxed">
                          Assumes:{' '}
                          {prerequisites.map((topic, index) => (
                            <span key={topic.id}>
                              {index > 0 ? ', ' : ''}
                              <Link
                                to={`/topics/${topic.id}`}
                                className="text-accent underline underline-offset-2"
                              >
                                {topic.name}
                              </Link>
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
