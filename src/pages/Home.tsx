import { Link } from 'react-router'

import { Callout } from '@/components/index.ts'
import { contentManifest, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'

/**
 * Interim home page.
 *
 * Deliberately NOT a placeholder dashboard: the real dashboard needs a learner
 * profile and progress state, which arrive in Phases 5 and 6. Rendering an
 * empty version now would show fabricated zeros and imply tracking that does
 * not exist.
 *
 * Instead this points at what genuinely works today and is honest about the
 * rest. Replaced by the dashboard in Phase 6.
 */
export function Home() {
  useDocumentMeta(
    'AI Atlas',
    'A curated, provenance-tracked learning atlas for AI, machine learning, deep learning, generative AI and NLP.',
  )

  const { counts, verification } = contentManifest

  const roadmap: Array<[string, string, boolean]> = [
    ['0', 'Toolchain', true],
    ['1', 'Deployment pipeline', true],
    ['2', 'Content pipeline', true],
    ['3', 'Design system and topic map', true],
    ['4', 'Resource library with search and filters', false],
    ['5', 'Bookmarks and progress', false],
    ['6', 'Dashboard', false],
    ['7', 'Learning paths', false],
  ]

  return (
    <>
      <section className="max-w-[var(--measure)]">
        <h1 className="text-fg text-4xl font-semibold tracking-tight">AI Atlas</h1>

        <p className="text-fg-muted mt-4 text-lg leading-relaxed">
          A curated, provenance-tracked learning atlas for AI, machine learning, deep learning,
          generative AI and NLP. Every resource says who made it, why it earns your time, and
          whether anyone has actually checked it.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/topics"
            className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            Browse the topic map
          </Link>
          <Link
            to="/about"
            className="border-border text-fg hover:border-border-strong rounded border px-4 py-2 text-sm font-medium transition-colors"
          >
            How resources are chosen
          </Link>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="catalogue">
        <h2 id="catalogue" className="text-fg text-sm font-semibold">
          What is in the catalogue
        </h2>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Topics', counts.topics],
            ['Resources', counts.resources],
            ['Providers', counts.providers],
            ['Learning paths', counts.paths],
          ].map(([label, value]) => (
            <div key={label} className="border-border bg-surface rounded-lg border p-4">
              <dt className="text-fg-subtle text-xs">{label}</dt>
              <dd className="text-fg mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {verification.unverified > 0 ? (
          <Callout tone="warn" className="mt-4" title="Most of the catalogue is not yet verified">
            {verification.unverified} of {counts.resources} resources are marked{' '}
            <strong className="text-fg font-semibold">unverified</strong>: their links were checked
            automatically, but no person has yet confirmed that each page still matches how we
            describe it. Entries say so individually, and none of them claims otherwise.
          </Callout>
        ) : null}
      </section>

      <section className="mt-12 max-w-[var(--measure)]" aria-labelledby="status">
        <h2 id="status" className="text-fg text-sm font-semibold">
          What works today
        </h2>
        <p className="text-fg-muted mt-2 text-sm leading-relaxed">
          The topic map and the methodology page are real. Search, filtering, bookmarks, progress
          tracking and learning paths are not built yet — there is no dashboard here because there
          is nothing yet to report on, and showing empty progress widgets would be a lie about what
          the site can do.
        </p>

        <ol className="mt-5 space-y-1.5">
          {roadmap.map(([phase, title, done]) => (
            <li key={phase} className="flex items-baseline gap-3 text-sm">
              <span
                aria-hidden="true"
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                  done ? 'bg-ok-subtle text-ok' : 'bg-surface-subtle text-fg-subtle'
                }`}
              >
                {phase}
              </span>
              <span className={done ? 'text-fg' : 'text-fg-subtle'}>
                {title}
                <span className="sr-only">{done ? ' (complete)' : ' (not started)'}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="text-fg-subtle mt-6 text-xs">
          Catalogue version {contentManifest.contentVersion}, generated{' '}
          {contentManifest.generatedAt}. Currently {topics.length} topics.
        </p>
      </section>
    </>
  )
}
