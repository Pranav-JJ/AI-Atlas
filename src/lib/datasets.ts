/**
 * Dataset-specific helpers, kept out of the component file.
 *
 * Types, predicates and label maps live here so DatasetDetails.tsx exports only
 * components — which is what react-refresh needs, and is a better boundary
 * regardless: this module is importable from pure logic and tests without
 * pulling React in.
 */

/** The dataset-specific half of a catalogue record. */
export interface DatasetFields {
  task: readonly string[]
  domain: string | null
  modality: readonly string[]
  size_description: string | null
  license: string
  license_url: string | null
  access_requirements: string
  sensitive_data_notes: string | null
  known_limitations: readonly string[]
  benchmark_tasks: ReadonlyArray<{ name: string; metric: string }>
  documentation_url: string | null
  access_instructions: string | null
}

/** Datasets and benchmarks are the record types carrying the extra fields. */
export function isDataset<T extends { resource_type: string }>(
  resource: T,
): resource is T & DatasetFields {
  return resource.resource_type === 'dataset' || resource.resource_type === 'benchmark'
}

export const ACCESS_LABELS: Record<string, string> = {
  open: 'Open access',
  registration: 'Requires registration',
  request: 'Requires a request',
  'research-only': 'Research use only',
  restricted: 'Restricted',
  unknown: 'Access terms unknown',
}

/**
 * Access levels that must stand out, because getting them wrong has
 * consequences beyond a wasted afternoon.
 */
export const ACCESS_TONE: Record<string, 'ok' | 'warn' | 'danger'> = {
  open: 'ok',
  registration: 'warn',
  request: 'warn',
  'research-only': 'danger',
  restricted: 'danger',
  unknown: 'warn',
}

/**
 * A licence is "named" only when the source states one.
 *
 * "unknown" and "other" both mean nothing about permitted use can be assumed,
 * so they are one category rather than two — the practical question is whether
 * you still have work to do before using the data.
 */
export function hasNamedLicence(license: string): boolean {
  const lower = license.trim().toLowerCase()
  return lower.length > 0 && !lower.startsWith('unknown') && !lower.startsWith('other')
}

/** Short form for a badge: the licence identifier without its trailing caveat. */
export function shortLicence(license: string): string {
  return license.split(' ')[0] ?? license
}
