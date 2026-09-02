import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { z } from 'zod'

import {
  checkCrossRecordRules,
  emptyContentSet,
  type ContentIssue,
  type ContentSet,
  type Sourced,
} from '../src/lib/content/rules.ts'
import {
  zDataset,
  zGlossaryTerm,
  zLearningPath,
  zPaper,
  zProject,
  zProvider,
  zResourceBase,
  zTopic,
  zVideo,
} from '../src/lib/schema/index.ts'

/**
 * Loads, parses and validates everything under content/.
 *
 * Shared by `content:validate` and `content:build` so the two can never disagree
 * about what valid content is.
 */

export const CONTENT_ROOT = 'content'

/** Today as an ISO date. Overridable so builds and tests are reproducible. */
export function resolveToday(): string {
  const override = process.env.CONTENT_TODAY
  if (override !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override
  return new Date().toISOString().slice(0, 10)
}

function zodIssuesToContentIssues(
  error: z.ZodError,
  file: string,
  recordId: string | null,
): ContentIssue[] {
  return error.issues.map((i) => ({
    // Per-record rules are enforced by the schemas; 0 means "schema", and the
    // message carries the specific rule number where one applies.
    rule: 0,
    severity: 'error' as const,
    file,
    recordId,
    field: i.path.length > 0 ? i.path.join('.') : null,
    message: i.message,
  }))
}

/** Content files hold an array of records; a single object is accepted too. */
function toRecordArray(parsed: unknown): unknown[] {
  return Array.isArray(parsed) ? parsed : [parsed]
}

function readId(raw: unknown): string | null {
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === 'string') return id
  }
  return null
}

async function readJsonFile(
  path: string,
  file: string,
): Promise<{ records: unknown[]; issues: ContentIssue[] }> {
  const text = await readFile(path, 'utf8')

  try {
    return { records: toRecordArray(JSON.parse(text)), issues: [] }
  } catch (error) {
    return {
      records: [],
      issues: [
        {
          rule: 0,
          severity: 'error',
          file,
          recordId: null,
          field: null,
          message: `invalid JSON: ${(error as Error).message}`,
        },
      ],
    }
  }
}

/** Picks the right schema for a resource record based on its declared type. */
function schemaForResource(raw: unknown): z.ZodTypeAny {
  const type =
    typeof raw === 'object' && raw !== null && 'resource_type' in raw
      ? (raw as { resource_type: unknown }).resource_type
      : null

  if (type === 'video') return zVideo
  if (type === 'dataset' || type === 'benchmark') return zDataset
  if (type === 'paper') return zPaper
  return zResourceBase
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => join(dir, e.name))
      .sort()
  } catch {
    // A collection directory that does not exist yet is not an error: content
    // grows collection by collection across phases.
    return []
  }
}

interface LoadOptions {
  root?: string
  today?: string
}

export interface LoadResult {
  set: ContentSet
  issues: ContentIssue[]
  today: string
  /** Every file actually read, for the manifest checksum. */
  files: string[]
}

export async function loadContentSet(options: LoadOptions = {}): Promise<LoadResult> {
  const root = options.root ?? CONTENT_ROOT
  const today = options.today ?? resolveToday()

  const set = emptyContentSet()
  const issues: ContentIssue[] = []
  const files: string[] = []

  const ingest = async <T>(
    paths: string[],
    schema: z.ZodTypeAny,
    target: Array<Sourced<T>>,
    schemaPicker?: (raw: unknown) => z.ZodTypeAny,
  ) => {
    for (const path of paths) {
      const file = relative('.', path).split('\\').join('/')
      files.push(file)

      const { records, issues: readIssues } = await readJsonFile(path, file)
      issues.push(...readIssues)

      for (const raw of records) {
        const id = readId(raw)
        const result = (schemaPicker ? schemaPicker(raw) : schema).safeParse(raw)

        if (!result.success) {
          issues.push(...zodIssuesToContentIssues(result.error, file, id))
          continue
        }

        target.push({ file, record: result.data as T })
      }
    }
  }

  await ingest(
    await listJsonFiles(root).then((f) => f.filter((p) => p.endsWith('topics.json'))),
    zTopic,
    set.topics,
  )
  await ingest(
    await listJsonFiles(root).then((f) => f.filter((p) => p.endsWith('providers.json'))),
    zProvider,
    set.providers,
  )
  /*
   * Datasets and papers live in their own directories but load into the SAME
   * collection as everything else. They are specialisations of the resource
   * base, so this is what makes them appear in the unified library and all of
   * its filters without a second code path — and what stops either drifting
   * into a differently-shaped record over time.
   */
  await ingest(
    [
      ...(await listJsonFiles(join(root, 'resources'))),
      ...(await listJsonFiles(join(root, 'datasets'))),
      ...(await listJsonFiles(join(root, 'papers'))),
    ],
    zResourceBase,
    set.resources,
    schemaForResource,
  )
  await ingest(await listJsonFiles(join(root, 'paths')), zLearningPath, set.paths)
  await ingest(await listJsonFiles(join(root, 'projects')), zProject, set.projects)
  await ingest(await listJsonFiles(join(root, 'glossary')), zGlossaryTerm, set.glossary)

  // Cross-record rules only make sense over records that parsed. Running them on
  // a half-loaded set would bury the real error under phantom dangling refs.
  if (!issues.some((i) => i.severity === 'error')) {
    issues.push(...checkCrossRecordRules(set, today))
  }

  return { set, issues, today, files: files.sort() }
}

const RULE_NAMES: Record<number, string> = {
  1: 'unique ids',
  2: 'topic references resolve',
  3: 'record references resolve',
  4: 'https urls only',
  5: 'verified requires evidence',
  6: 'no url means unverified',
  7: 'why_useful is substantive',
  8: 'sane durations',
  9: 'verification freshness',
  10: 'acyclic topic graph',
  11: 'contiguous item order',
  12: 'no duplicate urls',
  13: 'peer review needs a venue',
  14: 'datasets declare a licence',
}

export function formatIssue(issue: ContentIssue): string {
  const label = issue.severity === 'error' ? 'error' : 'warn '
  const rule = issue.rule > 0 ? ` [rule ${issue.rule}: ${RULE_NAMES[issue.rule] ?? ''}]` : ''
  const where = issue.recordId !== null ? ` (${issue.recordId})` : ''
  const field = issue.field !== null ? `${issue.field}: ` : ''

  return `  ${label}  ${issue.file}${where}${rule}\n         ${field}${issue.message}`
}

export function reportIssues(issues: ContentIssue[]): { errors: number; warnings: number } {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  for (const issue of [...errors, ...warnings]) {
    console.log(formatIssue(issue))
  }

  return { errors: errors.length, warnings: warnings.length }
}
