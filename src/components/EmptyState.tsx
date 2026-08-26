import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  /** Say WHY it is empty and what would fill it — never just "No results". */
  description: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * Shown when a surface has nothing in it.
 *
 * Always explains the cause and offers a way forward. An empty state that only
 * says "nothing here" leaves the user unable to tell a broken page from a
 * working one with no matches.
 */
export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`border-border bg-surface flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center ${className}`}
    >
      <h3 className="text-fg text-base font-semibold">{title}</h3>
      <div className="text-fg-muted mt-2 max-w-prose text-sm leading-relaxed">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
