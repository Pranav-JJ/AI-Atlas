import { Link } from 'react-router'

/**
 * Phase 0/1 build-status page.
 *
 * Deliberately NOT a placeholder dashboard: the working rules forbid UI that
 * implies features which do not exist. It states what is built and what is not,
 * and is replaced by the real dashboard in Phase 6.
 */
export function Home() {
  const status: Array<[string, string]> = [
    ['Framework', 'Vite + React + TypeScript'],
    ['Styling', 'Tailwind v4 over CSS tokens'],
    ['Base path', import.meta.env.BASE_URL],
    ['Mode', import.meta.env.MODE],
  ]

  const roadmap: Array<[string, string, boolean]> = [
    ['0', 'Toolchain bootstrap', true],
    ['1', 'GitHub Pages pipeline', true],
    ['2', 'Content schema and validation', false],
    ['3', 'Design system and app shell', false],
    ['4', 'Resource library', false],
    ['5', 'Bookmarks and progress state', false],
    ['6', 'Dashboard', false],
    ['7', 'Learning paths', false],
  ]

  return (
    <>
      <p className="text-fg-subtle font-mono text-sm tracking-wide uppercase">Phase 1</p>

      <h1 className="text-fg mt-2 text-4xl font-semibold tracking-tight">AI Atlas</h1>

      <p className="text-fg-muted mt-4 text-lg leading-relaxed">
        A curated, provenance-tracked learning atlas for AI, machine learning, deep learning,
        generative AI and NLP.
      </p>

      <div className="border-border bg-surface mt-10 rounded-lg border p-6">
        <h2 className="text-fg text-sm font-semibold">Scaffold status</h2>
        <p className="text-fg-muted mt-2 text-sm leading-relaxed">
          The toolchain and deployment pipeline are in place. No content, search or progress
          tracking exists yet. This page exists so the build, tests and deployment can be verified
          against something real.
        </p>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {status.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-fg-subtle">{label}</dt>
              <dd className="text-fg text-right font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2 className="text-fg mt-10 text-sm font-semibold">Roadmap</h2>
      <ol className="mt-3 space-y-1.5">
        {roadmap.map(([phase, title, done]) => (
          <li key={phase} className="flex items-baseline gap-3 text-sm">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                done ? 'bg-ok-subtle text-ok' : 'bg-surface-subtle text-fg-subtle'
              }`}
              aria-hidden="true"
            >
              {phase}
            </span>
            <span className={done ? 'text-fg' : 'text-fg-subtle'}>
              Phase {phase}: {title}
              {done && <span className="sr-only"> (complete)</span>}
              {!done && <span className="sr-only"> (not started)</span>}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-fg-subtle mt-10 text-sm">
        Read the{' '}
        <Link to="/about" className="text-accent underline underline-offset-2">
          methodology and source policy
        </Link>{' '}
        for how resources are selected, verified, and ranked.
      </p>
    </>
  )
}
