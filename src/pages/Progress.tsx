import { useState } from 'react'
import { Link } from 'react-router'

import {
  Badge,
  Callout,
  EmptyState,
  ResourceActions,
  VerificationChip,
} from '@/components/index.ts'
import { providers, resources } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { formatDuration, RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import type { AnyResource } from '@/lib/schema/index.ts'
import { GOAL_LABELS } from '@/lib/storage/schema.ts'
import { flushPendingWrites, useUserStore } from '@/lib/storage/store.ts'

const byId = new Map(resources.map((r) => [r.id, r]))
const providersById = new Map(providers.map((p) => [p.id, p]))

/** Entries whose resource is no longer in the catalogue, shown honestly. */
interface Resolved {
  id: string
  at: string
  resource: AnyResource | undefined
}

function resolve(record: Record<string, { at: string }>): Resolved[] {
  return Object.entries(record)
    .map(([id, { at }]) => ({ id, at, resource: byId.get(id) }))
    .sort((a, b) => b.at.localeCompare(a.at))
}

function ResourceRow({ entry }: { entry: Resolved }) {
  const { resource } = entry

  if (!resource) {
    // Kept, not silently dropped: the user marked this, and pretending it never
    // happened would be a quiet edit of their own record.
    return (
      <li className="border-border bg-surface rounded-lg border border-dashed p-4">
        <p className="text-fg-muted text-sm">
          <span className="text-fg font-mono text-xs">{entry.id}</span>
        </p>
        <p className="text-fg-subtle mt-1 text-sm">
          Removed from the catalogue since you saved it. Your record is kept.
        </p>
      </li>
    )
  }

  const provider = resource.provider_id ? providersById.get(resource.provider_id) : undefined
  const duration = formatDuration(resource.estimated_duration_minutes)

  return (
    <li className="border-border bg-surface rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-fg text-sm font-medium">
          <Link
            to={`/library/${resource.id}`}
            className="hover:text-accent underline-offset-2 hover:underline"
          >
            {resource.title}
          </Link>
        </h3>
        <ResourceActions resourceId={resource.id} title={resource.title} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge>{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
        <VerificationChip status={resource.status} lastVerifiedAt={resource.last_verified_at} />
        {provider ? <span className="text-fg-subtle text-xs">{provider.name}</span> : null}
        {duration ? <span className="text-fg-subtle text-xs">{duration}</span> : null}
      </div>
    </li>
  )
}

/** Minutes completed in the last seven days, from resources with a known length. */
function minutesThisWeek(completions: Record<string, { at: string }>): {
  minutes: number
  counted: number
  unknown: number
} {
  const cutoff = Date.now() - 7 * 86_400_000
  let minutes = 0
  let counted = 0
  let unknown = 0

  for (const [id, { at }] of Object.entries(completions)) {
    if (Date.parse(at) < cutoff) continue

    const resource = byId.get(id)
    if (!resource) continue

    if (resource.estimated_duration_minutes === null) {
      unknown += 1
      continue
    }

    minutes += resource.estimated_duration_minutes
    counted += 1
  }

  return { minutes, counted, unknown }
}

export function Progress() {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const profile = useUserStore((s) => s.profile)
  const bookmarks = useUserStore((s) => s.bookmarks)
  const completions = useUserStore((s) => s.completions)
  const recentlyViewed = useUserStore((s) => s.recentlyViewed)
  const storageAvailable = useUserStore((s) => s.storageAvailable)
  const recovered = useUserStore((s) => s.recoveredFromCorruption)
  const exportState = useUserStore((s) => s.exportState)
  const importState = useUserStore((s) => s.importState)
  const resetAll = useUserStore((s) => s.resetAll)

  useDocumentMeta(
    'Your progress',
    'Everything AI Atlas remembers about you, stored only in this browser. Export it or delete it at any time.',
  )

  const saved = resolve(bookmarks)
  const done = resolve(completions)
  const recents = recentlyViewed.map((r) => ({
    id: r.resourceId,
    at: r.viewedAt,
    resource: byId.get(r.resourceId),
  }))

  const week = minutesThisWeek(completions)
  const target = profile.weeklyTargetMinutes

  function handleExport() {
    // Flush first, or a change made in the last quarter-second is missing.
    flushPendingWrites()

    const text = JSON.stringify(exportState(), null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ai-atlas-progress-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()

    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    setImportError(null)

    try {
      const result = importState(JSON.parse(await file.text()))
      if (!result.ok) setImportError(result.error ?? 'That file could not be read.')
    } catch {
      setImportError('That file is not valid JSON.')
    }
  }

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Your progress</h1>
        <p className="text-fg-muted mt-4 leading-relaxed">
          Everything below is stored in this browser and has never left it. There are no accounts,
          so this page is the complete extent of what AI Atlas knows about you.
        </p>
      </div>

      {!storageAvailable ? (
        <Callout tone="warn" className="mt-6 max-w-[var(--measure)]" title="Nothing is being saved">
          Your browser is blocking site data, so anything you mark here will be forgotten when you
          close the tab. This is usually a private window or a privacy setting.
        </Callout>
      ) : null}

      {recovered ? (
        <Callout
          tone="warn"
          className="mt-6 max-w-[var(--measure)]"
          title="Some saved data could not be read"
        >
          Part of your stored progress was unreadable and has been reset. Whatever could be
          recovered has been kept.
        </Callout>
      ) : null}

      <section className="mt-10" aria-labelledby="summary">
        <h2 id="summary" className="text-fg text-sm font-semibold">
          Summary
        </h2>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Saved', saved.length],
            ['Marked done', done.length],
            ['Recently viewed', recents.length],
          ].map(([label, value]) => (
            <div key={label} className="border-border bg-surface rounded-lg border p-4">
              <dt className="text-fg-subtle text-xs">{label}</dt>
              <dd className="text-fg mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}

          <div className="border-border bg-surface rounded-lg border p-4">
            <dt className="text-fg-subtle text-xs">Your level</dt>
            <dd className="text-fg mt-1 text-sm font-medium capitalize">
              {profile.level ?? 'Not set'}
            </dd>
          </div>
        </dl>

        <p className="text-fg-muted mt-3 text-sm">
          {profile.goal ? (
            <>
              Goal: <span className="text-fg">{GOAL_LABELS[profile.goal]}</span>.{' '}
            </>
          ) : null}
          <Link to="/onboarding" className="text-accent underline underline-offset-2">
            {profile.level || profile.goal
              ? 'Change your starting point'
              : 'Set your starting point'}
          </Link>
        </p>
      </section>

      {target !== null ? (
        <section className="mt-10 max-w-[var(--measure)]" aria-labelledby="weekly">
          <h2 id="weekly" className="text-fg text-sm font-semibold">
            This week
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            <span className="text-fg font-medium tabular-nums">{week.minutes}</span> of {target}{' '}
            minutes, from {week.counted} {week.counted === 1 ? 'resource' : 'resources'} you marked
            done in the last seven days.
          </p>
          {/* The number is honest about what it can and cannot count. */}
          <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
            Counts only resources that have a recorded length, and those lengths are estimates.
            {week.unknown > 0 ? (
              <>
                {' '}
                {week.unknown} completed {week.unknown === 1 ? 'resource has' : 'resources have'} no
                recorded length and {week.unknown === 1 ? 'is' : 'are'} not included.
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="saved">
        <h2 id="saved" className="text-fg text-sm font-semibold">
          Saved
        </h2>
        {saved.length > 0 ? (
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {saved.map((entry) => (
              <ResourceRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-3"
            title="Nothing saved yet"
            description="Saving a resource keeps it here so you can come back to it. Nothing is sent anywhere."
            action={
              <Link
                to="/library"
                className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                Browse the library
              </Link>
            }
          />
        )}
      </section>

      <section className="mt-10" aria-labelledby="done">
        <h2 id="done" className="text-fg text-sm font-semibold">
          Marked done
        </h2>
        {done.length > 0 ? (
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {done.map((entry) => (
              <ResourceRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-3"
            title="Nothing marked done yet"
            description="Completion is only ever set by you ticking it — never inferred from opening a link or scrolling a page."
          />
        )}
      </section>

      {recents.length > 0 ? (
        <section className="mt-10" aria-labelledby="recent">
          <h2 id="recent" className="text-fg text-sm font-semibold">
            Recently viewed
          </h2>
          <ul className="mt-3 space-y-2">
            {recents.map((entry) => (
              <li key={entry.id} className="text-sm">
                {entry.resource ? (
                  <Link
                    to={`/library/${entry.resource.id}`}
                    className="text-accent underline underline-offset-2"
                  >
                    {entry.resource.title}
                  </Link>
                ) : (
                  <span className="text-fg-subtle">
                    <span className="font-mono text-xs">{entry.id}</span> — removed from the
                    catalogue
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-14 max-w-[var(--measure)]" aria-labelledby="data">
        <h2 id="data" className="text-fg text-lg font-semibold tracking-tight">
          Your data
        </h2>
        <p className="text-fg-muted mt-2 text-sm leading-relaxed">
          Because there are no accounts, this data lives only in this browser. It does not sync
          between devices, and clearing site data erases it. Exporting is the only backup.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="border-border-interactive text-fg hover:bg-surface-subtle rounded border px-4 py-2 text-sm font-medium transition-colors"
          >
            Export as JSON
          </button>

          <label className="border-border-interactive text-fg hover:bg-surface-subtle cursor-pointer rounded border px-4 py-2 text-sm font-medium transition-colors">
            Import a backup
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
          </label>
        </div>

        {importError ? (
          <p role="alert" className="text-danger mt-3 text-sm">
            {importError}
          </p>
        ) : null}

        <div className="border-danger/40 bg-danger-subtle mt-8 rounded-lg border p-4">
          <h3 className="text-fg text-sm font-semibold">Delete everything</h3>
          <p className="text-fg-muted mt-1 text-sm leading-relaxed">
            Removes your profile, bookmarks, completions and history from this browser. This cannot
            be undone.
          </p>

          {confirmingReset ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  resetAll()
                  setConfirmingReset(false)
                }}
                className="bg-danger rounded px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                Yes, delete everything
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="text-fg-muted text-sm underline underline-offset-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="border-danger/60 text-danger mt-3 rounded border px-4 py-2 text-sm font-medium transition-colors"
            >
              Delete all my data
            </button>
          )}
        </div>
      </section>
    </>
  )
}
