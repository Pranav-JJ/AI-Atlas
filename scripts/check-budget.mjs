/**
 * Enforces the performance budgets from the plan against the real build.
 *
 * Lighthouse cannot run in this environment, so the budgets that CAN be
 * measured deterministically are measured here and enforced in CI. This is not
 * a substitute for a Lighthouse run — it is the part that can be automated
 * without a browser, and it catches the regression that actually matters on a
 * static site: a dependency quietly landing in the entry chunk.
 *
 *   node scripts/check-budget.mjs
 *
 * Exits non-zero when a budget is exceeded. Unlike the link checker, this one
 * SHOULD fail the build: it measures our own output, not somebody else's server.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const ASSETS = 'dist/assets'

/** Budgets in kilobytes, gzipped. From the plan's Phase 13 acceptance table. */
const BUDGETS = {
  entryJs: 180,
  css: 30,
  searchIndex: 250,
}

function gzipKb(path) {
  return gzipSync(readFileSync(path)).length / 1024
}

function findAsset(predicate) {
  return readdirSync(ASSETS).filter(predicate)
}

const failures = []
const rows = []

function check(label, actualKb, budgetKb) {
  const ok = actualKb <= budgetKb
  rows.push({ label, actual: actualKb, budget: budgetKb, ok })
  if (!ok) failures.push(`${label}: ${actualKb.toFixed(1)} kB exceeds ${budgetKb} kB`)
}

const entry = findAsset((n) => n.startsWith('index-') && n.endsWith('.js'))[0]
if (!entry) {
  console.error('No entry chunk found in dist/assets — did the build run?')
  process.exit(1)
}
check('entry JS (gzip)', gzipKb(join(ASSETS, entry)), BUDGETS.entryJs)

const css = findAsset((n) => n.endsWith('.css'))
const cssKb = css.reduce((sum, name) => sum + gzipKb(join(ASSETS, name)), 0)
check('CSS (gzip)', cssKb, BUDGETS.css)

const searchIndex = findAsset((n) => n.startsWith('search-index-') && n.endsWith('.js'))[0]
if (searchIndex) {
  check('search index chunk (gzip)', gzipKb(join(ASSETS, searchIndex)), BUDGETS.searchIndex)
}

/*
 * The search index must stay OUT of the entry chunk. It is the asset most
 * likely to grow with the catalogue, and the whole point of building it ahead
 * of time is that it loads only when someone searches.
 */
const entrySource = readFileSync(join(ASSETS, entry), 'utf8')
const indexInEntry = entrySource.includes('serializedSearchIndex')
rows.push({
  label: 'search index kept out of entry',
  actual: indexInEntry ? 1 : 0,
  budget: 0,
  ok: !indexInEntry,
})
if (indexInEntry) failures.push('search index was bundled into the entry chunk')

const pages = (function countPages(dir) {
  let total = 0
  for (const entryName of readdirSync(dir)) {
    const full = join(dir, entryName)
    if (statSync(full).isDirectory()) total += countPages(full)
    else if (entryName === 'index.html') total += 1
  }
  return total
})('dist')

console.log('Build budgets')
console.log('')
for (const row of rows) {
  const status = row.ok ? 'ok  ' : 'FAIL'
  const value = row.label.startsWith('search index kept')
    ? row.ok
      ? 'not present'
      : 'PRESENT'
    : `${row.actual.toFixed(1)} kB / ${row.budget} kB`
  console.log(`  ${status}  ${row.label.padEnd(32)} ${value}`)
}
console.log('')
console.log(`  ${pages} pre-rendered pages`)

if (failures.length > 0) {
  console.error('')
  console.error(`FAILED: ${failures.length} budget(s) exceeded.`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log('')
console.log('All budgets met.')
