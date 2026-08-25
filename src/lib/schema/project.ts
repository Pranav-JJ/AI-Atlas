import { z } from 'zod'

import { zDifficulty, zHourRange, zId } from './primitives.ts'

/**
 * A project a single learner can realistically finish on their own laptop.
 *
 * `requires_gpu` defaults to false and is surfaced as a badge when true: the
 * catalogue is useless if half its projects quietly assume rented hardware.
 */
export const zProject = z
  .object({
    id: zId,
    title: z.string().min(3).max(200),
    problem_statement: z.string().min(40).max(1200),
    learning_objectives: z.array(z.string().min(10).max(200)).min(1).max(8),
    topics: z.array(zId).min(1),
    difficulty: zDifficulty,
    recommended_dataset_ids: z.array(zId),
    suggested_tools: z.array(z.string().min(1).max(80)),
    expected_output: z.string().min(20).max(600),
    milestones: z.array(z.string().min(10).max(300)).min(2),
    evaluation_approach: z.string().min(20).max(800),
    stretch_goals: z.array(z.string().min(10).max(300)),
    /** What actually goes wrong. Omitting these is how tutorials mislead. */
    common_failure_modes: z.array(z.string().min(10).max(300)).min(1),
    estimated_effort_hours: zHourRange,
    responsible_use_notes: z.string().min(20).max(800),
    requires_gpu: z.boolean(),
  })
  .strict()

export type Project = z.infer<typeof zProject>
