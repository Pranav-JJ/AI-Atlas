/**
 * Compiles content/*.json into typed TypeScript modules under
 * src/content/generated/, plus a prebuilt search index.
 *
 * Why generate modules rather than fetch JSON at runtime:
 *   - no network request, no base-path handling, no loading state for content
 *   - the bundler tree-shakes and hashes it like any other module
 *   - a content/schema mismatch becomes a TYPE error at build time
 *
 * The output is gitignored. content/ is the source of truth; this directory is
 * derived and is rebuilt by `prebuild`, `predev` and CI.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import MiniSearch from 'minisearch'

import { applyStaleDowngrade, findStaleRecords } from '../src/lib/content/rules.ts'
import { miniSearchOptions, toSearchDocument } from '../src/lib/search/config.ts'
import { loadContentSet, reportIssues } from './content-pipeline.ts'

const OUT_DIR = 'src/content/generated'

const { set, issues, today, files } = await loadContentSet()

const errors = issues.filter((i) => i.severity === 'error')

if (errors.length > 0) {
  console.error('Refusing to build: content is invalid.\n')
  reportIssues(errors)
  console.error(
    `\n${errors.length} error(s). Run \`npm run content:validate\` for the full report.`,
  )
  process.exit(1)
}

// Rule 9 is applied here rather than in the content files: staleness is DERIVED
// from a date, so re-verifying a record is the only thing that should clear it.
const staleCount = findStaleRecords(set, today).length
const built = applyStaleDowngrade(set, today)

/**
 * Content version = a hash of the source files.
 *
 * Deterministic, so an unchanged content set always produces the same version.
 * That makes the value usable as a cache key without embedding a build clock.
 */
async function checksumOf(paths: string[]): Promise<string> {
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(path)
    hash.update(await readFile(path, 'utf8'))
  }
  return hash.digest('hex').slice(0, 12)
}

const contentVersion = await checksumOf(files)

const records = {
  topics: built.topics.map((t) => t.record),
  providers: built.providers.map((p) => p.record),
  resources: built.resources.map((r) => r.record),
  paths: built.paths.map((p) => p.record),
  projects: built.projects.map((p) => p.record),
  glossary: built.glossary.map((g) => g.record),
}

const BANNER = `/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced by scripts/build-content.ts from content/*.json.
 * Edit the JSON and run \`npm run content:build\`.
 */
`

function emitCollection(name: string, typeName: string, value: unknown): string {
  return `${BANNER}
import type { ${typeName} } from '@/lib/schema/index.ts'

export const ${name}: readonly ${typeName}[] = ${JSON.stringify(value, null, 2)} as const
`
}

await mkdir(OUT_DIR, { recursive: true })

await Promise.all([
  writeFile(join(OUT_DIR, 'topics.ts'), emitCollection('topics', 'Topic', records.topics), 'utf8'),
  writeFile(
    join(OUT_DIR, 'providers.ts'),
    emitCollection('providers', 'Provider', records.providers),
    'utf8',
  ),
  writeFile(
    join(OUT_DIR, 'resources.ts'),
    emitCollection('resources', 'AnyResource', records.resources),
    'utf8',
  ),
  writeFile(
    join(OUT_DIR, 'paths.ts'),
    emitCollection('learningPaths', 'LearningPath', records.paths),
    'utf8',
  ),
  writeFile(
    join(OUT_DIR, 'projects.ts'),
    emitCollection('projects', 'Project', records.projects),
    'utf8',
  ),
  writeFile(
    join(OUT_DIR, 'glossary.ts'),
    emitCollection('glossary', 'GlossaryTerm', records.glossary),
    'utf8',
  ),
])

/**
 * The search index is built here, not in the browser.
 *
 * Tokenising several hundred documents on every page load would be the single
 * most expensive thing the app does. Serialising it now means the client only
 * has to deserialise, and the chunk can be lazily imported by /library.
 */
const miniSearch = new MiniSearch(miniSearchOptions())
miniSearch.addAll(records.resources.map(toSearchDocument))

await writeFile(
  join(OUT_DIR, 'search-index.ts'),
  `${BANNER}
/** Serialised MiniSearch index. Load with MiniSearch.loadJSON and miniSearchOptions(). */
export const serializedSearchIndex = ${JSON.stringify(JSON.stringify(miniSearch))}
`,
  'utf8',
)

const manifest = {
  contentVersion,
  generatedAt: today,
  counts: {
    topics: records.topics.length,
    providers: records.providers.length,
    resources: records.resources.length,
    paths: records.paths.length,
    projects: records.projects.length,
    glossary: records.glossary.length,
  },
  verification: {
    verified: records.resources.filter((r) => r.status === 'verified').length,
    unverified: records.resources.filter((r) => r.status === 'unverified').length,
    stale: records.resources.filter((r) => r.status === 'stale').length,
    broken: records.resources.filter((r) => r.status === 'broken').length,
  },
}

await writeFile(
  join(OUT_DIR, 'manifest.ts'),
  `${BANNER}
export const contentManifest = ${JSON.stringify(manifest, null, 2)} as const
`,
  'utf8',
)

await writeFile(
  join(OUT_DIR, 'index.ts'),
  `${BANNER}
export { topics } from './topics.ts'
export { providers } from './providers.ts'
export { resources } from './resources.ts'
export { learningPaths } from './paths.ts'
export { projects } from './projects.ts'
export { glossary } from './glossary.ts'
export { contentManifest } from './manifest.ts'
`,
  'utf8',
)

const warnings = issues.filter((i) => i.severity === 'warning')

console.log(`Content built (version ${contentVersion}, as of ${today})`)
console.log(
  `  ${Object.entries(manifest.counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')}`,
)
console.log(
  `  verification: ${manifest.verification.verified} verified, ` +
    `${manifest.verification.unverified} unverified, ${manifest.verification.stale} stale`,
)
if (staleCount > 0) console.log(`  ${staleCount} record(s) downgraded to stale by rule 9`)
if (warnings.length > 0) console.log(`  ${warnings.length} warning(s) — see content:validate`)
console.log(`  -> ${OUT_DIR}/`)
