import { Link } from 'react-router'

import { COST_LABELS, costTone, formatDuration, RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import type { AnyResource, Provider } from '@/lib/schema/index.ts'

import { Badge } from './Badge.tsx'
import { ResourceActions } from './ResourceActions.tsx'
import { VerificationChip } from './VerificationChip.tsx'

interface ResourceCardProps {
  resource: AnyResource
  provider?: Provider | undefined
  /** Preserved so "back to results" returns to the same filtered view. */
  backTo?: string
}

/**
 * A resource in a list.
 *
 * The card title links to the DETAIL page, not to the external source. The
 * external link lives on the detail page, alongside the provenance a reader
 * needs to judge it. Sending someone straight off-site from a list would skip
 * exactly the context this product exists to provide.
 */
export function ResourceCard({ resource, provider, backTo }: ResourceCardProps) {
  const duration = formatDuration(resource.estimated_duration_minutes)
  const to = backTo
    ? `/library/${resource.id}?from=${encodeURIComponent(backTo)}`
    : `/library/${resource.id}`

  return (
    <article className="border-border bg-surface hover:border-border-strong flex h-full flex-col rounded-lg border p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-fg text-sm leading-snug font-medium">
          {/* Stretched link: the whole card is clickable, but the accessible
              name comes from the heading text alone. */}
          <Link to={to} className="after:absolute after:inset-0 focus-visible:outline-none">
            {resource.title}
          </Link>
        </h3>
        <VerificationChip status={resource.status} lastVerifiedAt={resource.last_verified_at} />
      </div>

      {provider ? <p className="text-fg-subtle mt-1 text-xs">{provider.name}</p> : null}

      <p className="text-fg-muted mt-2 line-clamp-3 text-sm leading-relaxed">
        {resource.why_useful}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <Badge>{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
        <Badge>{resource.difficulty}</Badge>
        <Badge tone={costTone(resource.cost_type)}>{COST_LABELS[resource.cost_type]}</Badge>
        {duration ? <span className="text-fg-subtle text-xs">{duration}</span> : null}

        <div className="ml-auto">
          <ResourceActions resourceId={resource.id} title={resource.title} />
        </div>
      </div>
    </article>
  )
}

/** Wrapper that makes the stretched link work without breaking the grid. */
export function ResourceCardItem(props: ResourceCardProps) {
  return (
    <li className="relative">
      <ResourceCard {...props} />
    </li>
  )
}
