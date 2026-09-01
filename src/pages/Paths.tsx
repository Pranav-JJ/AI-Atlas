import { Link } from 'react-router'

import { Callout, ProgressBar } from '@/components/index.ts'
import { learningPaths } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { computePathProgress, totalItems } from '@/lib/selectors/computePathProgress.ts'
import { useUserStore } from '@/lib/storage/store.ts'

export function Paths() {
  useDocumentMeta(
    'Learning paths',
    'Ordered routes through the AI Atlas catalogue, with prerequisites, honest time ranges and progress you control.',
  )

  const completions = useUserStore((s) => s.completions)
  const checkpointCompletions = useUserStore((s) => s.checkpointCompletions)

  return (
    <>
      <div className="max-w-[var(--measure)]">
        <h1 className="text-fg text-3xl font-semibold tracking-tight">Learning paths</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          An ordered route through part of the catalogue, with the reasoning for each step written
          down. Paths are a suggestion, not a syllabus — every one states what it assumes you
          already know, so you can start in the middle if that is where you are.
        </p>
      </div>

      {learningPaths.length === 0 ? (
        <Callout className="mt-8 max-w-[var(--measure)]" title="No paths yet">
          None have been written into the catalogue yet. The library and topic map work without
          them.
        </Callout>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {learningPaths.map((path) => {
            const progress = computePathProgress(path, { completions, checkpointCompletions })

            return (
              <li key={path.id}>
                <article className="border-border bg-surface hover:border-border-strong flex h-full flex-col rounded-lg border p-5 transition-colors">
                  <h2 className="text-fg text-base font-semibold">
                    <Link to={`/paths/${path.id}`} className="underline-offset-2 hover:underline">
                      {path.title}
                    </Link>
                  </h2>

                  <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                    {path.outcome_statement}
                  </p>

                  <dl className="text-fg-subtle mt-4 space-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt>For</dt>
                      <dd className="text-fg-muted">{path.audience}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Roughly</dt>
                      {/* A RANGE, never a single number. */}
                      <dd className="text-fg-muted">
                        {path.estimated_hours.min}–{path.estimated_hours.max} hours ·{' '}
                        {totalItems(path)} items
                      </dd>
                    </div>
                  </dl>

                  {!progress.isUntouched ? (
                    <div className="mt-4">
                      <ProgressBar progress={progress} label={path.title} />
                    </div>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {learningPaths.length === 1 ? (
        <Callout className="mt-8 max-w-[var(--measure)]" title="More paths to come">
          Only one path is written so far. The other eight in the plan — machine learning for
          software engineers, deep learning foundations, transformers, generative AI applications,
          RAG, MLOps and research readiness — are not in the catalogue yet, and are not listed here
          until they are.
        </Callout>
      ) : null}
    </>
  )
}
