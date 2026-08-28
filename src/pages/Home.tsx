import { Link } from 'react-router'

import { Callout } from '@/components/index.ts'
import { contentManifest, topics } from '@/content/generated/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { GOAL_LABELS } from '@/lib/storage/schema.ts'
import { useUserStore } from '@/lib/storage/store.ts'

const ONBOARDING_NOTICE = 'onboarding-prompt'

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

  const profile = useUserStore((s) => s.profile)
  const savedCount = useUserStore((s) => Object.keys(s.bookmarks).length)
  const doneCount = useUserStore((s) => Object.keys(s.completions).length)
  const dismissed = useUserStore((s) => s.dismissedNotices.includes(ONBOARDING_NOTICE))
  const dismissNotice = useUserStore((s) => s.dismissNotice)

  const hasProfile = profile.level !== null || profile.goal !== null
  const hasActivity = savedCount > 0 || doneCount > 0

  const roadmap: Array<[string, string, boolean]> = [
    ['0', 'Toolchain', true],
    ['1', 'Deployment pipeline', true],
    ['2', 'Content pipeline', true],
    ['3', 'Design system and topic map', true],
    ['4', 'Resource library with search and filters', true],
    ['5', 'Bookmarks and progress', true],
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

      {!hasProfile && !dismissed ? (
        <section
          className="border-border bg-surface mt-10 max-w-[var(--measure)] rounded-lg border p-5"
          aria-labelledby="get-started"
        >
          <h2 id="get-started" className="text-fg text-base font-semibold">
            Tell the atlas where you are starting
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            Two optional questions. They tune what gets recommended and how resources are ordered.
            Everything stays in this browser, and nothing on the site is locked behind them.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              to="/onboarding"
              className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              Set your starting point
            </Link>
            <button
              type="button"
              onClick={() => dismissNotice(ONBOARDING_NOTICE)}
              className="text-fg-muted text-sm underline underline-offset-2"
            >
              Not now
            </button>
          </div>
        </section>
      ) : null}

      {hasProfile || hasActivity ? (
        <section className="mt-10 max-w-[var(--measure)]" aria-labelledby="your-state">
          <h2 id="your-state" className="text-fg text-sm font-semibold">
            Where you are
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            {profile.level ? (
              <>
                Level <span className="text-fg capitalize">{profile.level}</span>.{' '}
              </>
            ) : null}
            {profile.goal ? (
              <>
                Goal <span className="text-fg">{GOAL_LABELS[profile.goal]}</span>.{' '}
              </>
            ) : null}
            {/* Counts, never a completion percentage: the catalogue is curated
                and incomplete, so a percentage would imply mastery. */}
            {savedCount} saved, {doneCount} marked done.{' '}
            <Link to="/progress" className="text-accent underline underline-offset-2">
              See your progress
            </Link>
          </p>
        </section>
      ) : null}

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
          The library, topic map, bookmarks and progress tracking are real. Learning paths and the
          full dashboard are not built yet — there is no dashboard here because there are no paths
          yet to report progress against, and a progress bar with nothing behind it would be a lie
          about what the site can do.
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
