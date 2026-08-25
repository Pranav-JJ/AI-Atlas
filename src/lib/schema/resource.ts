import { z } from 'zod'

import {
  zAccessRequirement,
  zCostType,
  zDifficulty,
  zFormat,
  zHttpsUrl,
  zId,
  zIsoDate,
  zLanguage,
  zModality,
  zPeerReviewStatus,
  zResourceType,
  zStatus,
  zTheoryVsPractice,
} from './primitives.ts'

/**
 * The fields every catalogue entry carries, whatever its type.
 *
 * Datasets and papers are SPECIALISATIONS of this base rather than separate
 * things, so they appear in the unified library and all of its filters for free
 * while still supporting domain-specific metadata.
 */
const resourceBaseShape = {
  id: zId,
  title: z.string().min(3).max(200),
  description: z.string().min(20).max(600),

  /** Rule 4/6: https only, and null means "no verified link yet". */
  url: zHttpsUrl.nullable(),

  resource_type: zResourceType,
  provider_id: zId.nullable(),
  author: z.string().min(1).max(200).nullable(),

  topics: z.array(zId).min(1, 'every resource must belong to at least one topic'),
  subtopics: z.array(zId),

  difficulty: zDifficulty,
  estimated_duration_minutes: z.number().int().positive().nullable(),
  format: zFormat,
  cost_type: zCostType,
  language: zLanguage,

  prerequisites: z
    .object({
      topics: z.array(zId),
      resources: z.array(zId),
    })
    .strict(),

  source_date: zIsoDate.nullable(),
  last_verified_at: zIsoDate.nullable(),
  verified_by: z.string().min(1).max(120).nullable(),

  /** Our assessment, always distinguishable from what the source claims. */
  quality_notes: z.string().max(600).nullable(),

  /** Rule 7: if we cannot say why it is useful, it does not belong here. */
  why_useful: z
    .string()
    .min(40, 'must be at least 40 characters — state why this resource earns its place')
    .max(600),

  learning_outcomes: z.array(z.string().min(5).max(200)).max(8),

  is_beginner_friendly: z.boolean(),
  is_project_based: z.boolean(),
  has_certificate: z.boolean(),
  theory_vs_practice: zTheoryVsPractice,

  status: zStatus,
  added_at: zIsoDate,
}

/**
 * Rules 5 and 6 — the two rules that stop the catalogue from ever presenting
 * unchecked metadata as authoritative. These are the reason the "no invented
 * URLs" policy is a build failure rather than a convention someone can forget.
 */
function applyVerificationRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const record = value as {
      url: string | null
      status: string
      last_verified_at: string | null
      verified_by: string | null
    }

    // Rule 5: claiming "verified" requires the evidence of a verification.
    if (record.status === 'verified') {
      if (record.url === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'status "verified" requires a url (rule 5)',
        })
      }
      if (record.last_verified_at === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['last_verified_at'],
          message: 'status "verified" requires last_verified_at (rule 5)',
        })
      }
      if (record.verified_by === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['verified_by'],
          message: 'status "verified" requires verified_by (rule 5)',
        })
      }
    }

    // Rule 6: with no link there is nothing that could have been checked.
    if (record.url === null && record.status !== 'unverified') {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: `a record with no url must have status "unverified", got "${record.status}" (rule 6)`,
      })
    }
  })
}

export const zResourceBase = applyVerificationRules(z.object(resourceBaseShape).strict())

/** Videos are first-class resources, not embedded decoration. */
export const zVideo = applyVerificationRules(
  z
    .object({
      ...resourceBaseShape,
      resource_type: z.literal('video'),
      channel: z.string().min(1).max(200).nullable(),
      playlist_url: zHttpsUrl.nullable(),
      is_part_of_course: z.boolean(),
      /** null means unknown, which the UI must treat as "link out, never embed". */
      embeddable: z.boolean().nullable(),
    })
    .strict(),
)

export const zDataset = applyVerificationRules(
  z
    .object({
      ...resourceBaseShape,
      resource_type: z.enum(['dataset', 'benchmark']),
      task: z.array(zId),
      domain: z.string().min(2).max(120).nullable(),
      modality: z.array(zModality).min(1),
      /** Free text: dataset sizes are reported too inconsistently to normalise. */
      size_description: z.string().max(200).nullable(),
      /**
       * Rule 14: never silently absent. Either an SPDX id / verbatim licence
       * string, or the explicit string "unknown" — which the UI surfaces as a
       * warning rather than hiding.
       */
      license: z.string().min(1).max(200),
      license_url: zHttpsUrl.nullable(),
      access_requirements: zAccessRequirement,
      sensitive_data_notes: z.string().max(1000).nullable(),
      known_limitations: z.array(z.string().min(5).max(300)),
      benchmark_tasks: z.array(
        z.object({ name: z.string().min(1).max(120), metric: z.string().min(1).max(80) }).strict(),
      ),
      documentation_url: zHttpsUrl.nullable(),
      access_instructions: z.string().max(1000).nullable(),
    })
    .strict(),
)

export const zPaper = applyVerificationRules(
  z
    .object({
      ...resourceBaseShape,
      resource_type: z.literal('paper'),
      authors: z.array(z.string().min(1).max(200)),
      year: z.number().int().min(1940).max(2100).nullable(),
      venue: z.string().min(1).max(200).nullable(),
      /** Rule 13: defaults to "unknown"; claiming peer review demands a venue. */
      peer_review_status: zPeerReviewStatus,
      /** What the SOURCE claims — a paraphrase of its abstract. */
      abstract_summary: z.string().max(1200).nullable(),
      /** What WE infer. The UI must render these two under distinct labels. */
      key_idea: z.string().max(800).nullable(),
      code_url: zHttpsUrl.nullable(),
      dataset_ids: z.array(zId),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.peer_review_status === 'peer-reviewed' && value.venue === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['venue'],
          message:
            'peer_review_status "peer-reviewed" requires a venue — do not assert peer review we cannot point at (rule 13)',
        })
      }
    }),
)

export type ResourceBase = z.infer<typeof zResourceBase>
export type Video = z.infer<typeof zVideo>
export type Dataset = z.infer<typeof zDataset>
export type Paper = z.infer<typeof zPaper>

/** Any catalogue entry, whichever collection it came from. */
export type AnyResource = ResourceBase | Video | Dataset | Paper
