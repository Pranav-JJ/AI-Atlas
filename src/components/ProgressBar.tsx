import { Link } from 'react-router'

import { PROGRESS_RULE, PROGRESS_RULE_NOTES } from '@/lib/selectors/computePathProgress.ts'
import type { PathProgress } from '@/lib/selectors/computePathProgress.ts'

interface ProgressBarProps {
  progress: PathProgress
  /** Names the thing being measured, for the accessible label. */
  label: string
  /** Show the rule and the optional-item count beneath the bar. */
  showDetail?: boolean
}

/**
 * A path's progress.
 *
 * Deliberately built LAST, in the phase that defines the rule it renders. A
 * progress bar written before its calculation exists is a bar that shows
 * whatever happens to be convenient.
 *
 * When there is nothing to measure it renders "Not started" and NO bar at all —
 * an empty bar reads as "0% done", which is a different and unsupported claim.
 */
export function ProgressBar({ progress, label, showDetail = false }: ProgressBarProps) {
  const { percent, completedRequired, totalRequired, completedOptional, totalOptional } = progress

  if (percent === null) {
    return (
      <div>
        <p className="text-fg-muted text-sm">
          <span className="text-fg font-medium">Not started</span>
          <span className="text-fg-subtle"> · this path has no required items to measure</span>
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-fg text-sm font-medium tabular-nums">
          {percent}%
          <span className="text-fg-muted ml-2 font-normal">
            {completedRequired} of {totalRequired} required
            {totalRequired === 1 ? ' item' : ' items'}
          </span>
        </p>

        {totalOptional > 0 ? (
          /* Shown separately, never folded into the percentage. */
          <p className="text-fg-subtle text-xs tabular-nums">
            +{completedOptional} of {totalOptional} optional
          </p>
        ) : null}
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${completedRequired} of ${totalRequired} required items complete`}
        className="bg-surface-subtle mt-2 h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-accent h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      {showDetail ? (
        <details className="mt-3">
          <summary className="text-fg-subtle hover:text-fg-muted cursor-pointer text-xs">
            How this is calculated
          </summary>

          <div className="text-fg-muted mt-2 space-y-2 text-xs leading-relaxed">
            <p className="bg-surface-subtle border-border text-fg rounded border p-2 font-mono">
              {PROGRESS_RULE}
            </p>
            <ul className="list-disc space-y-1 pl-4">
              {PROGRESS_RULE_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p>
              <Link to="/about" className="text-accent underline underline-offset-2">
                The full methodology
              </Link>
            </p>
          </div>
        </details>
      ) : null}
    </div>
  )
}
