import type { AnyResource } from '../schema/index.ts'

/**
 * Search configuration, shared by the build-time index builder and the runtime
 * loader.
 *
 * MiniSearch requires that an index be loaded with the SAME options it was built
 * with. Keeping one definition here is what stops a boost tweak in the builder
 * from silently producing a corrupt index at runtime.
 */

export const SEARCH_FIELDS = [
  'title',
  'why_useful',
  'description',
  'topicText',
  'sourceText',
] as const

export const SEARCH_BOOSTS: Record<string, number> = {
  // Title matches are what a user means most of the time.
  title: 4,
  // Our editorial justification is more discriminating than the description.
  why_useful: 2,
  topicText: 2,
  description: 1.5,
  sourceText: 1,
}

/**
 * MiniSearch construction options.
 *
 * A factory rather than a shared constant for two reasons: MiniSearch requires
 * mutable arrays, and it retains the object it is given — so handing the same
 * instance to the builder and the loader would couple them through shared state.
 */
export function miniSearchOptions() {
  return {
    fields: [...SEARCH_FIELDS] as string[],
    storeFields: ['id'],
    idField: 'id',
  }
}

export const SEARCH_QUERY_OPTIONS = {
  boost: SEARCH_BOOSTS,
  prefix: true,
  fuzzy: 0.2,
  combineWith: 'AND',
} as const

/** One row of the search index. Flattened, because MiniSearch indexes strings. */
export interface SearchDocument {
  id: string
  title: string
  description: string
  why_useful: string
  topicText: string
  sourceText: string
}

/**
 * Projects a resource into its indexable form.
 *
 * Only text worth matching on is included — deliberately not the whole record,
 * so the index stays small enough to ship as a lazily-loaded chunk.
 */
export function toSearchDocument(resource: AnyResource): SearchDocument {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    why_useful: resource.why_useful,
    topicText: [...resource.topics, ...resource.subtopics].join(' '),
    sourceText: [resource.provider_id, resource.author, resource.resource_type]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(' '),
  }
}
