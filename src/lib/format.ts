import type { CostType, ResourceType } from './schema/index.ts'

/** Human-readable duration. Null stays null — unknown is not "0 min". */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null) return null

  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (hours >= 10) return `${hours} hr`
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  video: 'Video',
  course: 'Course',
  book: 'Book',
  tutorial: 'Tutorial',
  documentation: 'Docs',
  paper: 'Paper',
  article: 'Article',
  dataset: 'Dataset',
  benchmark: 'Benchmark',
  library: 'Library',
  'model-hub': 'Model hub',
  notebook: 'Notebook',
  project: 'Project',
  community: 'Community',
  podcast: 'Podcast',
}

export const COST_LABELS: Record<CostType, string> = {
  free: 'Free',
  freemium: 'Freemium',
  paid: 'Paid',
  'free-with-registration': 'Free, sign-up required',
}

/** Costs that should read as a caveat rather than a benefit. */
export function costTone(cost: CostType): 'ok' | 'warn' | 'neutral' {
  if (cost === 'free') return 'ok'
  if (cost === 'paid') return 'warn'
  return 'neutral'
}

/** Sentence-cases an id-like string for display, e.g. "text-classification". */
export function humanizeId(id: string): string {
  const words = id.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
