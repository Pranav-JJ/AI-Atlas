import type { AnyResource, Difficulty, LearningPath, Provider } from '../schema/index.ts'
import type { Goal } from '../storage/schema.ts'
import { curatedScore, type ScoreContext } from './sortResources.ts'

/**
 * What to suggest a learner does next.
 *
 * Deliberately conservative. The recommendation is a suggestion with a stated
 * reason, never a claim that this is THE correct next thing — the catalogue is
 * curated and incomplete, and we know very little about any individual. Every
 * outcome carries a `reason` the UI shows verbatim, so the basis is always
 * visible rather than implied.
 */

/** Topics each goal points at. Ordered: earlier entries are more central. */
export const GOAL_TOPICS: Record<Goal, string[]> = {
  'start-from-scratch': [
    'python-for-ai',
    'data-handling-visualization',
    'probability-statistics',
    'linear-algebra',
    'machine-learning',
    'supervised-learning',
  ],
  'engineer-to-ml': [
    'machine-learning',
    'supervised-learning',
    'model-selection-validation',
    'trees-ensembles',
    'feature-engineering',
    'mlops-production',
  ],
  'nlp-practitioner': [
    'nlp',
    'text-preprocessing-tokenization',
    'representations-embeddings',
    'transformers-nlp',
    'text-classification',
    'nlp-evaluation-safety',
  ],
  'build-llm-apps': [
    'genai-llm-apps',
    'prompt-design',
    'structured-outputs',
    'rag',
    'llm-evaluation',
    'semantic-search',
  ],
  'production-mlops': [
    'mlops-production',
    'experiment-tracking',
    'deployment-serving',
    'monitoring-drift',
    'data-feature-pipelines',
    'testing-ai-systems',
  ],
  'research-ready': [
    'probability-statistics',
    'linear-algebra',
    'deep-learning',
    'transformers',
    'nlp-evaluation-safety',
    'interpretability',
  ],
}

export interface RecommendationContext {
  resources: readonly AnyResource[]
  paths: readonly LearningPath[]
  completions: Readonly<Record<string, { at: string }>>
  checkpointCompletions: Readonly<Record<string, { at: string }>>
  profile: { level: Difficulty | null; goal: Goal | null }
  providersById: ReadonlyMap<string, Provider>
  today: string
}

export type Recommendation =
  /** The next required item of a path already in progress. */
  | { kind: 'path-item'; pathId: string; moduleId: string; resource: AnyResource; reason: string }
  /** A path was finished; suggest what it points at next. */
  | { kind: 'next-path'; path: LearningPath; reason: string }
  /** A single resource, chosen by the documented curated score. */
  | { kind: 'resource'; resource: AnyResource; reason: string }
  /** Nothing sensible to suggest — say so rather than inventing one. */
  | { kind: 'nothing'; reason: string }

function isCompleted(context: RecommendationContext, resourceId: string): boolean {
  return context.completions[resourceId] !== undefined
}

/**
 * Required items of a path, in module then item order, paired with their
 * resource. Checkpoints are required too, but they are not resources, so they
 * are counted for progress and skipped when suggesting something to open.
 */
function requiredResourceItems(path: LearningPath, byId: Map<string, AnyResource>) {
  return path.modules.flatMap((module) =>
    [...module.items]
      .sort((a, b) => a.order - b.order)
      .filter((item) => item.required && item.kind === 'resource' && item.resource_id !== null)
      .map((item) => ({
        moduleId: module.id,
        resource: byId.get(item.resource_id!),
      }))
      .filter(
        (entry): entry is { moduleId: string; resource: AnyResource } =>
          entry.resource !== undefined,
      ),
  )
}

/** A path counts as "in progress" once any of its required items is complete. */
function pathsInProgress(context: RecommendationContext, byId: Map<string, AnyResource>) {
  return context.paths.filter((path) =>
    requiredResourceItems(path, byId).some((entry) => isCompleted(context, entry.resource.id)),
  )
}

/**
 * The single best next step.
 *
 * Order of preference:
 *   1. The next incomplete required item of a path already started.
 *   2. The path a just-finished path points at.
 *   3. The highest-scoring uncompleted resource matching the stated profile.
 *   4. Nothing, stated plainly.
 */
export function recommendNext(context: RecommendationContext): Recommendation {
  const byId = new Map(context.resources.map((r) => [r.id, r]))
  const started = pathsInProgress(context, byId)

  for (const path of started) {
    const items = requiredResourceItems(path, byId)
    const next = items.find((entry) => !isCompleted(context, entry.resource.id))

    if (next) {
      return {
        kind: 'path-item',
        pathId: path.id,
        moduleId: next.moduleId,
        resource: next.resource,
        reason: `The next required step in ${path.title}`,
      }
    }
  }

  // Every started path is finished: point at what one of them recommends next.
  for (const path of started) {
    const nextId = path.next_path_ids[0]
    const nextPath = nextId ? context.paths.find((p) => p.id === nextId) : undefined

    if (nextPath) {
      return {
        kind: 'next-path',
        path: nextPath,
        reason: `You finished ${path.title}, which suggests this next`,
      }
    }
  }

  return recommendResource(context)
}

/**
 * Best uncompleted resource for the stated profile.
 *
 * Uses the same curated score the library sorts by, so a recommendation can
 * never disagree with the ordering a user sees when they go looking themselves.
 */
export function recommendResource(context: RecommendationContext): Recommendation {
  const { profile } = context

  const scoreContext: ScoreContext = {
    providersById: context.providersById,
    today: context.today,
    learnerLevel: profile.level,
  }

  const goalTopics = profile.goal ? GOAL_TOPICS[profile.goal] : []

  const candidates = context.resources.filter(
    (resource) =>
      !isCompleted(context, resource.id) &&
      resource.status !== 'broken' &&
      resource.status !== 'deprecated' &&
      // Only ever suggest something that can actually be opened.
      resource.url !== null,
  )

  if (candidates.length === 0) {
    return {
      kind: 'nothing',
      reason: 'You have worked through everything in the catalogue that has a link.',
    }
  }

  /** Goal match is the strongest signal we have, so it dominates the score. */
  const goalBonus = (resource: AnyResource): number => {
    if (goalTopics.length === 0) return 0

    const index = goalTopics.findIndex(
      (topic) => resource.topics.includes(topic) || resource.subtopics.includes(topic),
    )
    // Earlier topics in the goal list are more central to it.
    return index === -1 ? 0 : 10 - index
  }

  const ranked = [...candidates].sort((a, b) => {
    const byGoal = goalBonus(b) - goalBonus(a)
    if (byGoal !== 0) return byGoal

    const byScore = curatedScore(b, scoreContext) - curatedScore(a, scoreContext)
    if (byScore !== 0) return byScore

    // Total and stable, so the suggestion does not change between renders.
    return a.id.localeCompare(b.id)
  })

  const best = ranked[0]!

  if (profile.goal && goalBonus(best) > 0) {
    return {
      kind: 'resource',
      resource: best,
      reason: `Matches your goal${profile.level ? ` and your stated level` : ''}`,
    }
  }

  if (profile.level) {
    return {
      kind: 'resource',
      resource: best,
      reason: 'Highest-ranked resource you have not marked done',
    }
  }

  return {
    kind: 'resource',
    resource: best,
    // Said plainly: with no profile this is not personalised at all.
    reason: 'A well-rated starting point. Tell us your level for better suggestions',
  }
}

/**
 * A handful of further suggestions, excluding the primary one.
 *
 * Same ordering as `recommendResource`, so the list is a continuation of the
 * same reasoning rather than a second, unexplained ranking.
 */
export function suggestMore(
  context: RecommendationContext,
  options: {
    limit?: number
    excludeIds?: readonly string[]
    type?: AnyResource['resource_type']
  } = {},
): AnyResource[] {
  const { limit = 3, excludeIds = [], type } = options
  const exclude = new Set(excludeIds)

  const filtered = context.resources.filter(
    (resource) =>
      !exclude.has(resource.id) &&
      !isCompleted(context, resource.id) &&
      resource.status !== 'broken' &&
      resource.status !== 'deprecated' &&
      resource.url !== null &&
      (type === undefined || resource.resource_type === type),
  )

  const result = recommendResource({ ...context, resources: filtered })
  if (result.kind !== 'resource') return []

  // Re-rank the filtered set the same way, then take the top few.
  const scoreContext: ScoreContext = {
    providersById: context.providersById,
    today: context.today,
    learnerLevel: context.profile.level,
  }
  const goalTopics = context.profile.goal ? GOAL_TOPICS[context.profile.goal] : []

  const goalBonus = (resource: AnyResource): number => {
    if (goalTopics.length === 0) return 0
    const index = goalTopics.findIndex(
      (topic) => resource.topics.includes(topic) || resource.subtopics.includes(topic),
    )
    return index === -1 ? 0 : 10 - index
  }

  return [...filtered]
    .sort(
      (a, b) =>
        goalBonus(b) - goalBonus(a) ||
        curatedScore(b, scoreContext) - curatedScore(a, scoreContext) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit)
}
