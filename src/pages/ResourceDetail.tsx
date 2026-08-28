import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import {
  Badge,
  Breadcrumbs,
  Callout,
  Chip,
  ExternalLink,
  ResourceActions,
  VerificationChip,
  VERIFICATION_PRESENTATION,
} from '@/components/index.ts'
import { providers, resources, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { COST_LABELS, costTone, formatDuration, RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import type { AnyResource } from '@/lib/schema/index.ts'
import { explainCuratedScore } from '@/lib/selectors/sortResources.ts'
import { getTopic } from '@/lib/selectors/topics.ts'
import { useUserStore } from '@/lib/storage/store.ts'

import { NotFound } from './NotFound.tsx'

const providersById = new Map(providers.map((p) => [p.id, p]))
const byId = new Map(resources.map((r) => [r.id, r]))

function isPaper(resource: AnyResource): resource is AnyResource & {
  authors: string[]
  year: number | null
  venue: string | null
  peer_review_status: string
  abstract_summary: string | null
  key_idea: string | null
  code_url: string | null
} {
  return resource.resource_type === 'paper'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border flex justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-fg-subtle text-sm">{label}</dt>
      <dd className="text-fg text-right text-sm">{children}</dd>
    </div>
  )
}

export function ResourceDetail() {
  const { resourceId } = useParams<{ resourceId: string }>()
  const [searchParams] = useSearchParams()
  const resource = resourceId ? byId.get(resourceId) : undefined
  const recordView = useUserStore((s) => s.recordView)
  const learnerLevel = useUserStore((s) => s.profile.level)

  // Recents are "where was I", so only a real resource counts. Recording an
  // unknown id would fill the list with entries that render as missing.
  useEffect(() => {
    if (resource) recordView(resource.id)
  }, [resource, recordView])

  useDocumentMeta(resource ? resource.title : 'Resource not found', resource?.description)

  if (!resource) return <NotFound />

  const provider = resource.provider_id ? providersById.get(resource.provider_id) : undefined
  const duration = formatDuration(resource.estimated_duration_minutes)
  const linkable = resource.url !== null && resource.status !== 'broken'
  const presentation = VERIFICATION_PRESENTATION[resource.status]

  const from = searchParams.get('from')
  const backTo = from ? `/library?${from}` : '/library'

  const scoreReasons = explainCuratedScore(resource, {
    providersById,
    today: new Date().toISOString().slice(0, 10),
    // Now that a profile can exist, level matching becomes a real scoring term.
    learnerLevel,
  })
  const totalScore = scoreReasons.reduce((sum, r) => sum + r.points, 0)

  const relatedTopics = resource.topics
    .map((id) => getTopic(topics, id))
    .filter((t): t is NonNullable<typeof t> => t !== null)

  // Other resources sharing a topic, excluding this one.
  const related = resources
    .filter(
      (other) =>
        other.id !== resource.id &&
        other.status !== 'broken' &&
        other.topics.some((t) => resource.topics.includes(t)),
    )
    .slice(0, 4)

  return (
    <>
      <Breadcrumbs items={[{ label: 'Library', to: backTo }, { label: resource.title }]} />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="max-w-[var(--measure)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
            <VerificationChip status={resource.status} lastVerifiedAt={resource.last_verified_at} />
            <div className="ml-auto">
              <ResourceActions resourceId={resource.id} variant="full" title={resource.title} />
            </div>
          </div>

          <h1 className="text-fg mt-3 text-3xl font-semibold tracking-tight">{resource.title}</h1>

          {provider || resource.author ? (
            <p className="text-fg-muted mt-2 text-sm">
              {[provider?.name, resource.author].filter(Boolean).join(' · ')}
              {provider && provider.kind === 'community' ? (
                <span className="text-fg-subtle"> · community-created</span>
              ) : null}
            </p>
          ) : null}

          <p className="text-fg-muted mt-5 leading-relaxed">{resource.description}</p>

          {/* The verification banner is never omitted. A reader must be able to
              tell a checked record from an unchecked one without hunting. */}
          {resource.status !== 'verified' ? (
            <Callout
              tone={resource.status === 'broken' ? 'danger' : 'warn'}
              className="mt-6"
              title={presentation.label}
            >
              {presentation.explanation}
              {resource.status === 'unverified' ? (
                <>
                  {' '}
                  The link below was checked automatically for a response, which is not the same as
                  a person confirming the page still matches this description.
                </>
              ) : null}
            </Callout>
          ) : null}

          <div className="mt-6">
            {linkable ? (
              <ExternalLink
                href={resource.url!}
                className="bg-accent text-accent-fg hover:bg-accent-hover !no-underline inline-flex rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                Open at {provider?.name ?? 'the source'}
              </ExternalLink>
            ) : (
              /* No fake button. There is nothing to open. */
              <p className="text-warn border-warn/40 bg-warn-subtle rounded-lg border p-3 text-sm">
                {resource.url === null
                  ? 'No link has been recorded for this entry yet, so there is nothing to open.'
                  : 'This link was reported broken and has been disabled.'}
              </p>
            )}
          </div>

          <section className="mt-10" aria-labelledby="why">
            <h2 id="why" className="text-fg text-sm font-semibold">
              Why this is here
            </h2>
            <p className="text-fg-muted mt-2 leading-relaxed">{resource.why_useful}</p>
            <p className="text-fg-subtle mt-2 text-xs">
              This is our editorial opinion, not a claim made by the source.
            </p>
          </section>

          {resource.learning_outcomes.length > 0 ? (
            <section className="mt-8" aria-labelledby="outcomes">
              <h2 id="outcomes" className="text-fg text-sm font-semibold">
                What you should be able to do afterwards
              </h2>
              <ul className="text-fg-muted mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {resource.learning_outcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {resource.quality_notes ? (
            <section className="mt-8" aria-labelledby="caveats">
              <h2 id="caveats" className="text-fg text-sm font-semibold">
                Caveats
              </h2>
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">{resource.quality_notes}</p>
            </section>
          ) : null}

          {isPaper(resource) ? (
            <section className="mt-8" aria-labelledby="paper">
              <h2 id="paper" className="text-fg text-sm font-semibold">
                Paper details
              </h2>
              <dl className="mt-2">
                {resource.authors.length > 0 ? (
                  <Field label="Authors">{resource.authors.join(', ')}</Field>
                ) : null}
                {resource.year !== null ? <Field label="Year">{resource.year}</Field> : null}
                <Field label="Venue">{resource.venue ?? 'Not recorded'}</Field>
                {/* Never omitted, and never guessed. An arXiv id is not evidence
                    of peer review. */}
                <Field label="Peer review">
                  {resource.peer_review_status === 'unknown'
                    ? 'Unknown — we have not confirmed this'
                    : resource.peer_review_status}
                </Field>
              </dl>
            </section>
          ) : null}

          {relatedTopics.length > 0 ? (
            <section className="mt-8" aria-labelledby="topics">
              <h2 id="topics" className="text-fg text-sm font-semibold">
                Topics
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {relatedTopics.map((topic) => (
                  <li key={topic.id}>
                    <Chip to={`/topics/${topic.id}`}>{topic.name}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section className="mt-10" aria-labelledby="related">
              <h2 id="related" className="text-fg text-sm font-semibold">
                Related resources
              </h2>
              <ul className="mt-3 space-y-2">
                {related.map((other) => (
                  <li key={other.id}>
                    <Link
                      to={`/library/${other.id}`}
                      className="text-accent text-sm underline underline-offset-2"
                    >
                      {other.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="border-border bg-surface rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">At a glance</h2>
            <dl className="mt-2">
              <Field label="Difficulty">{resource.difficulty}</Field>
              <Field label="Cost">
                <Badge tone={costTone(resource.cost_type)}>{COST_LABELS[resource.cost_type]}</Badge>
              </Field>
              <Field label="Length">{duration ?? 'Not recorded'}</Field>
              <Field label="Format">{resource.format}</Field>
              <Field label="Style">{resource.theory_vs_practice}</Field>
              <Field label="Language">{resource.language}</Field>
              <Field label="Added">{resource.added_at}</Field>
              <Field label="Last verified">{resource.last_verified_at ?? 'Never'}</Field>
            </dl>
          </div>

          {/* Rendered from the same computation that produced the ordering, so
              the explanation cannot drift from the ranking it explains. */}
          <div className="border-border bg-surface mt-4 rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">Why this ranks where it does</h2>

            {scoreReasons.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {scoreReasons.map((reason) => (
                  <li key={reason.reason} className="flex gap-2 text-sm">
                    <span
                      className={`font-mono tabular-nums ${reason.points > 0 ? 'text-ok' : 'text-danger'}`}
                    >
                      {reason.points > 0 ? `+${reason.points}` : reason.points}
                    </span>
                    <span className="text-fg-muted">{reason.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-fg-muted mt-2 text-sm">
                This entry earns no ranking points yet — it is unverified, and carries no signals
                the score rewards.
              </p>
            )}

            <p className="text-fg border-border mt-3 border-t pt-3 text-sm font-medium">
              Curated score: <span className="font-mono tabular-nums">{totalScore}</span>
            </p>
            <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
              Popularity is never an input.{' '}
              <Link to="/about" className="underline underline-offset-2">
                How ranking works
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
