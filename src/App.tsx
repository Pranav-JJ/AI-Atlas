/**
 * Phase 0 scaffold.
 *
 * This is deliberately NOT a placeholder dashboard. Per the working rules, the app
 * should not show UI that implies features which do not exist yet. It renders an
 * honest build-status page that proves the toolchain, token layer, theming and
 * accessibility baseline are wired correctly — and says exactly that.
 *
 * It is replaced by the real app shell in Phase 3.
 */
export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <main
        id="main"
        className="mx-auto flex min-h-dvh max-w-[var(--measure)] flex-col justify-center px-6 py-16"
      >
        <p className="text-fg-subtle font-mono text-sm tracking-wide uppercase">Phase 0</p>

        <h1 className="text-fg mt-2 text-4xl font-semibold tracking-tight">AI Atlas</h1>

        <p className="text-fg-muted mt-4 text-lg leading-relaxed">
          A curated, provenance-tracked learning atlas for AI, machine learning, deep learning,
          generative AI and NLP.
        </p>

        <div className="border-border bg-surface mt-10 rounded-lg border p-6">
          <h2 className="text-fg text-sm font-semibold">Scaffold status</h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed">
            The toolchain is in place. No content, routes, search or progress tracking exist yet —
            those arrive in Phases 2 through 7. This page exists so the build, type checks, tests
            and deployment can be verified against something real.
          </p>

          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ['Framework', 'Vite + React + TypeScript'],
              ['Styling', 'Tailwind v4 over CSS tokens'],
              ['Base path', import.meta.env.BASE_URL],
              ['Mode', import.meta.env.MODE],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-fg-subtle">{label}</dt>
                <dd className="text-fg font-mono text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-fg-subtle mt-8 text-sm">
          Light and dark themes follow your system setting. An explicit toggle lands in Phase 3.
        </p>
      </main>
    </>
  )
}
