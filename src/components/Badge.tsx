import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-subtle text-fg-muted',
  accent: 'bg-accent-subtle text-accent',
  ok: 'bg-ok-subtle text-ok',
  warn: 'bg-warn-subtle text-warn',
  danger: 'bg-danger-subtle text-danger',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  /**
   * Text read by a screen reader in place of the visible label, for badges whose
   * meaning is obvious visually but not in isolation — "Free" is clear on a card,
   * "free to access" is clearer when read out of context.
   */
  srLabel?: string
  className?: string
}

/**
 * A small, non-interactive label: resource type, difficulty, cost.
 *
 * Colour is never the only signal — every badge carries text, so the meaning
 * survives greyscale, colour blindness and a screen reader.
 */
export function Badge({ children, tone = 'neutral', srLabel, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
      <span aria-hidden={srLabel ? true : undefined}>{children}</span>
    </span>
  )
}
