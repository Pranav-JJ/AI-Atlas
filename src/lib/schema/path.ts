import { z } from 'zod'

import { zHourRange, zId, zStatus } from './primitives.ts'

/**
 * One step in a module.
 *
 * `required` is load-bearing: it is the denominator of the progress calculation
 * (see computePathProgress and EDITORIAL_POLICY.md). Optional items are shown and
 * can be completed, but never move the progress bar.
 */
export const zPathItem = z
  .object({
    kind: z.enum(['resource', 'checkpoint']),
    resource_id: zId.nullable(),
    checkpoint: z
      .object({
        title: z.string().min(3).max(200),
        prompt: z.string().min(20).max(1000),
        how_to_self_assess: z.string().min(20).max(1000),
      })
      .strict()
      .nullable(),
    required: z.boolean(),
    order: z.number().int().positive(),
    /** Why this item is here, in this position. Ordering without reasons rots. */
    note: z.string().max(400).nullable(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.kind === 'resource') {
      if (item.resource_id === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['resource_id'],
          message: 'a "resource" item requires resource_id',
        })
      }
      if (item.checkpoint !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['checkpoint'],
          message: 'a "resource" item must not carry a checkpoint',
        })
      }
    }

    if (item.kind === 'checkpoint') {
      if (item.checkpoint === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['checkpoint'],
          message: 'a "checkpoint" item requires a checkpoint body',
        })
      }
      if (item.resource_id !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['resource_id'],
          message: 'a "checkpoint" item must not reference a resource',
        })
      }
    }
  })

/** Rule 11: item order must be unique and contiguous from 1 within a module. */
export const zModule = z
  .object({
    id: zId,
    title: z.string().min(3).max(200),
    summary: z.string().min(20).max(600),
    items: z.array(zPathItem).min(1),
  })
  .strict()
  .superRefine((module, ctx) => {
    const orders = module.items.map((i) => i.order).sort((a, b) => a - b)
    const expected = orders.map((_, index) => index + 1)

    if (orders.join(',') !== expected.join(',')) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: `item order must be unique and contiguous from 1; got [${orders.join(', ')}] (rule 11)`,
      })
    }
  })

export const zLearningPath = z
  .object({
    id: zId,
    title: z.string().min(3).max(200),
    audience: z.string().min(20).max(600),
    outcome_statement: z.string().min(20).max(600),
    prerequisites: z
      .object({
        topics: z.array(zId),
        description: z.string().min(10).max(600),
      })
      .strict(),
    /** A RANGE, never a point estimate. */
    estimated_hours: zHourRange,
    /** The assumptions behind that range, rendered next to it in the UI. */
    estimate_assumptions: z.string().min(20).max(600),
    modules: z.array(zModule).min(1),
    suggested_project_ids: z.array(zId),
    completion_criteria: z.string().min(10).max(400),
    next_path_ids: z.array(zId),
    status: zStatus,
  })
  .strict()

export type PathItem = z.infer<typeof zPathItem>
export type Module = z.infer<typeof zModule>
export type LearningPath = z.infer<typeof zLearningPath>
