/**
 * Paper-specific helpers, kept out of the component file so they are importable
 * from pure logic and tests without pulling React in.
 */

export interface PaperFields {
  authors: readonly string[]
  year: number | null
  venue: string | null
  peer_review_status: string
  /** A paraphrase of the abstract. What the SOURCE says. */
  abstract_summary: string | null
  /** Our reading of it. Never to be presented as the paper's own claim. */
  key_idea: string | null
  code_url: string | null
  dataset_ids: readonly string[]
}

export function isPaper<T extends { resource_type: string }>(
  resource: T,
): resource is T & PaperFields {
  return resource.resource_type === 'paper'
}

/**
 * How each review status is described.
 *
 * "unknown" is never omitted or softened. An arXiv identifier is not evidence
 * of peer review, and a blank field would invite the reader to assume one way
 * or the other.
 */
export const PEER_REVIEW_LABELS: Record<string, string> = {
  'peer-reviewed': 'Peer reviewed',
  preprint: 'Preprint',
  unknown: 'Publication status unknown',
}

export const PEER_REVIEW_EXPLANATIONS: Record<string, string> = {
  'peer-reviewed':
    'A venue is recorded for this paper, which is the evidence on which the label rests.',
  preprint: 'Posted as a preprint. No peer-reviewed venue is recorded.',
  unknown:
    'We have not confirmed whether this was peer reviewed. Being on arXiv, or widely cited, is not evidence either way.',
}

export const PEER_REVIEW_TONES: Record<string, 'ok' | 'warn' | 'neutral'> = {
  'peer-reviewed': 'ok',
  preprint: 'neutral',
  unknown: 'warn',
}

/** Sorts papers newest first, with undated ones last and ties broken by id. */
export function byYearDescending<T extends PaperFields & { id: string }>(a: T, b: T): number {
  if (a.year === null && b.year === null) return a.id.localeCompare(b.id)
  if (a.year === null) return 1
  if (b.year === null) return -1
  return b.year - a.year || a.id.localeCompare(b.id)
}
