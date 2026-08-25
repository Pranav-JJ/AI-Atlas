import { z } from 'zod'

import { zDomain, zHttpsUrl, zId, zProviderKind } from './primitives.ts'

/**
 * A node in the topic map.
 *
 * The hierarchy is DATA, not code: adding or re-parenting a topic is a JSON edit.
 * `prerequisiteTopics` is what allows multiple entry points — a software engineer
 * can start at machine-learning without walking foundations first, and the UI can
 * still tell them what they are skipping.
 */
export const zTopic = z
  .object({
    id: zId,
    name: z.string().min(2).max(120),
    domain: zDomain,
    /** null for a domain root. Must reference an existing topic otherwise. */
    parentId: zId.nullable(),
    short_definition: z.string().min(20).max(400),
    prerequisiteTopics: z.array(zId),
    /** Display order among siblings. */
    order: z.number().int().nonnegative(),
  })
  .strict()

export const zProvider = z
  .object({
    id: zId,
    name: z.string().min(2).max(160),
    /**
     * Drives both ranking and labelling. "community" material is included when
     * it is genuinely good, but is always shown as community-created rather than
     * passed off as official.
     */
    kind: zProviderKind,
    site_url: zHttpsUrl.nullable(),
  })
  .strict()

export type Topic = z.infer<typeof zTopic>
export type Provider = z.infer<typeof zProvider>
