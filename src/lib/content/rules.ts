import type {
  AnyResource,
  GlossaryTerm,
  LearningPath,
  Project,
  Provider,
  Topic,
} from '../schema/index.ts'
import { STALE_AFTER_DAYS } from '../schema/index.ts'

/**
 * Cross-record content rules.
 *
 * A Zod schema can only see one record at a time. Everything that depends on the
 * content set as a whole — id uniqueness, referential integrity, cycles in the
 * topic graph, duplicate links — lives here, as pure functions over plain data
 * so it is testable without touching the filesystem.
 */

export type Severity = 'error' | 'warning'

export interface ContentIssue {
  /** Which numbered rule from EDITORIAL_POLICY.md failed. */
  rule: number
  severity: Severity
  /** Source file, so the message points at something you can open. */
  file: string
  /** Record id, or null when the problem is the id itself. */
  recordId: string | null
  field: string | null
  message: string
}

/** A record together with the file it came from, so errors stay actionable. */
export interface Sourced<T> {
  file: string
  record: T
}

export interface ContentSet {
  topics: Array<Sourced<Topic>>
  providers: Array<Sourced<Provider>>
  resources: Array<Sourced<AnyResource>>
  paths: Array<Sourced<LearningPath>>
  projects: Array<Sourced<Project>>
  glossary: Array<Sourced<GlossaryTerm>>
}

export function emptyContentSet(): ContentSet {
  return { topics: [], providers: [], resources: [], paths: [], projects: [], glossary: [] }
}

function issue(
  rule: number,
  severity: Severity,
  file: string,
  recordId: string | null,
  field: string | null,
  message: string,
): ContentIssue {
  return { rule, severity, file, recordId, field, message }
}

/** Every id in the set, grouped by kind, for referential checks. */
interface Indexes {
  topicIds: Set<string>
  providerIds: Set<string>
  resourceIds: Set<string>
  datasetIds: Set<string>
  pathIds: Set<string>
  projectIds: Set<string>
  glossaryIds: Set<string>
}

function buildIndexes(set: ContentSet): Indexes {
  return {
    topicIds: new Set(set.topics.map((t) => t.record.id)),
    providerIds: new Set(set.providers.map((p) => p.record.id)),
    resourceIds: new Set(set.resources.map((r) => r.record.id)),
    datasetIds: new Set(
      set.resources
        .filter(
          (r) => r.record.resource_type === 'dataset' || r.record.resource_type === 'benchmark',
        )
        .map((r) => r.record.id),
    ),
    pathIds: new Set(set.paths.map((p) => p.record.id)),
    projectIds: new Set(set.projects.map((p) => p.record.id)),
    glossaryIds: new Set(set.glossary.map((g) => g.record.id)),
  }
}

/**
 * Rule 1 — ids must be unique across the ENTIRE content set, not just within a
 * collection. Ids appear in URLs and in saved user progress, so a collision
 * between, say, a project and a resource would silently corrupt both.
 */
function checkUniqueIds(set: ContentSet): ContentIssue[] {
  const seen = new Map<string, string>()
  const issues: ContentIssue[] = []

  const all: Array<Sourced<{ id: string }>> = [
    ...set.topics,
    ...set.providers,
    ...set.resources,
    ...set.paths,
    ...set.projects,
    ...set.glossary,
  ]

  for (const { file, record } of all) {
    const previous = seen.get(record.id)
    if (previous !== undefined) {
      issues.push(
        issue(
          1,
          'error',
          file,
          record.id,
          'id',
          `duplicate id "${record.id}" — already defined in ${previous}`,
        ),
      )
      continue
    }
    seen.set(record.id, file)
  }

  return issues
}

/** Rules 2 and 3 — every reference must resolve to something that exists. */
function checkReferences(set: ContentSet, idx: Indexes): ContentIssue[] {
  const issues: ContentIssue[] = []

  const ref = (
    rule: number,
    file: string,
    recordId: string,
    field: string,
    ids: string[],
    pool: Set<string>,
    kind: string,
  ) => {
    for (const id of ids) {
      if (!pool.has(id)) {
        issues.push(
          issue(rule, 'error', file, recordId, field, `references unknown ${kind} "${id}"`),
        )
      }
    }
  }

  for (const { file, record } of set.topics) {
    if (record.parentId !== null) {
      ref(2, file, record.id, 'parentId', [record.parentId], idx.topicIds, 'topic')
    }
    ref(2, file, record.id, 'prerequisiteTopics', record.prerequisiteTopics, idx.topicIds, 'topic')
  }

  for (const { file, record } of set.resources) {
    ref(2, file, record.id, 'topics', record.topics, idx.topicIds, 'topic')
    ref(2, file, record.id, 'subtopics', record.subtopics, idx.topicIds, 'topic')
    ref(
      2,
      file,
      record.id,
      'prerequisites.topics',
      record.prerequisites.topics,
      idx.topicIds,
      'topic',
    )
    ref(
      3,
      file,
      record.id,
      'prerequisites.resources',
      record.prerequisites.resources,
      idx.resourceIds,
      'resource',
    )

    if (record.provider_id !== null) {
      ref(3, file, record.id, 'provider_id', [record.provider_id], idx.providerIds, 'provider')
    }

    if ('dataset_ids' in record) {
      ref(3, file, record.id, 'dataset_ids', record.dataset_ids, idx.datasetIds, 'dataset')
    }
  }

  for (const { file, record } of set.paths) {
    ref(
      2,
      file,
      record.id,
      'prerequisites.topics',
      record.prerequisites.topics,
      idx.topicIds,
      'topic',
    )
    ref(
      3,
      file,
      record.id,
      'suggested_project_ids',
      record.suggested_project_ids,
      idx.projectIds,
      'project',
    )
    ref(3, file, record.id, 'next_path_ids', record.next_path_ids, idx.pathIds, 'path')

    for (const module of record.modules) {
      for (const item of module.items) {
        if (item.resource_id !== null) {
          ref(
            3,
            file,
            record.id,
            `modules.${module.id}.items[order=${item.order}].resource_id`,
            [item.resource_id],
            idx.resourceIds,
            'resource',
          )
        }
      }
    }
  }

  for (const { file, record } of set.projects) {
    ref(2, file, record.id, 'topics', record.topics, idx.topicIds, 'topic')
    ref(
      3,
      file,
      record.id,
      'recommended_dataset_ids',
      record.recommended_dataset_ids,
      idx.datasetIds,
      'dataset',
    )
  }

  for (const { file, record } of set.glossary) {
    ref(2, file, record.id, 'topics', record.topics, idx.topicIds, 'topic')
    ref(
      3,
      file,
      record.id,
      'related_term_ids',
      record.related_term_ids,
      idx.glossaryIds,
      'glossary term',
    )
    ref(3, file, record.id, 'resource_ids', record.resource_ids, idx.resourceIds, 'resource')
  }

  return issues
}

/**
 * Rule 10 — the topic graph must be acyclic, both through `parentId` and through
 * `prerequisiteTopics`. A cycle would make the tree renderer and the "what must I
 * learn first" walk loop forever.
 */
function findCycle(nodes: string[], edges: (id: string) => string[]): string[] | null {
  const WHITE = 0
  const GREY = 1
  const BLACK = 2
  const colour = new Map<string, number>(nodes.map((n) => [n, WHITE]))
  const stack: string[] = []

  function visit(node: string): string[] | null {
    colour.set(node, GREY)
    stack.push(node)

    for (const next of edges(node)) {
      // Unknown ids are reported by the reference rules; ignore them here.
      if (!colour.has(next)) continue

      if (colour.get(next) === GREY) {
        return [...stack.slice(stack.indexOf(next)), next]
      }
      if (colour.get(next) === WHITE) {
        const found = visit(next)
        if (found) return found
      }
    }

    stack.pop()
    colour.set(node, BLACK)
    return null
  }

  for (const node of nodes) {
    if (colour.get(node) === WHITE) {
      const found = visit(node)
      if (found) return found
    }
  }

  return null
}

function checkAcyclic(set: ContentSet): ContentIssue[] {
  const issues: ContentIssue[] = []
  const ids = set.topics.map((t) => t.record.id)
  const byId = new Map(set.topics.map((t) => [t.record.id, t]))
  const fileOf = (id: string) => byId.get(id)?.file ?? 'content/topics.json'

  const parentCycle = findCycle(ids, (id) => {
    const parent = byId.get(id)?.record.parentId
    return parent === null || parent === undefined ? [] : [parent]
  })

  if (parentCycle) {
    issues.push(
      issue(
        10,
        'error',
        fileOf(parentCycle[0] ?? ''),
        parentCycle[0] ?? null,
        'parentId',
        `topic parent cycle: ${parentCycle.join(' -> ')}`,
      ),
    )
  }

  const prereqCycle = findCycle(ids, (id) => byId.get(id)?.record.prerequisiteTopics ?? [])

  if (prereqCycle) {
    issues.push(
      issue(
        10,
        'error',
        fileOf(prereqCycle[0] ?? ''),
        prereqCycle[0] ?? null,
        'prerequisiteTopics',
        `topic prerequisite cycle: ${prereqCycle.join(' -> ')}`,
      ),
    )
  }

  return issues
}

/**
 * Rule 12 — the same URL appearing twice usually means a resource was re-added
 * under a new id rather than updated. A warning, not an error: occasionally a
 * single page genuinely serves two purposes.
 */
function checkDuplicateUrls(set: ContentSet): ContentIssue[] {
  const seen = new Map<string, { file: string; id: string }>()
  const issues: ContentIssue[] = []

  for (const { file, record } of set.resources) {
    if (record.url === null) continue

    const previous = seen.get(record.url)
    if (previous) {
      issues.push(
        issue(
          12,
          'warning',
          file,
          record.id,
          'url',
          `duplicate url — also used by "${previous.id}" in ${previous.file}`,
        ),
      )
      continue
    }
    seen.set(record.url, { file, id: record.id })
  }

  return issues
}

/** Whole days between two ISO dates. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  return Math.floor((to - from) / 86_400_000)
}

/**
 * Rule 9 — a verification older than STALE_AFTER_DAYS no longer means much.
 *
 * `today` is injected rather than read from the clock so that builds are
 * reproducible and tests are not time bombs.
 */
export function findStaleRecords(set: ContentSet, today: string): ContentIssue[] {
  const issues: ContentIssue[] = []

  for (const { file, record } of set.resources) {
    if (record.status !== 'verified' || record.last_verified_at === null) continue

    const age = daysBetween(record.last_verified_at, today)
    if (age > STALE_AFTER_DAYS) {
      issues.push(
        issue(
          9,
          'warning',
          file,
          record.id,
          'last_verified_at',
          `last verified ${age} days ago (limit ${STALE_AFTER_DAYS}) — downgraded to "stale"`,
        ),
      )
    }
  }

  return issues
}

/**
 * Applies the rule 9 downgrade. Returns a NEW set; the content files on disk are
 * never rewritten by the build — staleness is derived, so re-verifying is the
 * only thing that clears it.
 */
export function applyStaleDowngrade(set: ContentSet, today: string): ContentSet {
  const staleIds = new Set(findStaleRecords(set, today).map((i) => i.recordId))

  return {
    ...set,
    resources: set.resources.map((entry) =>
      staleIds.has(entry.record.id)
        ? { ...entry, record: { ...entry.record, status: 'stale' as const } }
        : entry,
    ),
  }
}

/** Runs every cross-record rule. Per-record rules are enforced by the schemas. */
export function checkCrossRecordRules(set: ContentSet, today: string): ContentIssue[] {
  const idx = buildIndexes(set)

  return [
    ...checkUniqueIds(set),
    ...checkReferences(set, idx),
    ...checkAcyclic(set),
    ...checkDuplicateUrls(set),
    ...findStaleRecords(set, today),
  ]
}
