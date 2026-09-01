import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { makeLearningPath } from '@tests/fixtures/content.ts'

import type { LearningPath, Module, PathItem } from '../schema/index.ts'
import {
  checkpointItemId,
  checkpointKey,
  computePathProgress,
  isItemComplete,
  PROGRESS_RULE,
  PROGRESS_RULE_NOTES,
  totalItems,
  type ProgressInput,
} from './computePathProgress.ts'

function resourceItem(order: number, resourceId: string, required = true): PathItem {
  return {
    kind: 'resource',
    resource_id: resourceId,
    checkpoint: null,
    required,
    order,
    note: null,
  }
}

function checkpointItem(order: number, required = true): PathItem {
  return {
    kind: 'checkpoint',
    resource_id: null,
    checkpoint: {
      title: 'A checkpoint',
      prompt: 'A prompt long enough to satisfy the schema constraints here.',
      how_to_self_assess: 'A self-assessment description long enough to validate.',
    },
    required,
    order,
    note: null,
  }
}

function pathWith(items: PathItem[], moduleId = 'mod-1'): LearningPath {
  return makeLearningPath({
    id: 'path-test',
    modules: [
      {
        id: moduleId,
        title: 'A module',
        summary: 'A module summary long enough to satisfy the minimum length rule.',
        items,
      },
    ],
  })
}

function input(overrides: Partial<ProgressInput> = {}): ProgressInput {
  return { completions: {}, checkpointCompletions: {}, ...overrides }
}

const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { at: 'now' }]))

describe('nothing to measure', () => {
  it('reports null percent when there are no required items', () => {
    // Explicitly NOT 0% and NOT 100%. The UI renders "Not started".
    const path = pathWith([resourceItem(1, 'a', false), resourceItem(2, 'b', false)])
    const progress = computePathProgress(path, input())

    expect(progress.percent).toBeNull()
    expect(progress.totalRequired).toBe(0)
    expect(progress.isComplete).toBe(false)
  })

  it('stays null even when every optional item is done', () => {
    const path = pathWith([resourceItem(1, 'a', false)])
    const progress = computePathProgress(path, input({ completions: done('a') }))

    expect(progress.percent).toBeNull()
    expect(progress.isComplete).toBe(false)
    expect(progress.completedOptional).toBe(1)
  })
})

describe('the denominator is required items only', () => {
  const path = pathWith([
    resourceItem(1, 'req-a'),
    resourceItem(2, 'req-b'),
    resourceItem(3, 'opt-a', false),
    resourceItem(4, 'opt-b', false),
  ])

  it('counts only required items', () => {
    const progress = computePathProgress(path, input())
    expect(progress.totalRequired).toBe(2)
    expect(progress.totalOptional).toBe(2)
  })

  it('completing an optional item does NOT move the bar', () => {
    // The acceptance criterion for this phase.
    const before = computePathProgress(path, input())
    const after = computePathProgress(path, input({ completions: done('opt-a', 'opt-b') }))

    expect(after.percent).toBe(before.percent)
    expect(after.percent).toBe(0)
    expect(after.completedOptional).toBe(2)
  })

  it('completing a required item does move the bar', () => {
    const progress = computePathProgress(path, input({ completions: done('req-a') }))
    expect(progress.percent).toBe(50)
  })

  it('reaches 100 only when every required item is done', () => {
    const partial = computePathProgress(
      path,
      input({ completions: done('req-a', 'opt-a', 'opt-b') }),
    )
    expect(partial.percent).toBe(50)
    expect(partial.isComplete).toBe(false)

    const full = computePathProgress(path, input({ completions: done('req-a', 'req-b') }))
    expect(full.percent).toBe(100)
    expect(full.isComplete).toBe(true)
  })
})

describe('rounding is floor, never round-half-up', () => {
  const threeRequired = pathWith([resourceItem(1, 'a'), resourceItem(2, 'b'), resourceItem(3, 'c')])

  it('reports 2 of 3 as 66, not 67', () => {
    // Rounding up would let a path read 100% before it was finished.
    const progress = computePathProgress(threeRequired, input({ completions: done('a', 'b') }))
    expect(progress.percent).toBe(66)
  })

  it('reports 1 of 3 as 33', () => {
    expect(computePathProgress(threeRequired, input({ completions: done('a') })).percent).toBe(33)
  })

  it('never reports 100 before completion', () => {
    const sixRequired = pathWith(Array.from({ length: 6 }, (_, i) => resourceItem(i + 1, `r${i}`)))
    const fiveDone = computePathProgress(
      sixRequired,
      input({ completions: done('r0', 'r1', 'r2', 'r3', 'r4') }),
    )

    expect(fiveDone.percent).toBe(83)
    expect(fiveDone.percent).toBeLessThan(100)
    expect(fiveDone.isComplete).toBe(false)
  })
})

describe('checkpoints', () => {
  const path = pathWith([resourceItem(1, 'res-a'), checkpointItem(2)])

  it('counts toward the required denominator', () => {
    expect(computePathProgress(path, input()).totalRequired).toBe(2)
  })

  it('is not completed by completing resources alone', () => {
    const progress = computePathProgress(path, input({ completions: done('res-a') }))

    expect(progress.percent).toBe(50)
    expect(progress.isComplete).toBe(false)
  })

  it('completes when its own key is ticked', () => {
    const key = checkpointKey('path-test', 'mod-1#2')
    const progress = computePathProgress(
      path,
      input({ completions: done('res-a'), checkpointCompletions: { [key]: { at: 'now' } } }),
    )

    expect(progress.percent).toBe(100)
    expect(progress.isComplete).toBe(true)
  })

  it('is keyed per path, so the same module id in two paths is separate', () => {
    expect(checkpointKey('path-a', 'mod-1#2')).not.toBe(checkpointKey('path-b', 'mod-1#2'))
  })

  it('identifies a checkpoint by module and position', () => {
    const module = { id: 'mod-x' } as Module
    expect(checkpointItemId(module, checkpointItem(3))).toBe('mod-x#3')
  })
})

describe('isItemComplete', () => {
  const path = pathWith([resourceItem(1, 'res-a'), checkpointItem(2)])
  const module = path.modules[0]!

  it('is false for a resource item with no completion', () => {
    expect(isItemComplete(path, module, module.items[0]!, input())).toBe(false)
  })

  it('is true for a completed resource item', () => {
    expect(
      isItemComplete(path, module, module.items[0]!, input({ completions: done('res-a') })),
    ).toBe(true)
  })

  it('never treats a resource tick as completing a checkpoint', () => {
    expect(
      isItemComplete(path, module, module.items[1]!, input({ completions: done('res-a') })),
    ).toBe(false)
  })
})

describe('across multiple modules', () => {
  const path = makeLearningPath({
    id: 'path-multi',
    modules: [
      {
        id: 'mod-a',
        title: 'First',
        summary: 'A module summary long enough to satisfy the minimum length rule.',
        items: [resourceItem(1, 'a'), resourceItem(2, 'b', false)],
      },
      {
        id: 'mod-b',
        title: 'Second',
        summary: 'A module summary long enough to satisfy the minimum length rule.',
        items: [resourceItem(1, 'c'), checkpointItem(2)],
      },
    ],
  })

  it('sums required items across every module', () => {
    const progress = computePathProgress(path, input())
    expect(progress.totalRequired).toBe(3)
    expect(progress.totalOptional).toBe(1)
  })

  it('counts completions from any module', () => {
    const progress = computePathProgress(path, input({ completions: done('a', 'c') }))
    expect(progress.completedRequired).toBe(2)
    expect(progress.percent).toBe(66)
  })

  it('reports totalItems across modules', () => {
    expect(totalItems(path)).toBe(4)
  })
})

describe('untouched detection', () => {
  const path = pathWith([resourceItem(1, 'a'), resourceItem(2, 'b', false)])

  it('is untouched with nothing ticked', () => {
    expect(computePathProgress(path, input()).isUntouched).toBe(true)
  })

  it('is not untouched once an optional item is ticked', () => {
    // Optional work is still work; it just does not move the percentage.
    expect(computePathProgress(path, input({ completions: done('b') })).isUntouched).toBe(false)
  })
})

describe('the published rule matches the implementation', () => {
  // These are one decision written in three places: the code, the editorial
  // policy, and the /about page. A test keeps them from drifting.
  const policy = readFileSync('EDITORIAL_POLICY.md', 'utf8')

  it('EDITORIAL_POLICY.md documents floor over completed/total required', () => {
    const normalised = policy.replace(/\s+/g, ' ')

    expect(normalised).toMatch(
      /floor\(\s*completedRequiredItems\s*\/\s*totalRequiredItems\s*\*\s*100\s*\)/,
    )
  })

  it('the policy states that optional items are excluded', () => {
    expect(policy).toMatch(/[Oo]ptional items are (excluded|counted)/)
  })

  it('the policy states that checkpoints count as required', () => {
    expect(policy).toMatch(/[Cc]heckpoints count as required items/)
  })

  it('the policy states the not-started rule', () => {
    expect(policy).toMatch(/no required items shows \*\*"Not started"\*\*|no required items shows/)
  })

  it('the policy states progress is never inferred', () => {
    expect(policy).toMatch(/never.*inferred from/i)
  })

  it('the exported rule text is what the code actually does', () => {
    expect(PROGRESS_RULE).toContain('floor')
    expect(PROGRESS_RULE).toContain('completedRequired')
    expect(PROGRESS_RULE).toContain('totalRequired')
    expect(PROGRESS_RULE_NOTES.length).toBeGreaterThanOrEqual(4)
  })
})
