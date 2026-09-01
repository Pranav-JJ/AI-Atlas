import { ACCESS_LABELS, ACCESS_TONE, hasNamedLicence, type DatasetFields } from '@/lib/datasets.ts'

import { Badge } from './Badge.tsx'
import { Callout } from './Callout.tsx'
import { ExternalLink } from './ExternalLink.tsx'

export function AccessBadge({ access }: { access: string }) {
  return (
    <Badge tone={ACCESS_TONE[access] ?? 'warn'}>
      {ACCESS_LABELS[access] ?? `Access: ${access}`}
    </Badge>
  )
}

/**
 * Licence, access terms and the standing warning — as ONE component.
 *
 * Deliberately inseparable. The requirement is that no dataset can be shown
 * without its licence field and the warning, and the reliable way to guarantee
 * that is to make it impossible to render one without the other, rather than
 * remembering to add the warning on each new surface.
 *
 * The warning is not dismissible. Dataset licences, terms of use, privacy
 * constraints and research-only restrictions carry real consequences, and our
 * metadata is a starting point for checking them, never a substitute.
 */
export function DatasetDetails({ dataset }: { dataset: DatasetFields }) {
  const licenceUnsettled = !hasNamedLicence(dataset.license)

  return (
    <section aria-labelledby="dataset-terms" className="mt-8">
      <h2 id="dataset-terms" className="text-fg text-sm font-semibold">
        Licence and access
      </h2>

      <dl className="border-border mt-3 rounded-lg border">
        <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-b p-3">
          <dt className="text-fg-subtle text-sm">Licence</dt>
          <dd className="text-fg max-w-[36ch] text-right text-sm">
            {dataset.license_url ? (
              <ExternalLink href={dataset.license_url}>{dataset.license}</ExternalLink>
            ) : (
              dataset.license
            )}
          </dd>
        </div>

        <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-b p-3">
          <dt className="text-fg-subtle text-sm">Access</dt>
          <dd className="text-right text-sm">
            <AccessBadge access={dataset.access_requirements} />
          </dd>
        </div>

        {dataset.size_description ? (
          <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-b p-3">
            <dt className="text-fg-subtle text-sm">Size</dt>
            <dd className="text-fg max-w-[36ch] text-right text-sm">{dataset.size_description}</dd>
          </div>
        ) : null}

        {dataset.domain ? (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 p-3">
            <dt className="text-fg-subtle text-sm">Domain</dt>
            <dd className="text-fg text-right text-sm">{dataset.domain}</dd>
          </div>
        ) : null}
      </dl>

      {/* Not dismissible, and never conditional on the licence looking fine. */}
      <Callout
        tone="warn"
        className="mt-4"
        title="Check the terms at the source before you use this"
      >
        Licences, terms of use, privacy constraints and research-only restrictions must be checked
        on the dataset&rsquo;s own pages. What is recorded here is a starting point for that check,
        not a substitute for it, and it can be out of date or wrong.
        {licenceUnsettled ? (
          <>
            {' '}
            <strong className="text-fg font-semibold">
              The licence for this dataset is not settled here
            </strong>{' '}
            — the source does not state a named licence, so nothing about permitted use should be
            assumed.
          </>
        ) : null}
      </Callout>

      {dataset.sensitive_data_notes ? (
        <Callout tone="danger" className="mt-3" title="Sensitive data">
          {dataset.sensitive_data_notes}
        </Callout>
      ) : null}

      {dataset.access_instructions ? (
        <div className="mt-4">
          <h3 className="text-fg text-sm font-semibold">Getting hold of it</h3>
          <p className="text-fg-muted mt-1 text-sm leading-relaxed">
            {dataset.access_instructions}
          </p>
        </div>
      ) : null}

      {dataset.known_limitations.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-fg text-sm font-semibold">Known limitations</h3>
          <ul className="text-fg-muted mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {dataset.known_limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {dataset.benchmark_tasks.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-fg text-sm font-semibold">Benchmark tasks</h3>
          <ul className="mt-2 space-y-1.5">
            {dataset.benchmark_tasks.map((task) => (
              <li key={`${task.name}-${task.metric}`} className="text-sm">
                <span className="text-fg">{task.name}</span>
                <span className="text-fg-subtle"> — measured by {task.metric}</span>
              </li>
            ))}
          </ul>
          {/* We record which metric is used, never a score. */}
          <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
            Metrics only. No leaderboard scores are recorded here, because a number without its
            exact evaluation setup is not comparable to anything.
          </p>
        </div>
      ) : null}

      {dataset.documentation_url ? (
        <p className="mt-6 text-sm">
          <ExternalLink href={dataset.documentation_url}>Documentation</ExternalLink>
        </p>
      ) : null}
    </section>
  )
}
