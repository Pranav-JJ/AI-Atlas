import { z } from 'zod'

/**
 * Shared field types and enumerations for the content model.
 *
 * These are the single source of truth: TypeScript types are INFERRED from these
 * schemas (`z.infer`), never hand-written alongside them. A hand-written type
 * that drifts from its validator is the classic way a content pipeline starts
 * lying about its own data.
 */

/** Stable, URL-safe identifier. Kebab-case, never reused once published. */
export const zId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case (lowercase letters, digits and hyphens)')

/** ISO calendar date, e.g. "2026-08-25". Times are never needed here. */
export const zIsoDate = z.iso.date()

/**
 * Rule 4: external links must be https, with no credentials embedded.
 *
 * `protocol: /^https$/` rejects http:, javascript:, data: and file: outright.
 * The extra refinement blocks `https://user:pass@host`, which would leak a
 * credential into a public static bundle.
 */
export const zHttpsUrl = z
  .url({
    protocol: /^https$/,
    hostname: /^[a-zA-Z0-9.-]+$/,
    error:
      'must be an absolute https:// URL (rule 4) — http, javascript:, data: and relative links are rejected',
  })
  .refine((value) => !/^https:\/\/[^/@]*@/.test(value), {
    message: 'must not embed credentials such as user:pass@host (rule 4)',
  })

/** BCP-47 language tag, e.g. "en", "en-GB", "pt-BR". */
export const zLanguage = z
  .string()
  .regex(
    /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
    'must be a BCP-47 language tag such as "en" or "pt-BR"',
  )

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export const zDifficulty = z.enum(DIFFICULTIES)

export const COST_TYPES = ['free', 'freemium', 'paid', 'free-with-registration'] as const
export const zCostType = z.enum(COST_TYPES)

export const FORMATS = ['text', 'video', 'audio', 'interactive', 'code'] as const
export const zFormat = z.enum(FORMATS)

export const THEORY_VS_PRACTICE = ['theory', 'balanced', 'practice'] as const
export const zTheoryVsPractice = z.enum(THEORY_VS_PRACTICE)

export const RESOURCE_TYPES = [
  'video',
  'course',
  'book',
  'tutorial',
  'documentation',
  'paper',
  'article',
  'dataset',
  'benchmark',
  'library',
  'model-hub',
  'notebook',
  'project',
  'community',
  'podcast',
] as const
export const zResourceType = z.enum(RESOURCE_TYPES)

/**
 * Verification lifecycle.
 *
 *   unverified  added, but nobody has opened the link and checked the metadata
 *   verified    a person confirmed the link, title, cost and difficulty, on a date
 *   stale       verified more than STALE_AFTER_DAYS ago (applied automatically)
 *   broken      link reported dead; the UI disables it rather than letting it fail
 *   deprecated  superseded or withdrawn by its author
 */
export const STATUSES = ['unverified', 'verified', 'stale', 'broken', 'deprecated'] as const
export const zStatus = z.enum(STATUSES)

/** Rule 9: a verification older than this is no longer trustworthy. */
export const STALE_AFTER_DAYS = 180

export const PROVIDER_KINDS = ['official', 'academic', 'commercial', 'community'] as const
export const zProviderKind = z.enum(PROVIDER_KINDS)

export const DOMAINS = [
  'foundations',
  'machine-learning',
  'deep-learning',
  'nlp',
  'genai-llm-apps',
  'mlops-production',
] as const
export const zDomain = z.enum(DOMAINS)

export const MODALITIES = [
  'text',
  'image',
  'audio',
  'video',
  'tabular',
  'timeseries',
  'multimodal',
] as const
export const zModality = z.enum(MODALITIES)

export const ACCESS_REQUIREMENTS = [
  'open',
  'registration',
  'request',
  'research-only',
  'restricted',
  'unknown',
] as const
export const zAccessRequirement = z.enum(ACCESS_REQUIREMENTS)

export const PEER_REVIEW_STATUSES = ['peer-reviewed', 'preprint', 'unknown'] as const
export const zPeerReviewStatus = z.enum(PEER_REVIEW_STATUSES)

/** An inclusive estimate range. Never a single number — see EDITORIAL_POLICY.md. */
export const zHourRange = z
  .object({
    min: z.number().positive(),
    max: z.number().positive(),
  })
  .strict()
  .refine((r) => r.min <= r.max, { message: 'min must be less than or equal to max' })

export type Difficulty = z.infer<typeof zDifficulty>
export type CostType = z.infer<typeof zCostType>
export type Format = z.infer<typeof zFormat>
export type TheoryVsPractice = z.infer<typeof zTheoryVsPractice>
export type ResourceType = z.infer<typeof zResourceType>
export type Status = z.infer<typeof zStatus>
export type ProviderKind = z.infer<typeof zProviderKind>
export type Domain = z.infer<typeof zDomain>
export type Modality = z.infer<typeof zModality>
export type AccessRequirement = z.infer<typeof zAccessRequirement>
export type PeerReviewStatus = z.infer<typeof zPeerReviewStatus>
export type HourRange = z.infer<typeof zHourRange>
