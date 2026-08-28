import { z } from 'zod'

import { zDifficulty, zId, zIsoDate } from '../schema/primitives.ts'

/**
 * Everything AI Atlas remembers about you.
 *
 * All of it lives in YOUR browser and is never transmitted. There are no
 * accounts, so this file is the complete extent of what the product knows.
 *
 * Validated with Zod on every read: this data is user-editable, arrives from
 * older versions of the app, and can be corrupted by anything sharing the
 * origin. A bad value must degrade to the default, never crash the page.
 */

/** Bumped only for a change existing data cannot be read into. See migrations.ts. */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * One key, versioned INSIDE the payload rather than in the key name.
 *
 * The plan called for `ai-atlas:v1`. Encoding the version in the key means a
 * schema bump silently orphans everyone's progress unless someone remembers to
 * read the old key too. Keeping one stable key forces migration to be explicit,
 * which is the safer default for data we cannot recover.
 */
export const STORAGE_KEY = 'ai-atlas:state'

/** What the learner said they want, used to tailor recommendations. */
export const GOALS = [
  'start-from-scratch',
  'engineer-to-ml',
  'nlp-practitioner',
  'build-llm-apps',
  'production-mlops',
  'research-ready',
] as const

export const zGoal = z.enum(GOALS)
export type Goal = z.infer<typeof zGoal>

export const GOAL_LABELS: Record<Goal, string> = {
  'start-from-scratch': 'Start from scratch',
  'engineer-to-ml': 'Move into AI/ML as a software engineer',
  'nlp-practitioner': 'Work with language and NLP',
  'build-llm-apps': 'Build applications on top of LLMs',
  'production-mlops': 'Run AI systems in production',
  'research-ready': 'Get ready to read and do research',
}

export const GOAL_DESCRIPTIONS: Record<Goal, string> = {
  'start-from-scratch':
    'Python, maths and statistics first, then machine learning fundamentals with plenty of practice.',
  'engineer-to-ml':
    'Skip ahead to modelling and evaluation, then production concerns. Assumes you can already write code.',
  'nlp-practitioner':
    'Tokenisation, embeddings, transformers, retrieval and evaluation, in that order.',
  'build-llm-apps':
    'Prompting, structured outputs, retrieval-augmented generation, evaluation and guardrails.',
  'production-mlops':
    'Pipelines, packaging, serving, monitoring and governance for systems other people depend on.',
  'research-ready': 'Papers, benchmarks, reproducibility and the maths to follow them.',
}

const zTimestamped = z.object({ at: z.iso.datetime() }).strict()

export const zProfile = z
  .object({
    level: zDifficulty.nullable(),
    goal: zGoal.nullable(),
    /** Null means no target set — distinct from a target of zero. */
    weeklyTargetMinutes: z.number().int().positive().nullable(),
    updatedAt: z.iso.datetime().nullable(),
  })
  .strict()

export const zRecentlyViewed = z
  .object({
    resourceId: zId,
    viewedAt: z.iso.datetime(),
  })
  .strict()

/** Cap on the recents list. Small on purpose: it is a "where was I", not a log. */
export const RECENTLY_VIEWED_LIMIT = 20

export const zPersistedState = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    profile: zProfile,
    /** resourceId -> when it was ticked. */
    completions: z.record(zId, zTimestamped),
    /** `${pathId}::${itemId}` -> when it was ticked. Used from Phase 7. */
    checkpointCompletions: z.record(z.string(), zTimestamped),
    /** resourceId -> when it was saved. */
    bookmarks: z.record(zId, zTimestamped),
    /** Most recent first, capped at RECENTLY_VIEWED_LIMIT. */
    recentlyViewed: z.array(zRecentlyViewed).max(RECENTLY_VIEWED_LIMIT),
    /** Ids of one-off notices the user has closed. */
    dismissedNotices: z.array(z.string().min(1)),
  })
  .strict()

export type PersistedState = z.infer<typeof zPersistedState>
export type Profile = z.infer<typeof zProfile>
export type RecentlyViewed = z.infer<typeof zRecentlyViewed>

export function defaultState(): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { level: null, goal: null, weeklyTargetMinutes: null, updatedAt: null },
    completions: {},
    checkpointCompletions: {},
    bookmarks: {},
    recentlyViewed: [],
    dismissedNotices: [],
  }
}

/** Export format: the state plus enough context to know what produced it. */
export const zExportEnvelope = z
  .object({
    exportedAt: z.iso.datetime(),
    app: z.literal('ai-atlas'),
    state: zPersistedState,
  })
  .strict()

export type ExportEnvelope = z.infer<typeof zExportEnvelope>

export { zIsoDate }
