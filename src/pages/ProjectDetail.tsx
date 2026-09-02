import { Link, useParams } from 'react-router'

import { Badge, Breadcrumbs, Callout, Chip } from '@/components/index.ts'
import { projects, resources, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { getTopic } from '@/lib/selectors/topics.ts'

import { NotFound } from './NotFound.tsx'

const projectsById = new Map(projects.map((p) => [p.id, p]))
const resourcesById = new Map(resources.map((r) => [r.id, r]))

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string
  title: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8" aria-labelledby={id}>
      <h2 id={id} className="text-fg text-sm font-semibold">
        {title}
      </h2>
      {intro ? <p className="text-fg-subtle mt-1 text-xs leading-relaxed">{intro}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  )
}

function List({ items, ordered = false }: { items: readonly string[]; ordered?: boolean }) {
  const className = `text-fg-muted space-y-1.5 pl-5 text-sm leading-relaxed ${
    ordered ? 'list-decimal' : 'list-disc'
  }`

  return ordered ? (
    <ol className={className}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  ) : (
    <ul className={className}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = projectId ? projectsById.get(projectId) : undefined

  useDocumentMeta(
    project ? project.title : 'Project not found',
    project?.problem_statement.slice(0, 200),
  )

  if (!project) return <NotFound />

  const projectTopics = project.topics
    .map((id) => getTopic(topics, id))
    .filter((t): t is NonNullable<typeof t> => t !== null)

  const datasets = project.recommended_dataset_ids
    .map((id) => resourcesById.get(id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)

  return (
    <>
      <Breadcrumbs items={[{ label: 'Projects', to: '/projects' }, { label: project.title }]} />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-w-[var(--measure)]">
          <h1 className="text-fg text-3xl font-semibold tracking-tight">{project.title}</h1>

          <p className="text-fg-muted mt-4 leading-relaxed">{project.problem_statement}</p>

          <Section id="objectives" title="What this teaches">
            <List items={project.learning_objectives} />
          </Section>

          <Section id="output" title="What you should end up with">
            <p className="text-fg-muted text-sm leading-relaxed">{project.expected_output}</p>
          </Section>

          <Section id="milestones" title="Milestones" intro="A sensible order, not a rigid one.">
            <List items={project.milestones} ordered />
          </Section>

          <Section
            id="evaluation"
            title="How to tell whether it worked"
            intro="Decided before you start, so the result cannot be chosen after the fact."
          >
            <p className="text-fg-muted text-sm leading-relaxed">{project.evaluation_approach}</p>
          </Section>

          {/* Kept prominent rather than tucked at the end: knowing how something
              usually goes wrong is worth more than another feature idea. */}
          <Section
            id="failures"
            title="How this usually goes wrong"
            intro="Common enough to be worth reading before you start, not after."
          >
            <div className="border-warn/40 bg-warn-subtle rounded-lg border p-4">
              <List items={project.common_failure_modes} />
            </div>
          </Section>

          {project.stretch_goals.length > 0 ? (
            <Section id="stretch" title="If you want to go further">
              <List items={project.stretch_goals} />
            </Section>
          ) : null}

          <Section id="responsible" title="Before you use this for anything real">
            <Callout tone="warn">{project.responsible_use_notes}</Callout>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="border-border bg-surface rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">At a glance</h2>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Level</dt>
                <dd className="text-fg capitalize">{project.difficulty}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Effort</dt>
                {/* A range with the assumption stated, never a single number. */}
                <dd className="text-fg text-right">
                  {project.estimated_effort_hours.min}–{project.estimated_effort_hours.max} hours
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Hardware</dt>
                <dd className="text-right">
                  {project.requires_gpu ? (
                    <Badge tone="warn">Needs a GPU</Badge>
                  ) : (
                    <Badge tone="ok">A laptop is enough</Badge>
                  )}
                </dd>
              </div>
            </dl>

            <p className="text-fg-subtle border-border mt-3 border-t pt-3 text-xs leading-relaxed">
              The range assumes you do the evaluation step rather than stopping once something runs.
              Pace varies enormously.
            </p>
          </div>

          <div className="border-border bg-surface mt-4 rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">Tools</h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {project.suggested_tools.map((tool) => (
                <li key={tool}>
                  <Chip>{tool}</Chip>
                </li>
              ))}
            </ul>
            <p className="text-fg-subtle mt-2 text-xs">
              Suggestions, not requirements. Anything equivalent will do.
            </p>
          </div>

          <div className="border-border bg-surface mt-4 rounded-lg border p-4">
            <h2 className="text-fg text-sm font-semibold">Data</h2>
            {datasets.length > 0 ? (
              <>
                <ul className="mt-2 space-y-2">
                  {datasets.map((dataset) => (
                    <li key={dataset.id} className="text-sm">
                      <Link
                        to={`/library/${dataset.id}`}
                        className="text-accent underline underline-offset-2"
                      >
                        {dataset.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
                  Check each dataset&rsquo;s licence and access terms at the source before using it.
                </p>
              </>
            ) : (
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                Bring your own. This project works better on documents you actually care about.
              </p>
            )}
          </div>

          {projectTopics.length > 0 ? (
            <div className="border-border bg-surface mt-4 rounded-lg border p-4">
              <h2 className="text-fg text-sm font-semibold">Topics</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {projectTopics.map((topic) => (
                  <li key={topic.id}>
                    <Chip to={`/topics/${topic.id}`}>{topic.name}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  )
}
