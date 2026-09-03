import { Link, useParams } from 'react-router'

import { Badge, Breadcrumbs, Callout, Chip } from '@/components/index.ts'
import { glossary, resources, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import { getTopic } from '@/lib/selectors/topics.ts'

import { NotFound } from './NotFound.tsx'

const termsById = new Map(glossary.map((t) => [t.id, t]))
const resourcesById = new Map(resources.map((r) => [r.id, r]))

export function GlossaryTerm() {
  const { termId } = useParams<{ termId: string }>()
  const entry = termId ? termsById.get(termId) : undefined

  useDocumentMeta(entry ? entry.term : 'Term not found', entry?.plain_definition)

  if (!entry) return <NotFound />

  const relatedTerms = entry.related_term_ids
    .map((id) => termsById.get(id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)

  const suggestedResources = entry.resource_ids
    .map((id) => resourcesById.get(id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)

  const entryTopics = entry.topics
    .map((id) => getTopic(topics, id))
    .filter((t): t is NonNullable<typeof t> => t !== null)

  const hasDeeperDetail =
    entry.technical_explanation.length > 0 ||
    entry.formula_latex !== null ||
    entry.code_example !== null

  return (
    <>
      <Breadcrumbs items={[{ label: 'Glossary', to: '/glossary' }, { label: entry.term }]} />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-w-[var(--measure)]">
          <h1 className="text-fg text-3xl font-semibold tracking-tight">{entry.term}</h1>

          {entry.aliases.length > 0 ? (
            <p className="text-fg-subtle mt-1 text-sm">Also called {entry.aliases.join(', ')}</p>
          ) : null}

          {/* Always visible. A beginner must never have to expand anything to
              get a usable answer. */}
          <p className="text-fg-muted mt-5 text-lg leading-relaxed">{entry.plain_definition}</p>

          {entry.example !== null ? (
            <section className="mt-8" aria-labelledby="example">
              <h2 id="example" className="text-fg text-sm font-semibold">
                For example
              </h2>
              <p className="text-fg-muted mt-2 leading-relaxed">{entry.example}</p>
            </section>
          ) : null}

          {entry.common_misconception !== null ? (
            <section className="mt-8" aria-labelledby="misconception">
              <h2 id="misconception" className="text-fg text-sm font-semibold">
                What people usually get wrong
              </h2>
              {/* Kept visible rather than collapsed: the misconception is often
                  the most useful thing on the page, and someone who already
                  thinks they understand the term will not expand a section. */}
              <Callout tone="warn" className="mt-2">
                {entry.common_misconception}
              </Callout>
            </section>
          ) : null}

          {hasDeeperDetail ? (
            <section className="mt-8" aria-labelledby="detail">
              <h2 id="detail" className="sr-only">
                Technical detail
              </h2>

              <details className="border-border bg-surface rounded-lg border">
                <summary className="text-fg cursor-pointer p-4 text-sm font-medium">
                  Go deeper
                  <span className="text-fg-subtle ml-2 font-normal">
                    the technical explanation
                    {entry.formula_latex !== null ? ', the formula' : ''}
                    {entry.code_example !== null ? ' and code' : ''}
                  </span>
                </summary>

                <div className="border-border border-t p-4">
                  <p className="text-fg-muted text-sm leading-relaxed">
                    {entry.technical_explanation}
                  </p>

                  {entry.formula_latex !== null ? (
                    <div className="mt-4">
                      <h3 className="text-fg text-xs font-semibold tracking-wide uppercase">
                        Formula
                      </h3>
                      {/* LaTeX SOURCE, shown as text. Rendering it would mean
                          adding a maths typesetter that emits HTML — a large
                          dependency and a new injection surface, for a handful
                          of short formulas. */}
                      <pre className="border-border bg-surface-subtle text-fg mt-2 overflow-x-auto rounded border p-3 font-mono text-xs">
                        {entry.formula_latex}
                      </pre>
                      <p className="text-fg-subtle mt-1 text-xs">
                        Written as LaTeX source rather than typeset.
                      </p>
                    </div>
                  ) : null}

                  {entry.code_example !== null ? (
                    <div className="mt-4">
                      <h3 className="text-fg text-xs font-semibold tracking-wide uppercase">
                        Code
                        <span className="text-fg-subtle ml-2 font-normal normal-case">
                          {entry.code_example.language}
                        </span>
                      </h3>
                      <pre className="border-border bg-surface-subtle text-fg mt-2 overflow-x-auto rounded border p-3 font-mono text-xs">
                        {entry.code_example.code}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </details>
            </section>
          ) : null}

          {relatedTerms.length > 0 ? (
            <section className="mt-8" aria-labelledby="related">
              <h2 id="related" className="text-fg text-sm font-semibold">
                Related terms
              </h2>
              <ul className="mt-2 space-y-2">
                {relatedTerms.map((related) => (
                  <li key={related.id}>
                    <Link
                      to={`/glossary/${related.id}`}
                      className="text-accent text-sm underline underline-offset-2"
                    >
                      {related.term}
                    </Link>
                    <span className="text-fg-subtle text-sm"> — {related.plain_definition}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          {entryTopics.length > 0 ? (
            <div className="border-border bg-surface rounded-lg border p-4">
              <h2 className="text-fg text-sm font-semibold">Topics</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {entryTopics.map((topic) => (
                  <li key={topic.id}>
                    <Chip to={`/topics/${topic.id}`}>{topic.name}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestedResources.length > 0 ? (
            <div className="border-border bg-surface mt-4 rounded-lg border p-4">
              <h2 className="text-fg text-sm font-semibold">Where to learn this properly</h2>
              <ul className="mt-2 space-y-3">
                {suggestedResources.map((resource) => (
                  <li key={resource.id} className="text-sm">
                    <Link
                      to={`/library/${resource.id}`}
                      className="text-accent underline underline-offset-2"
                    >
                      {resource.title}
                    </Link>
                    <div className="mt-1">
                      <Badge>{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
                    </div>
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
