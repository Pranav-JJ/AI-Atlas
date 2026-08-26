import type { ReactNode } from 'react'

interface ExternalLinkProps {
  href: string
  children: ReactNode
  className?: string
  /** Hide the trailing icon where the context already makes the target obvious. */
  hideIcon?: boolean
}

/**
 * A link that leaves the site.
 *
 * Always sets rel="noopener noreferrer" — an ESLint rule enforces this project
 * wide, and this component is the sanctioned way to satisfy it. Without it, the
 * opened page can reach back through window.opener and navigate this tab
 * somewhere else (tabnabbing).
 *
 * The destination is announced to screen readers, because "opens in a new tab"
 * is information a sighted user gets from the icon and nobody else gets at all.
 */
export function ExternalLink({
  href,
  children,
  className = '',
  hideIcon = false,
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-accent hover:text-accent-hover inline-flex items-baseline gap-1 underline underline-offset-2 ${className}`}
    >
      <span>{children}</span>
      {!hideIcon ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="translate-y-px shrink-0"
        >
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      ) : null}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
