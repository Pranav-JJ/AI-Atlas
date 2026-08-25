import { z } from 'zod'

import { zId } from './primitives.ts'

/**
 * A concept page, built for progressive disclosure.
 *
 * `plain_definition` is always visible; everything below it is revealed on
 * demand. A beginner should never have to read the technical explanation to get
 * a usable answer, and a practitioner should never be stuck with only the
 * simplified one.
 */
export const zGlossaryTerm = z
  .object({
    id: zId,
    term: z.string().min(2).max(120),
    aliases: z.array(z.string().min(1).max(120)),

    /** At most two sentences, no jargon. Enforced by length, reviewed by a human. */
    plain_definition: z.string().min(20).max(400),
    technical_explanation: z.string().min(40).max(2000),
    example: z.string().max(1200).nullable(),
    formula_latex: z.string().max(600).nullable(),
    code_example: z
      .object({
        language: z.string().min(1).max(40),
        code: z.string().min(1).max(2000),
      })
      .strict()
      .nullable(),
    /** The wrong mental model people actually arrive with. */
    common_misconception: z.string().max(800).nullable(),

    related_term_ids: z.array(zId),
    topics: z.array(zId).min(1),
    resource_ids: z.array(zId),
  })
  .strict()

export type GlossaryTerm = z.infer<typeof zGlossaryTerm>
