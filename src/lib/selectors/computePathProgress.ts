import type { LearningPath, Module, PathItem } from '../schema/index.ts'

/**
 * The one progress calculation.
 *
 * This is a product promise, not an implementation detail, and it is written
 * out in EDITORIAL_POLICY.md and on /about in the same words:
 *
 *     progress = floor(completedRequired / totalRequired * 100)
 *
 *   - Only `required: true` items count toward the denominator. Optional items
 *     are tracked and displayed, but completing one never moves the bar.
 *   - Checkpoints count as required items — you self-assess and tick them.
 *   - A path with NO required items has nothing to measure: percent is null and
 *     the UI says "Not started", never 0% or 100%.
 *   - Progress is never inferred from views, scroll depth or time on page. Only
 *     an explicit tick counts, which is enforced where completion is set.
 *
 * Rounding is FLOOR, deliberately: 2 of 3 items is 66%, never 67%. Rounding up
 * would let a path read 100% before it was finished.
 */

/** The storage key for a checkpoint tick. Must match the user store. */
export function checkpointKey(pathId: string, itemId: string): string {
  return `${pathId}::${itemId}`
}

/**
 * A checkpoint has no id of its own in the schema, so it is identified by its
 * module and position — stable as long as the module is not reordered, which
 * would change what the checkpoint IS.
 */
export function checkpointItemId(module: Module, item: PathItem): string {
  return `${module.id}#${item.order}`
}

export interface PathProgress {
  /**
   * 0–100, floored. Null when there is nothing to measure, which the UI must
   * render as "Not started" rather than as zero.
   */
  percent: number | null
  completedRequired: number
  totalRequired: number
  /** Counted and shown separately. Never part of the percentage. */
  completedOptional: number
  totalOptional: number
  /** True only when every required item is done, and there is at least one. */
  isComplete: boolean
  /** True when nothing at all has been ticked. */
  isUntouched: boolean
}

export interface ProgressInput {
  completions: Readonly<Record<string, unknown>>
  checkpointCompletions: Readonly<Record<string, unknown>>
}

/** Whether one item counts as done, whichever kind it is. */
export function isItemComplete(
  path: LearningPath,
  module: Module,
  item: PathItem,
  input: ProgressInput,
): boolean {
  if (item.kind === 'checkpoint') {
    return (
      input.checkpointCompletions[checkpointKey(path.id, checkpointItemId(module, item))] !==
      undefined
    )
  }

  return item.resource_id !== null && input.completions[item.resource_id] !== undefined
}

export function computePathProgress(path: LearningPath, input: ProgressInput): PathProgress {
  let completedRequired = 0
  let totalRequired = 0
  let completedOptional = 0
  let totalOptional = 0

  for (const module of path.modules) {
    for (const item of module.items) {
      const done = isItemComplete(path, module, item, input)

      if (item.required) {
        totalRequired += 1
        if (done) completedRequired += 1
      } else {
        totalOptional += 1
        if (done) completedOptional += 1
      }
    }
  }

  const percent = totalRequired === 0 ? null : Math.floor((completedRequired / totalRequired) * 100)

  return {
    percent,
    completedRequired,
    totalRequired,
    completedOptional,
    totalOptional,
    isComplete: totalRequired > 0 && completedRequired === totalRequired,
    isUntouched: completedRequired === 0 && completedOptional === 0,
  }
}

/**
 * The rule, in the exact words shown to users.
 *
 * Exported so the UI cannot drift from the implementation, and so a test can
 * assert this text also appears in EDITORIAL_POLICY.md.
 */
export const PROGRESS_RULE = 'progress = floor(completedRequired / totalRequired × 100)'

export const PROGRESS_RULE_NOTES = [
  'Only required items count. Completing an optional one never moves the bar.',
  'Checkpoints count as required items — you tick them yourself.',
  'A path with no required items shows “Not started”, never 0% or 100%.',
  'Progress is never inferred from opening a link, scrolling, or time spent.',
] as const

/** Total estimated items, for "N of M" style summaries. */
export function totalItems(path: LearningPath): number {
  return path.modules.reduce((sum, module) => sum + module.items.length, 0)
}
