import type { AnyResource, Domain, Topic } from '../schema/index.ts'

/**
 * Pure functions over the topic graph.
 *
 * No React, no imports from the generated content — everything is passed in — so
 * these are testable against small fixtures rather than against the whole
 * catalogue, and a taxonomy change cannot silently break them unnoticed.
 */

/** Display order of the six domains. */
export const DOMAIN_ORDER: readonly Domain[] = [
  'foundations',
  'machine-learning',
  'deep-learning',
  'nlp',
  'genai-llm-apps',
  'mlops-production',
]

export interface DomainGroup {
  domain: Domain
  /** The domain's root topic, if one is defined. */
  root: Topic | null
  /** Direct children of the root, in `order`. */
  children: Topic[]
}

export function getTopic(topics: readonly Topic[], id: string): Topic | null {
  return topics.find((t) => t.id === id) ?? null
}

/** Direct children of a topic, sorted by `order` then name for stability. */
export function getChildren(topics: readonly Topic[], parentId: string): Topic[] {
  return topics
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/**
 * Ancestors from the root down to (but excluding) the topic itself.
 *
 * Guards against a cycle even though rule 10 forbids one: this runs in the
 * browser against generated content, and an infinite loop here would hang the
 * tab rather than fail a build.
 */
export function getAncestors(topics: readonly Topic[], id: string): Topic[] {
  const chain: Topic[] = []
  const seen = new Set<string>([id])

  let current = getTopic(topics, id)

  while (current?.parentId != null) {
    if (seen.has(current.parentId)) break

    const parent = getTopic(topics, current.parentId)
    if (!parent) break

    chain.unshift(parent)
    seen.add(parent.id)
    current = parent
  }

  return chain
}

/** Groups topics into the six domains, each with its root and direct children. */
export function groupTopicsByDomain(topics: readonly Topic[]): DomainGroup[] {
  return DOMAIN_ORDER.map((domain) => {
    const inDomain = topics.filter((t) => t.domain === domain)
    const root = inDomain.find((t) => t.parentId === null) ?? null

    return {
      domain,
      root,
      children: root
        ? getChildren(inDomain, root.id)
        : [...inDomain].sort((a, b) => a.order - b.order),
    }
  }).filter((group) => group.root !== null || group.children.length > 0)
}

/**
 * Resources tagged with a topic, either directly or via `subtopics`.
 *
 * Descendant topics are NOT rolled up: a resource tagged `attention` does not
 * become a `deep-learning` resource, because that would make a domain page an
 * undifferentiated dump of everything beneath it.
 */
export function resourcesForTopic(
  resources: readonly AnyResource[],
  topicId: string,
): AnyResource[] {
  return resources.filter((r) => r.topics.includes(topicId) || r.subtopics.includes(topicId))
}

/** How many resources each topic carries, for showing coverage as a COUNT. */
export function countResourcesByTopic(
  resources: readonly AnyResource[],
  topics: readonly Topic[],
): Map<string, number> {
  const counts = new Map<string, number>(topics.map((t) => [t.id, 0]))

  for (const resource of resources) {
    for (const id of new Set([...resource.topics, ...resource.subtopics])) {
      const current = counts.get(id)
      if (current !== undefined) counts.set(id, current + 1)
    }
  }

  return counts
}

/** Human label for a domain id. */
export const DOMAIN_LABELS: Record<Domain, string> = {
  foundations: 'Foundations',
  'machine-learning': 'Machine Learning',
  'deep-learning': 'Deep Learning',
  nlp: 'Natural Language Processing',
  'genai-llm-apps': 'Generative AI and LLM applications',
  'mlops-production': 'Production AI and MLOps',
}
