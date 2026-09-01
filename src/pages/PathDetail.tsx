import { Link, useParams } from 'react-router'

import {
  Badge,
  Breadcrumbs,
  Callout,
  Chip,
  ProgressBar,
  VerificationChip,
} from '@/components/index.ts'
import { learningPaths, resources, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { formatDuration, RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import type { Module, PathItem } from '@/lib/schema/index.ts'
import {
  checkpointItemId,
  computePathProgress,
  isItemComplete,
  totalItems,
} from '@/lib/selectors/computePathProgress.ts'
import { getTopic } from '@/lib/selectors/topics.ts'
import { useUserStore } from '@/lib/storage/store.ts'

import { NotFound } from './NotFound.tsx'

const resourcesById = new Map(resources.map((r) => [r.id, r]))
const pathsById = new Map(learningPaths.map((p) => [p.id, p]))

function ItemRow({
  pathId,
  module,
  item,
  index,
  complete,
}: {
  pathId: string
  module: Module
  item: PathItem
  index: number
  complete: boolean
}) {
  const toggleCompletion = useUserStore((s) => s.toggleCompletion)
  const toggleCheckpoint = useUserStore((s) => s.toggleCheckpoint)

  const resource = item.resource_id ? resourcesById.get(item.resource_id) : undefined

  function toggle() {
    if (item.kind === 'checkpoint') {
      toggleCheckpoint(pathId, checkpointItemId(module, item))
    } else if (item.resource_id) {
      toggleCompletion(item.resource_id)
    }
  }

  const label =
    item.kind === 'checkpoint'
      ? (item.checkpoint?.title ?? 'Checkpoint')
      : (resource?.title ?? item.resource_id ?? 'Unknown item')

  return (
    <li className="border-border bg-surface rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={complete}
          onChange={toggle}
          aria-label={complete ? `Mark “${label}” as not done` : `Mark “${label}” as done`}
          className="accent-accent mt-1 h-4 w-4 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-fg-subtle font-mono text-xs tabular-nums">{index}</span>

            <h4
              className={`text-sm font-medium ${complete ? 'text-fg-muted line-through' : 'text-fg'}`}
            >
              {item.kind === 'checkpoint' ? (
                label
              ) : resource ? (
                <Link to={`/library/${resource.id}`} className="underline-offset-2 hover:underline">
                  {resource.title}
                </Link>
              ) : (
                <span className="text-warn">{label} — no longer in the catalogue</span>
              )}
            </h4>

            {/* Required vs optional is load-bearing: only required items move
                the progress bar, so the distinction is always visible. */}
            {item.required ? (
              <Badge tone="accent">Required</Badge>
            ) : (
              <Badge srLabel="optional, does not affect progress">Optional</Badge>
            )}

            {item.kind === 'checkpoint' ? <Badge tone="warn">Checkpoint</Badge> : null}

            {resource ? (
              <>
                <Badge>{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
                {formatDuration(resource.estimated_duration_minutes) ? (
                  <span className="text-fg-subtle text-xs">
                    {formatDuration(resource.estimated_duration_minutes)}
                  </span>
                ) : null}
                <VerificationChip
                  status={resource.status}
                  lastVerifiedAt={resource.last_verified_at}
                />
              </>
            ) : null}
          </div>

          {item.kind === 'checkpoint' && item.checkpoint ? (
            <div className="border-warn/30 bg-warn-subtle mt-3 rounded border p-3">
              <p className="text-fg-muted text-sm leading-relaxed">{item.checkpoint.prompt}</p>
              <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
                <span className="text-fg-muted font-medium">You are done when: </span>
                {item.checkpoint.how_to_self_assess}
              </p>
            </div>
          ) : null}

          {/* Why this item, in this position. Ordering without reasons rots. */}
          {item.note ? (
            <p className="text-fg-subtle mt-2 text-xs leading-relaxed italic">{item.note}</p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function PathDetail() {
  const { pathId } = useParams<{ pathId: string }>()
  const path = pathId ? pathsById.get(pathId) : undefined

  const completions = useUserStore((s) => s.completions)
  const checkpointCompletions = useUserStore((s) => s.checkpointCompletions)

  useDocumentMeta(path ? path.title : 'Path not found', path?.outcome_statement)

  if (!path) return <NotFound />

  const progress = computePathProgress(path, { completions, checkpointCompletions })

  const prerequisiteTopics = path.prerequisites.topics
    .map((id) => getTopic(topics, id))
    .filter((t): t is NonNullable<typeof t> => t !== null)

  const nextPaths = path.next_path_ids
    .map((id) => pathsById.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  return (
    <>
      <Breadcrumbs items={[{ label: 'Learning paths', to: '/paths' }, { label: path.title }]} />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="max-w-[var(--measure)]">
          <h1 className="text-fg text-3xl font-semibold tracking-tight">{path.title}</h1>

          <p className="text-fg-muted mt-4 text-lg leading-relaxed">{path.outcome_statement}</p>

          <p className="text-fg-muted mt-4 text-sm leading-relaxed">
            <span className="text-fg font-medium">Who this is for: </span>
            {path.audience}
          </p>

          <section className="mt-8" aria-labelledby="prereqs">
            <h2 id="prereqs" className="text-fg text-sm font-semibold">
              What this assumes
            </h2>
            <p className="text-fg-muted mt-2 text-sm leading-relaxed">
              {path.prerequisites.description}
            </p>
            {prerequisiteTopics.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {prerequisiteTopics.map((topic) => (
                  <li key={topic.id}>
                    <Chip to={`/topics/${topic.id}`}>{topic.name}</Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {path.modules.map((module, moduleIndex) => {
            const ordered = [...module.items].sort((a, b) => a.order - b.order)

            return (
              <section key={module.id} className="mt-10" aria-labelledby={module.id}>
                <h2 id={module.id} className="text-fg text-lg font-semibold tracking-tight">
                  <span className="text-fg-subtle font-mono text-sm">{moduleIndex + 1}.</span>{' '}
                  {module.title}
                </h2>
                <p className="text-fg-muted mt-2 text-sm leading-relaxed">{module.summary}</p>

                <ul className="mt-4 space-y-3">
                  {ordered.map((item, itemIndex) => (
                    <ItemRow
                      key={`${module.id}-${item.order}`}
                      pathId={path.id}
                      module={module}
                      item={item}
                      index={itemIndex + 1}
                      complete={isItemComplete(path, module, item, {
                        completions,
                        checkpointCompletions,
                      })}
                    />
                  ))}
                </ul>
              </section>
            )
          })}

          <section className="mt-10" aria-labelledby="completion">
            <h2 id="completion" className="text-fg text-sm font-semibold">
              Completion
            </h2>
            <p className="text-fg-muted mt-2 text-sm leading-relaxed">{path.completion_criteria}</p>
          </section>

          <section className="mt-10" aria-labelledby="next">
            <h2 id="next" className="text-fg text-sm font-semibold">
              After this
            </h2>
            {nextPaths.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {nextPaths.map((next) => (
                  <li key={next.id}>
                    <Link
                      to={`/paths/${next.id}`}
                      className="text-accent text-sm underline underline-offset-2"
                    >
                      {next.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              /* No invented follow-on. There genuinely is not one yet. */
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                No follow-on path exists yet. The{' '}
                <Link to="/library" className="text-accent underline underline-offset-2">
                  library
                </Link>{' '}
                and{' '}
                <Link to="/topics" className="text-accent underline underline-offset-2">
                  topic map
                </Link>{' '}
                are the way onwards for now.
              </p>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="border-border bg-surface rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">Your progress</h2>
            <div className="mt-3">
              <ProgressBar progress={progress} label={path.title} showDetail />
            </div>

            {progress.isComplete ? (
              <p className="text-ok bg-ok-subtle mt-3 rounded p-2 text-sm">
                Every required item is complete.
              </p>
            ) : null}
          </div>

          <div className="border-border bg-surface mt-4 rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">Time</h2>
            {/* A range with its assumptions, never a single number. */}
            <p className="text-fg mt-2 text-2xl font-semibold tabular-nums">
              {path.estimated_hours.min}–{path.estimated_hours.max}
              <span className="text-fg-muted ml-1 text-sm font-normal">hours</span>
            </p>
            <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
              {path.estimate_assumptions}
            </p>
            <p className="text-fg-subtle border-border mt-3 border-t pt-3 text-xs">
              {totalItems(path)} items · {progress.totalRequired} required ·{' '}
              {progress.totalOptional} optional
            </p>
          </div>

          {path.status !== 'verified' ? (
            <Callout tone="warn" className="mt-4" title="Not yet reviewed">
              This path has been written but not reviewed by a second person, and most of the
              resources in it are themselves unverified.
            </Callout>
          ) : null}
        </aside>
      </div>
    </>
  )
}
