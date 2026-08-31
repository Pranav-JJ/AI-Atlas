import { useMemo } from 'react'
import { Link } from 'react-router'

import { Badge, Callout, ResourceCardItem, VerificationChip } from '@/components/index.ts'
import {
  contentManifest,
  learningPaths,
  providers,
  resources,
  topics,
} from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { COST_LABELS, costTone, formatDuration, RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import type { AnyResource } from '@/lib/schema/index.ts'
import {
  recommendNext,
  suggestMore,
  type RecommendationContext,
} from '@/lib/selectors/recommendNext.ts'
import { DOMAIN_LABELS, DOMAIN_ORDER } from '@/lib/selectors/topics.ts'
import { GOAL_LABELS } from '@/lib/storage/schema.ts'
import { useUserStore } from '@/lib/storage/store.ts'

const ONBOARDING_NOTICE = 'onboarding-prompt'

const providersById = new Map(providers.map((p) => [p.id, p]))
const resourcesById = new Map(resources.map((r) => [r.id, r]))
const topicDomain = new Map(topics.map((t) => [t.id, t.domain]))

/** How many catalogue resources sit in each domain, for context on counts. */
const catalogueByDomain = new Map<string, number>()
for (const resource of resources) {
  const domains = new Set(
    [...resource.topics, ...resource.subtopics]
      .map((id) => topicDomain.get(id))
      .filter((d): d is NonNullable<typeof d> => d !== undefined),
  )
  for (const domain of domains) {
    catalogueByDomain.set(domain, (catalogueByDomain.get(domain) ?? 0) + 1)
  }
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <section className="mt-10" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-fg text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A compact row used by the saved and recently-viewed lists. */
function CompactRow({ resource }: { resource: AnyResource }) {
  const duration = formatDuration(resource.estimated_duration_minutes)

  return (
    <li className="border-border bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3">
      <Link
        to={`/library/${resource.id}`}
        className="text-fg hover:text-accent text-sm font-medium underline-offset-2 hover:underline"
      >
        {resource.title}
      </Link>
      <Badge>{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
      {duration ? <span className="text-fg-subtle text-xs">{duration}</span> : null}
      <div className="ml-auto">
        <VerificationChip status={resource.status} lastVerifiedAt={resource.last_verified_at} />
      </div>
    </li>
  )
}

export function Dashboard() {
  useDocumentMeta(
    'AI Atlas',
    'A curated, provenance-tracked learning atlas for AI, machine learning, deep learning, generative AI and NLP.',
  )

  const profile = useUserStore((s) => s.profile)
  const bookmarks = useUserStore((s) => s.bookmarks)
  const completions = useUserStore((s) => s.completions)
  const checkpointCompletions = useUserStore((s) => s.checkpointCompletions)
  const recentlyViewed = useUserStore((s) => s.recentlyViewed)
  const dismissed = useUserStore((s) => s.dismissedNotices.includes(ONBOARDING_NOTICE))
  const dismissNotice = useUserStore((s) => s.dismissNotice)

  const hasProfile = profile.level !== null || profile.goal !== null
  const savedIds = Object.keys(bookmarks)
  const doneIds = Object.keys(completions)

  /**
   * A first visit is the absence of ANY signal, not just a missing profile.
   * Someone who has saved things but skipped onboarding is not a new arrival.
   */
  const isFirstVisit =
    !hasProfile && savedIds.length === 0 && doneIds.length === 0 && recentlyViewed.length === 0

  const context = useMemo<RecommendationContext>(
    () => ({
      resources,
      paths: learningPaths,
      completions,
      checkpointCompletions,
      profile: { level: profile.level, goal: profile.goal },
      providersById,
      today: new Date().toISOString().slice(0, 10),
    }),
    [completions, checkpointCompletions, profile.level, profile.goal],
  )

  const recommendation = useMemo(() => recommendNext(context), [context])

  const recommendedId =
    recommendation.kind === 'path-item' || recommendation.kind === 'resource'
      ? recommendation.resource.id
      : undefined

  /** Most recently opened thing not yet finished — "where was I". */
  const continueWith = recentlyViewed
    .map((entry) => resourcesById.get(entry.resourceId))
    .find(
      (resource): resource is AnyResource =>
        resource !== undefined &&
        completions[resource.id] === undefined &&
        resource.id !== recommendedId,
    )

  const suggestedVideos = useMemo(
    () =>
      suggestMore(context, {
        type: 'video',
        limit: 2,
        excludeIds: [recommendedId, continueWith?.id].filter(
          (id): id is string => id !== undefined,
        ),
      }),
    [context, recommendedId, continueWith],
  )

  const savedResources = savedIds
    .map((id) => resourcesById.get(id))
    .filter((r): r is AnyResource => r !== undefined)
    .slice(0, 4)

  const recentResources = recentlyViewed
    .map((entry) => resourcesById.get(entry.resourceId))
    .filter((r): r is AnyResource => r !== undefined)
    .slice(0, 4)

  /** Completions per domain. A COUNT, never a percentage — see EDITORIAL_POLICY. */
  const coverage = DOMAIN_ORDER.map((domain) => {
    const completed = doneIds.filter((id) => {
      const resource = resourcesById.get(id)
      if (!resource) return false
      return [...resource.topics, ...resource.subtopics].some(
        (topicId) => topicDomain.get(topicId) === domain,
      )
    }).length

    return { domain, completed, inCatalogue: catalogueByDomain.get(domain) ?? 0 }
  }).filter((row) => row.inCatalogue > 0)

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">
          {isFirstVisit ? 'AI Atlas' : 'Welcome back'}
        </h1>

        {isFirstVisit ? (
          <p className="text-fg-muted mt-4 text-lg leading-relaxed">
            A curated, provenance-tracked learning atlas for AI, machine learning, deep learning,
            generative AI and NLP. Every resource says who made it, why it earns your time, and
            whether anyone has actually checked it.
          </p>
        ) : (
          <p className="text-fg-muted mt-3 leading-relaxed">
            {profile.level ? (
              <>
                Level <span className="text-fg capitalize">{profile.level}</span>.{' '}
              </>
            ) : null}
            {profile.goal ? (
              <>
                Goal <span className="text-fg">{GOAL_LABELS[profile.goal]}</span>.{' '}
              </>
            ) : null}
            {savedIds.length} saved, {doneIds.length} marked done.{' '}
            <Link to="/progress" className="text-accent underline underline-offset-2">
              See everything
            </Link>
          </p>
        )}
      </div>

      {/* First visit gets ONE card and no zeroed widgets. Empty tiles reading
          "0 saved, 0 done, 0%" tell a new arrival nothing and look broken. */}
      {isFirstVisit || (!hasProfile && !dismissed) ? (
        <section
          className="border-border bg-surface mt-8 max-w-[var(--measure)] rounded-lg border p-5"
          aria-labelledby="get-started"
        >
          <h2 id="get-started" className="text-fg text-base font-semibold">
            Tell the atlas where you are starting
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            Two optional questions. They tune what gets recommended and how resources are ordered.
            Everything stays in this browser, and nothing on the site is locked behind them.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              to="/onboarding"
              className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              Set your starting point
            </Link>
            <Link to="/library" className="text-fg-muted text-sm underline underline-offset-2">
              Or just browse the library
            </Link>
            {!isFirstVisit ? (
              <button
                type="button"
                onClick={() => dismissNotice(ONBOARDING_NOTICE)}
                className="text-fg-subtle text-sm underline underline-offset-2"
              >
                Not now
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <Section title="Start here">
        {recommendation.kind === 'nothing' ? (
          <p className="text-fg-muted mt-3 text-sm leading-relaxed">{recommendation.reason}</p>
        ) : recommendation.kind === 'next-path' ? (
          <div className="border-accent/40 bg-accent-subtle mt-3 rounded-lg border p-5">
            <p className="text-fg-muted text-xs">{recommendation.reason}</p>
            <h3 className="text-fg mt-1 text-base font-semibold">{recommendation.path.title}</h3>
          </div>
        ) : (
          <article className="border-accent/40 bg-accent-subtle mt-3 rounded-lg border p-5">
            {/* The basis for the suggestion is always shown, never implied. */}
            <p className="text-fg-muted text-xs">{recommendation.reason}</p>

            <h3 className="text-fg mt-1 text-base font-semibold">
              <Link
                to={`/library/${recommendation.resource.id}`}
                className="underline-offset-2 hover:underline"
              >
                {recommendation.resource.title}
              </Link>
            </h3>

            <p className="text-fg-muted mt-2 text-sm leading-relaxed">
              {recommendation.resource.why_useful}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge>{RESOURCE_TYPE_LABELS[recommendation.resource.resource_type]}</Badge>
              <Badge>{recommendation.resource.difficulty}</Badge>
              <Badge tone={costTone(recommendation.resource.cost_type)}>
                {COST_LABELS[recommendation.resource.cost_type]}
              </Badge>
              {formatDuration(recommendation.resource.estimated_duration_minutes) ? (
                <span className="text-fg-subtle text-xs">
                  {formatDuration(recommendation.resource.estimated_duration_minutes)}
                </span>
              ) : null}
              <VerificationChip
                status={recommendation.resource.status}
                lastVerifiedAt={recommendation.resource.last_verified_at}
              />
            </div>
          </article>
        )}
      </Section>

      {continueWith ? (
        <Section title="Pick up where you left off">
          <ul className="mt-3 space-y-2">
            <CompactRow resource={continueWith} />
          </ul>
        </Section>
      ) : null}

      {savedResources.length > 0 ? (
        <Section
          title="Saved"
          action={
            <Link to="/progress" className="text-accent text-sm underline underline-offset-2">
              All {savedIds.length}
            </Link>
          }
        >
          <ul className="mt-3 space-y-2">
            {savedResources.map((resource) => (
              <CompactRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </Section>
      ) : null}

      {suggestedVideos.length > 0 ? (
        <Section
          title="Videos you might try"
          action={
            <Link
              to="/library?type=video"
              className="text-accent text-sm underline underline-offset-2"
            >
              All videos
            </Link>
          }
        >
          <ul className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {suggestedVideos.map((resource) => (
              <ResourceCardItem
                key={resource.id}
                resource={resource}
                provider={
                  resource.provider_id ? providersById.get(resource.provider_id) : undefined
                }
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {recentResources.length > 0 ? (
        <Section title="Recently viewed">
          <ul className="mt-3 space-y-2">
            {recentResources.map((resource) => (
              <CompactRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </Section>
      ) : null}

      {doneIds.length > 0 ? (
        <Section title="What you have covered">
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {coverage.map((row) => (
              <li key={row.domain} className="border-border bg-surface rounded-lg border p-4">
                <span className="text-fg-subtle block text-xs">{DOMAIN_LABELS[row.domain]}</span>
                <span className="text-fg mt-1 block text-sm">
                  <span className="text-lg font-semibold tabular-nums">{row.completed}</span>{' '}
                  <span className="text-fg-muted">
                    completed of {row.inCatalogue} in the catalogue
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {/* The reason this is a count and not a percentage. */}
          <p className="text-fg-subtle mt-3 max-w-[var(--measure)] text-xs leading-relaxed">
            These are counts, not a measure of how much of a subject you know. The catalogue is
            curated and incomplete, so covering all of it would not mean covering the field.
          </p>
        </Section>
      ) : null}

      <Section title="Go somewhere">
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [
              'Resource library',
              `Search and filter ${contentManifest.counts.resources} resources`,
              '/library',
            ],
            ['Topic map', `${contentManifest.counts.topics} topics across six domains`, '/topics'],
            ['Your progress', 'Everything saved, done and viewed', '/progress'],
          ].map(([title, description, to]) => (
            <li key={to}>
              <Link
                to={to!}
                className="border-border bg-surface hover:border-border-strong block h-full rounded-lg border p-4 transition-colors"
              >
                <span className="text-fg block text-sm font-medium">{title}</span>
                <span className="text-fg-muted mt-1 block text-sm">{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* There is no path progress here because there are no paths yet. Saying
          so beats a progress bar with nothing behind it. */}
      <Callout className="mt-10 max-w-[var(--measure)]" title="Not built yet">
        Learning paths are not in the catalogue yet, so this dashboard cannot show a path or a
        progress bar. Datasets, projects and the glossary are also still to come. Until then,
        recommendations come from a single resource ranking rather than an ordered curriculum.
      </Callout>
    </>
  )
}
