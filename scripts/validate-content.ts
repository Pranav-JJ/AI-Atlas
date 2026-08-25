/**
 * Validates everything under content/ against the schemas and cross-record rules.
 *
 * Run by `npm run content:validate`, as a prebuild step, and as a required check
 * in CI. Errors fail the build; warnings are reported and do not.
 *
 *   node scripts/validate-content.ts
 *   CONTENT_TODAY=2027-01-01 node scripts/validate-content.ts   # test freshness
 */
import { loadContentSet, reportIssues } from './content-pipeline.ts'

const { set, issues, today } = await loadContentSet()

const counts = {
  topics: set.topics.length,
  providers: set.providers.length,
  resources: set.resources.length,
  paths: set.paths.length,
  projects: set.projects.length,
  glossary: set.glossary.length,
}

const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

console.log(`Validating content (as of ${today})`)
console.log(
  `  ${total} records: ` +
    Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', '),
)
console.log('')

const { errors, warnings } = reportIssues(issues)

if (errors > 0) {
  console.log('')
  console.error(`FAILED: ${errors} error(s), ${warnings} warning(s).`)
  process.exit(1)
}

console.log(
  warnings > 0
    ? `\nOK with ${warnings} warning(s).`
    : '\nOK: all records valid, all references resolve.',
)
