import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { ThemeToggle } from '@/components/index.ts'

/**
 * Primary navigation.
 *
 * ONLY routes that render real content appear here. Paths, Library and Progress
 * join as their phases land. A nav item leading to an empty stub is worse than
 * its absence: it promises a feature and then wastes the click proving it does
 * not exist.
 */
const PRIMARY_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/paths', label: 'Paths', end: false },
  { to: '/library', label: 'Library', end: false },
  { to: '/topics', label: 'Topics', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/about', label: 'Methodology', end: false },
] as const

/** Sections that exist as plans rather than pages, listed honestly in the footer. */
const PLANNED = ['Datasets', 'Projects', 'Glossary'] as const

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'rounded px-2.5 py-1.5 text-sm transition-colors',
    isActive ? 'text-fg font-medium' : 'text-fg-muted hover:text-fg',
  ].join(' ')
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="AI Atlas, home">
      <svg
        aria-hidden="true"
        focusable="false"
        width="24"
        height="24"
        viewBox="0 0 32 32"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" className="fill-accent" />
        <path
          d="M9 23L16 9l7 14"
          fill="none"
          className="stroke-accent-fg"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M12 19h8" className="stroke-accent-fg" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="text-fg text-base font-semibold tracking-tight">AI Atlas</span>
    </Link>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-dvh flex-col">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="border-border bg-bg/95 sticky top-0 z-[var(--z-header)] border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[var(--shell-max)] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />

          {/* Primary nav is in the header on tablet and up, and in a bottom bar on phones. */}
          <nav aria-label="Primary" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[var(--shell-max)] flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>

      <footer className="border-border mt-16 border-t pb-20 sm:pb-0">
        <div className="mx-auto max-w-[var(--shell-max)] px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div className="max-w-sm">
              <Logo />
              <p className="text-fg-muted mt-3 text-sm leading-relaxed">
                A curated, provenance-tracked learning atlas for AI, machine learning, deep
                learning, generative AI and NLP.
              </p>
            </div>

            <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
              <nav aria-label="Footer">
                <h2 className="text-fg text-sm font-semibold">Available now</h2>
                <ul className="mt-3 space-y-2">
                  {PRIMARY_NAV.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="text-fg-muted hover:text-fg text-sm underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div>
                <h2 className="text-fg text-sm font-semibold">Planned</h2>
                {/* Listed as text, not links: they do not exist yet. */}
                <ul className="text-fg-subtle mt-3 space-y-2 text-sm">
                  {PLANNED.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="text-fg-subtle border-border mt-10 border-t pt-6 text-xs leading-relaxed">
            Educational resource. Inclusion is not an endorsement or a guarantee of quality. Your
            progress is stored only in your own browser and is never transmitted. Read the{' '}
            <Link to="/about" className="underline underline-offset-2">
              methodology and source policy
            </Link>
            .
          </p>
        </div>
      </footer>

      {/* Mobile primary nav. Hidden from assistive tech to avoid announcing the
          same navigation twice; the header nav above is always in the DOM. */}
      <nav
        aria-hidden="true"
        className="border-border bg-bg fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t sm:hidden"
      >
        <ul className="flex">
          {PRIMARY_NAV.map((item) => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to)

            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  tabIndex={-1}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${
                    active ? 'text-fg font-medium' : 'text-fg-subtle'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
