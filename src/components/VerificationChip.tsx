import type { Status } from '@/lib/schema/index.ts'

import { Badge, type Tone } from './Badge.tsx'

interface StatusPresentation {
  tone: Tone
  label: string
  /** Read by assistive tech, and used as the tooltip. Must never overstate. */
  explanation: string
}

/**
 * How each verification state is presented.
 *
 * The wording is deliberate and is the product's central honesty commitment: an
 * unverified record says nobody has checked it, rather than saying nothing and
 * letting the reader assume it was checked. See EDITORIAL_POLICY.md.
 */
const PRESENTATION: Record<Status, StatusPresentation> = {
  verified: {
    tone: 'ok',
    label: 'Verified',
    explanation: 'A person opened this link and confirmed its details on the date shown.',
  },
  unverified: {
    tone: 'warn',
    label: 'Unverified',
    explanation:
      'Nobody has opened this link and checked it yet. Treat the details as provisional.',
  },
  stale: {
    tone: 'warn',
    label: 'Needs re-checking',
    explanation: 'Last verified more than 180 days ago, so the details may be out of date.',
  },
  broken: {
    tone: 'danger',
    label: 'Link broken',
    explanation: 'This link was reported dead, so it has been disabled.',
  },
  deprecated: {
    tone: 'neutral',
    label: 'Deprecated',
    explanation: 'Superseded or withdrawn by its author.',
  },
}

interface VerificationChipProps {
  status: Status
  /** ISO date. Shown only for `verified` and `stale`, where it means something. */
  lastVerifiedAt?: string | null
  className?: string
}

export function VerificationChip({
  status,
  lastVerifiedAt = null,
  className = '',
}: VerificationChipProps) {
  const { tone, label, explanation } = PRESENTATION[status]
  const showDate = (status === 'verified' || status === 'stale') && lastVerifiedAt !== null

  return (
    <Badge
      tone={tone}
      className={className}
      srLabel={`${explanation}${showDate ? ` Last verified ${lastVerifiedAt}.` : ''}`}
    >
      <span title={explanation}>
        {label}
        {showDate ? (
          <span className="text-fg-subtle ml-1 font-normal">{lastVerifiedAt}</span>
        ) : null}
      </span>
    </Badge>
  )
}

export { PRESENTATION as VERIFICATION_PRESENTATION }
