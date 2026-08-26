import { Link, useParams } from 'react-router'

import {
  Badge,
  Breadcrumbs,
  Chip,
  EmptyState,
  ExternalLink,
  VerificationChip,
  type Crumb,
} from '@/components/index.ts'
import { providers, resources, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import type { AnyResource } from '@/lib/schema/index.ts'
import {
  DOMAIN_LABELS,
  getAncestors,
  getChildren,
  getTopic,
  resourcesForTopic,
} from '@/lib/selectors/topics.ts'

import { NotFound } from './NotFound.tsx'

const providerName = new Map(providers.map((p) => [p.id, p.name]))

/**
 * A compact resource row.
 *
 * Deliberately NOT the full ResourceCard — that arrives in Phase 4 with the
 * library, its filters and its detail pages. This shows enough to judge a
 * resource and follow it, and every row carries its verification state.
 */
function ResourceRow({ resource }: { resource: AnyResource }) {
  const provider = resource.provider_id ? providerName.get(resource.provider_id) : null
  const linkable = resource.url !== null && resource.status !== 'broken'

  return (
    <li className="border-border bg-surface rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="text-fg text-sm font-medium">
          {linkable ? (
            <ExternalLink href={resource.url!}>{resource.title}</ExternalLink>
          ) : (
            <span>{resource.title}</span>
          )}
        </h3>
        <VerificationChip status={resource.status} lastVerifiedAt={resource.last_verified_at} />
      </div>

      <p className="text-fg-muted mt-2 text-sm leading-relaxed">{resource.why_useful}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge>{resource.resource_type}</Badge>
        <Badge>{resource.difficulty}</Badge>
        {resource.cost_type === 'free' ? (
          <Badge tone="ok" srLabel="free to access">
            free
          </Badge>
        ) : (
          <Badge tone="warn">{resource.cost_type}</Badge>
        )}
        {provider ? <span className="text-fg-subtle text-xs">{provider}</span> : null}
      </div>

      {!linkable ? (
        <p className="text-warn mt-3 text-xs">
          {resource.url === null
            ? 'No link recorded yet — this entry is awaiting sourcing.'
            : 'This link was reported broken, so it has been disabled.'}
        </p>
      ) : null}
    </li>
  )
}

export function TopicDetail() {
  const { topicId } = useParams<{ topicId: string }>()
  const topic = topicId ? getTopic(topics, topicId) : null

  useDocumentMeta(
    topic ? topic.name : 'Topic not found',
    topic ? topic.short_definition : undefined,
  )

  // An unknown topic id is genuinely a missing page, so it gets the real 404
  // rather than an empty topic page pretending the id was valid.
  if (!topic) return <NotFound />

  const ancestors = getAncestors(topics, topic.id)
  const children = getChildren(topics, topic.id)
  const related = resourcesForTopic(resources, topic.id)
  const prerequisites = topic.prerequisiteTopics
    .map((id) => getTopic(topics, id))
    .filter((t): t is NonNullable<typeof t> => t !== null)

  const crumbs: Crumb[] = [
    { label: 'Topics', to: '/topics' },
    ...ancestors.map((a) => ({ label: a.name, to: `/topics/${a.id}` })),
    { label: topic.name },
  ]

  return (
    <>
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 max-w-[var(--measure)]">
        <p className="text-fg-subtle text-xs font-medium tracking-wide uppercase">
          {DOMAIN_LABELS[topic.domain]}
        </p>

        <h1 className="text-fg mt-2 text-3xl font-semibold tracking-tight">{topic.name}</h1>

        <p className="text-fg-muted mt-4 text-lg leading-relaxed">{topic.short_definition}</p>
      </div>

      {prerequisites.length > 0 ? (
        <section className="mt-10 max-w-[var(--measure)]" aria-labelledby="prerequisites">
          <h2 id="prerequisites" className="text-fg text-sm font-semibold">
            Assumed background
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            This topic is easier if you already have these. They are prerequisites, not gates — if
            you are comfortable with the material, skip ahead.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {prerequisites.map((p) => (
              <li key={p.id}>
                <Chip to={`/topics/${p.id}`}>{p.name}</Chip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {children.length > 0 ? (
        <section className="mt-10" aria-labelledby="subtopics">
          <h2 id="subtopics" className="text-fg text-sm font-semibold">
            Within this topic
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  to={`/topics/${child.id}`}
                  className="border-border bg-surface hover:border-border-strong block h-full rounded-lg border p-4 transition-colors"
                >
                  <span className="text-fg block text-sm font-medium">{child.name}</span>
                  <span className="text-fg-muted mt-1.5 block text-sm leading-relaxed">
                    {child.short_definition}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="resources">
        <h2 id="resources" className="text-fg text-sm font-semibold">
          Resources tagged {topic.name}
          <span className="text-fg-subtle ml-2 font-normal">
            {related.length === 1 ? '1 resource' : `${related.length} resources`}
          </span>
        </h2>

        {related.length > 0 ? (
          <>
            <p className="text-fg-muted mt-2 max-w-[var(--measure)] text-sm leading-relaxed">
              Tagged with this topic specifically. Resources on narrower subtopics are listed on
              those pages rather than rolled up here.
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {related.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            className="mt-4"
            title="No resources tagged with this topic yet"
            description={
              <>
                The catalogue is curated and still growing, so a gap here means nobody has added
                something good yet — not that nothing good exists.{' '}
                {children.length > 0 ? 'Try the narrower topics above.' : null}
              </>
            }
          />
        )}
      </section>
    </>
  )
}
