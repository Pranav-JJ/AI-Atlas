import type { ReactNode } from 'react'

type CalloutTone = 'info' | 'warn' | 'danger'

const TONE: Record<CalloutTone, { wrapper: string; label: string }> = {
  info: { wrapper: 'border-border bg-surface-subtle', label: 'Note' },
  warn: { wrapper: 'border-warn/40 bg-warn-subtle', label: 'Important' },
  danger: { wrapper: 'border-danger/40 bg-danger-subtle', label: 'Warning' },
}

interface CalloutProps {
  children: ReactNode
  tone?: CalloutTone
  title?: string
  className?: string
}

/**
 * A block that interrupts reading on purpose: licence restrictions, unverified
 * metadata, limitations.
 *
 * `role="note"` rather than `role="alert"` — these are present on load and are
 * not urgent interruptions, and an alert would be announced over whatever the
 * user was already reading.
 */
export function Callout({ children, tone = 'info', title, className = '' }: CalloutProps) {
  const { wrapper, label } = TONE[tone]

  return (
    <aside
      role="note"
      aria-label={title ?? label}
      className={`rounded-lg border p-4 text-sm leading-relaxed ${wrapper} ${className}`}
    >
      {title ? <p className="text-fg mb-1 font-semibold">{title}</p> : null}
      <div className="text-fg-muted">{children}</div>
    </aside>
  )
}
