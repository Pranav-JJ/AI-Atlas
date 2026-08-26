import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface ChipProps {
  children: ReactNode
  /** When given, the chip becomes a link. Otherwise it is inert text. */
  to?: string
  className?: string
}

/**
 * A compact, usually navigable tag — most often a topic.
 *
 * Interactive chips are real links, not divs with click handlers, so they are
 * focusable, announced correctly, and openable in a new tab.
 */
export function Chip({ children, to, className = '' }: ChipProps) {
  const base =
    'inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs whitespace-nowrap'

  if (to) {
    return (
      <Link
        to={to}
        className={`${base} text-fg-muted hover:border-border-strong hover:text-fg transition-colors ${className}`}
      >
        {children}
      </Link>
    )
  }

  return <span className={`${base} text-fg-muted ${className}`}>{children}</span>
}
