import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { AccessBadge } from '@/components/DatasetDetails.tsx'
import { Badge, Callout, EmptyState, VerificationChip } from '@/components/index.ts'
import { resources } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { ACCESS_LABELS, hasNamedLicence, isDataset, shortLicence } from '@/lib/datasets.ts'
import { humanizeId } from '@/lib/format.ts'
import { ACCESS_REQUIREMENTS, MODALITIES } from '@/lib/schema/index.ts'

/** Every dataset and benchmark in the catalogue. */
const datasets = resources.filter(isDataset)

const allTasks = [...new Set(datasets.flatMap((d) => d.task))].sort()
const usedModalities = MODALITIES.filter((m) => datasets.some((d) => d.modality.includes(m)))
const usedAccess = ACCESS_REQUIREMENTS.filter((a) =>
  datasets.some((d) => d.access_requirements === a),
)

export function Datasets() {
  const [searchParams, setSearchParams] = useSearchParams()

  useDocumentMeta(
    'Datasets and benchmarks',
    'Datasets and benchmarks with their licence, access terms, known limitations and sensitive-data considerations — always to be checked at the source.',
  )

  const selectedModalities = searchParams.getAll('modality')
  const selectedTasks = searchParams.getAll('task')
  const selectedAccess = searchParams.getAll('access')
  const licenceFilter = searchParams.get('licence')

  const filtered = useMemo(
    () =>
      datasets.filter((dataset) => {
        if (
          selectedModalities.length > 0 &&
          !selectedModalities.some((m) => dataset.modality.includes(m as never))
        ) {
          return false
        }
        if (selectedTasks.length > 0 && !selectedTasks.some((t) => dataset.task.includes(t))) {
          return false
        }
        if (selectedAccess.length > 0 && !selectedAccess.includes(dataset.access_requirements)) {
          return false
        }
        if (licenceFilter === 'named' && !hasNamedLicence(dataset.license)) return false
        if (licenceFilter === 'unsettled' && hasNamedLicence(dataset.license)) return false

        return true
      }),
    [selectedModalities, selectedTasks, selectedAccess, licenceFilter],
  )

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    const current = next.getAll(key)

    next.delete(key)
    for (const existing of current.filter((v) => v !== value)) next.append(key, existing)
    if (!current.includes(value)) next.append(key, value)

    setSearchParams(next)
  }

  function setLicence(value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete('licence')
    else next.set('licence', value)
    setSearchParams(next)
  }

  const hasFilters = [...searchParams.keys()].length > 0
  const unsettledCount = datasets.filter((d) => !hasNamedLicence(d.license)).length

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Datasets and benchmarks</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          {datasets.length} datasets, each recorded with its licence, access terms, known
          limitations and sensitive-data considerations.
        </p>
      </div>

      {/* Standing and not dismissible. This is the first thing on the page for
          a reason: the consequences of getting dataset terms wrong are legal
          and reputational, not merely inconvenient. */}
      <Callout
        tone="warn"
        className="mt-6 max-w-[var(--measure)]"
        title="Always check the terms at the source"
      >
        Licences, terms of use, privacy constraints and research-only restrictions must be verified
        on each dataset&rsquo;s own pages before you use it for anything. What is recorded here is a
        starting point for that check, never a substitute — and none of it has been reviewed by a
        second person yet.
        {unsettledCount > 0 ? (
          <>
            {' '}
            <strong className="text-fg font-semibold">
              {unsettledCount} of {datasets.length} have no named licence
            </strong>{' '}
            recorded, because their sources do not state one.
          </>
        ) : null}
      </Callout>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Dataset filters" className="lg:sticky lg:top-20 lg:self-start space-y-4">
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
            <legend className="text-fg pr-2 text-sm font-medium">Modality</legend>
            <div className="mt-2 space-y-1.5">
              {usedModalities.map((modality) => (
                <label key={modality} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedModalities.includes(modality)}
                    onChange={() => toggle('modality', modality)}
                    className="accent-accent h-4 w-4 shrink-0"
                  />
                  <span className="text-fg-muted capitalize">{modality}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="border-border border-t pt-4">
            <legend className="text-fg pr-2 text-sm font-medium">Task</legend>
            <div className="mt-2 space-y-1.5">
              {allTasks.map((task) => (
                <label key={task} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task)}
                    onChange={() => toggle('task', task)}
                    className="accent-accent h-4 w-4 shrink-0"
                  />
                  <span className="text-fg-muted">{humanizeId(task)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="border-border border-t pt-4">
            <legend className="text-fg pr-2 text-sm font-medium">Access</legend>
            <div className="mt-2 space-y-1.5">
              {usedAccess.map((access) => (
                <label key={access} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAccess.includes(access)}
                    onChange={() => toggle('access', access)}
                    className="accent-accent h-4 w-4 shrink-0"
                  />
                  <span className="text-fg-muted">{ACCESS_LABELS[access] ?? access}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="border-border border-t pt-4">
            <legend className="text-fg pr-2 text-sm font-medium">Licence</legend>
            <div className="mt-2 space-y-1.5">
              {(
                [
                  ['Any', null],
                  ['Names a licence', 'named'],
                  ['No named licence', 'unsettled'],
                ] as Array<[label: string, value: string | null]>
              ).map(([label, value]) => (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="licence-filter"
                    checked={licenceFilter === value || (value === null && licenceFilter === null)}
                    onChange={() => setLicence(value)}
                    className="accent-accent h-4 w-4 shrink-0"
                  />
                  <span className="text-fg-muted">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </aside>

        <div>
          <p role="status" aria-live="polite" className="text-fg-muted text-sm">
            {filtered.length} {filtered.length === 1 ? 'dataset' : 'datasets'}
            {hasFilters ? ' match your filters' : ''}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No datasets match these filters"
              description="The dataset catalogue is small and still growing, so most combinations of filters will find nothing yet."
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
            <ul className="mt-4 grid grid-cols-1 gap-4">
              {filtered.map((dataset) => (
                <li key={dataset.id}>
                  <article className="border-border bg-surface hover:border-border-strong rounded-lg border p-4 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-fg text-sm font-medium">
                        <Link
                          to={`/library/${dataset.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {dataset.title}
                        </Link>
                      </h2>
                      <VerificationChip
                        status={dataset.status}
                        lastVerifiedAt={dataset.last_verified_at}
                      />
                    </div>

                    <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                      {dataset.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge tone="accent">
                        {dataset.resource_type === 'benchmark' ? 'Benchmark' : 'Dataset'}
                      </Badge>
                      {dataset.modality.map((modality) => (
                        <Badge key={modality}>{modality}</Badge>
                      ))}
                      <AccessBadge access={dataset.access_requirements} />
                      {/* Licence is on the card, not only the detail page. */}
                      <Badge tone={hasNamedLicence(dataset.license) ? 'neutral' : 'warn'}>
                        {hasNamedLicence(dataset.license)
                          ? shortLicence(dataset.license)
                          : 'Licence not settled'}
                      </Badge>
                    </div>
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
