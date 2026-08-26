import { Link } from 'react-router'

import { resources, topics } from '@/content/generated/index.ts'
import { Callout } from '@/components/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import {
  countResourcesByTopic,
  DOMAIN_LABELS,
  groupTopicsByDomain,
} from '@/lib/selectors/topics.ts'

export function Topics() {
  useDocumentMeta(
    'Topics',
    'The AI Atlas topic map: foundations, machine learning, deep learning, NLP, generative AI and production MLOps, with prerequisites for each.',
  )

  const groups = groupTopicsByDomain(topics)
  const counts = countResourcesByTopic(resources, topics)

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Topic map</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          {topics.length} topics across six domains. Each one states what it covers and what it
          assumes you already know.
        </p>

        <Callout className="mt-6" title="This is one map, not the curriculum">
          The grouping below is a way to navigate the field, not a claim about the only correct
          order to learn it. Every topic lists its own prerequisites, so you can enter wherever your
          background actually starts — a software engineer can begin at Machine Learning without
          working through Foundations first.
        </Callout>
      </div>

      <div className="mt-12 space-y-12">
        {groups.map(({ domain, root, children }) => (
          <section key={domain} aria-labelledby={`domain-${domain}`}>
            <h2 id={`domain-${domain}`} className="text-fg text-xl font-semibold tracking-tight">
              {root ? (
                <Link
                  to={`/topics/${root.id}`}
                  className="hover:text-accent underline-offset-4 hover:underline"
                >
                  {DOMAIN_LABELS[domain]}
                </Link>
              ) : (
                DOMAIN_LABELS[domain]
              )}
            </h2>

            {root ? (
              <p className="text-fg-muted mt-2 max-w-[var(--measure)] text-sm leading-relaxed">
                {root.short_definition}
              </p>
            ) : null}

            <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {children.map((topic) => {
                const count = counts.get(topic.id) ?? 0

                return (
                  <li key={topic.id}>
                    <Link
                      to={`/topics/${topic.id}`}
                      className="border-border bg-surface hover:border-border-strong block h-full rounded-lg border p-4 transition-colors"
                    >
                      <span className="text-fg block text-sm font-medium">{topic.name}</span>
                      <span className="text-fg-muted mt-1.5 block text-sm leading-relaxed">
                        {topic.short_definition}
                      </span>
                      <span className="text-fg-subtle mt-3 block text-xs">
                        {/* A count, never a percentage — the catalogue is curated
                            and incomplete, so a percentage would imply mastery. */}
                        {count === 1 ? '1 resource' : `${count} resources`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
