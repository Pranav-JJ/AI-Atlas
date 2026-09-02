import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Badge, Callout, EmptyState } from '@/components/index.ts'
import { projects, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { DIFFICULTIES, type Difficulty } from '@/lib/schema/index.ts'
import { getTopic } from '@/lib/selectors/topics.ts'

const projectTopics = [...new Set(projects.flatMap((p) => p.topics))].sort()

const LEVEL_INTROS: Record<Difficulty, string> = {
  beginner: 'Assumes you can write Python. Everything else is explained as you go.',
  intermediate: 'Assumes you have trained and evaluated a model before.',
  advanced: 'Assumes you are comfortable assembling several components and evaluating the result.',
}

export function Projects() {
  const [searchParams, setSearchParams] = useSearchParams()

  useDocumentMeta(
    'Project ideas',
    'Projects a single learner can finish on their own laptop, each with milestones, an evaluation approach, common failure modes and responsible-use notes.',
  )

  const selectedTopics = searchParams.getAll('topic')

  const filtered = useMemo(
    () =>
      projects.filter(
        (project) =>
          selectedTopics.length === 0 || selectedTopics.some((t) => project.topics.includes(t)),
      ),
    [selectedTopics],
  )

  const byLevel = DIFFICULTIES.map((level) => ({
    level,
    items: filtered.filter((p) => p.difficulty === level),
  })).filter((group) => group.items.length > 0)

  function toggleTopic(value: string) {
    const next = new URLSearchParams(searchParams)
    const current = next.getAll('topic')

    next.delete('topic')
    for (const existing of current.filter((v) => v !== value)) next.append('topic', existing)
    if (!current.includes(value)) next.append('topic', value)

    setSearchParams(next)
  }

  const hasFilters = selectedTopics.length > 0
  const gpuCount = projects.filter((p) => p.requires_gpu).length

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Project ideas</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          {projects.length} projects a single person can finish alone. Each states what it is
          actually teaching, how to tell whether it worked, and the ways it usually goes wrong.
        </p>
      </div>

      <Callout className="mt-6 max-w-[var(--measure)]" title="No rented hardware required">
        {gpuCount === 0
          ? 'Every project here runs on an ordinary laptop. None needs a GPU, a cloud budget or a dataset you have to apply for.'
          : `${projects.length - gpuCount} of ${projects.length} run on an ordinary laptop. Any project that needs a GPU says so on its card.`}{' '}
        Effort estimates are ranges, and they assume you do the evaluation step rather than stopping
        once something runs.
      </Callout>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Project filters" className="lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="text-fg text-sm font-semibold">Filter by topic</h2>
            {hasFilters ? (
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
              {projectTopics.map((topicId) => (
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
          <p role="status" aria-live="polite" className="text-fg-muted text-sm">
            {filtered.length} {filtered.length === 1 ? 'project' : 'projects'}
            {hasFilters ? ' match your filters' : ''}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No projects match these filters"
              description="The project collection is small and still growing, so most topic combinations will find nothing yet."
              action={
                <button
                  type="button"
                  onClick={() => setSearchParams(new URLSearchParams())}
                  className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="mt-6 space-y-10">
              {byLevel.map(({ level, items }) => (
                <section key={level} aria-labelledby={`level-${level}`}>
                  <h2
                    id={`level-${level}`}
                    className="text-fg text-lg font-semibold tracking-tight capitalize"
                  >
                    {level}
                  </h2>
                  <p className="text-fg-muted mt-1 text-sm">{LEVEL_INTROS[level]}</p>

                  <ul className="mt-4 space-y-4">
                    {items.map((project) => (
                      <li key={project.id}>
                        <article className="border-border bg-surface hover:border-border-strong rounded-lg border p-4 transition-colors">
                          <h3 className="text-fg text-sm font-medium">
                            <Link
                              to={`/projects/${project.id}`}
                              className="underline-offset-2 hover:underline"
                            >
                              {project.title}
                            </Link>
                          </h3>

                          <p className="text-fg-muted mt-2 line-clamp-3 text-sm leading-relaxed">
                            {project.problem_statement}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <Badge>{project.difficulty}</Badge>
                            <Badge tone="neutral">
                              {project.estimated_effort_hours.min}–
                              {project.estimated_effort_hours.max} hours
                            </Badge>
                            {/* Surfaced only when true, because the default is that
                                a project needs nothing more than a laptop. */}
                            {project.requires_gpu ? <Badge tone="warn">Needs a GPU</Badge> : null}
                            {project.recommended_dataset_ids.length > 0 ? (
                              <Badge tone="accent">Uses a public dataset</Badge>
                            ) : (
                              <Badge>Bring your own data</Badge>
                            )}
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
