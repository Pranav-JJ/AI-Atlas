import MiniSearch from 'minisearch'
import { describe, expect, it } from 'vitest'

import { makeResource } from '@tests/fixtures/content.ts'

import { miniSearchOptions, toSearchDocument, type SearchDocument } from './config.ts'
import { applySearchOrder, runSearch } from './runSearch.ts'

function buildIndex(resources: ReturnType<typeof makeResource>[]): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>(miniSearchOptions())
  index.addAll(resources.map(toSearchDocument))
  return index
}

const catalogue = [
  makeResource({
    id: 'tokenization',
    title: 'Tokenization algorithms',
    description: 'Comparing byte-pair encoding, WordPiece and Unigram vocabularies.',
    why_useful: 'Tokenisation is where a beginner mental model of a language model first breaks.',
    topics: ['nlp', 'text-preprocessing-tokenization'],
    provider_id: 'hugging-face',
  }),
  makeResource({
    id: 'transformer',
    title: 'The Illustrated Transformer',
    description: 'A visual walkthrough of self-attention and the encoder-decoder stack.',
    why_useful:
      'The most effective bridge between not understanding attention and reading a paper.',
    topics: ['transformers', 'attention'],
    provider_id: 'jay-alammar',
  }),
  makeResource({
    id: 'linear-algebra',
    title: 'Essence of linear algebra',
    description: 'Visual series building geometric intuition for vectors and matrices.',
    why_useful: 'Turns matrix algebra into something you can picture rather than manipulate.',
    topics: ['linear-algebra'],
    author: 'Grant Sanderson',
  }),
]

describe('runSearch', () => {
  const index = buildIndex(catalogue)

  it('finds a document by an exact title term', () => {
    expect(runSearch(index, 'tokenization')).toContain('tokenization')
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(runSearch(index, '')).toEqual([])
    expect(runSearch(index, '   ')).toEqual([])
  })

  it('matches on a topic tag', () => {
    expect(runSearch(index, 'attention')).toContain('transformer')
  })

  it('matches on the author', () => {
    expect(runSearch(index, 'Sanderson')).toContain('linear-algebra')
  })

  it('matches on the provider', () => {
    expect(runSearch(index, 'hugging-face')).toContain('tokenization')
  })

  it('supports prefix matching, so results appear while typing', () => {
    expect(runSearch(index, 'token')).toContain('tokenization')
  })

  it('tolerates a small typo', () => {
    expect(runSearch(index, 'transfomer')).toContain('transformer')
  })

  it('ranks a title match above a body-only match', () => {
    // "algebra" appears in linear-algebra's title and in its description.
    const results = runSearch(index, 'algebra')
    expect(results[0]).toBe('linear-algebra')
  })

  it('requires all terms, so adding a word narrows rather than widens', () => {
    const broad = runSearch(index, 'visual')
    const narrow = runSearch(index, 'visual attention')

    expect(narrow.length).toBeLessThanOrEqual(broad.length)
  })

  it('returns nothing for a term in no document', () => {
    expect(runSearch(index, 'quantumchromodynamics')).toEqual([])
  })
})

describe('applySearchOrder', () => {
  it('reorders resources to match ranking and drops non-matches', () => {
    const ordered = applySearchOrder(catalogue, ['transformer', 'tokenization'])
    expect(ordered.map((r) => r.id)).toEqual(['transformer', 'tokenization'])
  })

  it('ignores ids that are not in the resource list', () => {
    // The index can outlive a removed record between builds.
    const ordered = applySearchOrder(catalogue, ['ghost', 'tokenization'])
    expect(ordered.map((r) => r.id)).toEqual(['tokenization'])
  })

  it('returns nothing when nothing ranked', () => {
    expect(applySearchOrder(catalogue, [])).toEqual([])
  })
})

describe('performance', () => {
  /**
   * Acceptance criterion for this phase: p95 search latency under 50ms at 1,000
   * records. Measured rather than assumed, because search is the interaction
   * the library lives or dies on.
   *
   * The threshold is generous relative to observed times so the test asserts
   * "no order-of-magnitude regression" rather than flaking on a busy CI runner.
   */
  const large = Array.from({ length: 1000 }, (_, i) =>
    makeResource({
      id: `res-${i}`,
      title: `Resource ${i} on ${['tokenization', 'attention', 'embeddings', 'regression'][i % 4]}`,
      description: `A description mentioning ${['transformers', 'clustering', 'evaluation'][i % 3]} and other terms.`,
      why_useful: `This resource earns its place because it explains topic number ${i} clearly enough.`,
      topics: ['nlp'],
    }),
  )

  const index = buildIndex(large)
  const queries = ['tokenization', 'atten', 'embeddings evaluation', 'regression', 'transfomer']

  it('indexes 1,000 records', () => {
    expect(index.documentCount).toBe(1000)
  })

  it('keeps p95 query latency under 50ms', () => {
    const timings: number[] = []

    for (let i = 0; i < 200; i += 1) {
      const query = queries[i % queries.length]!
      const start = performance.now()
      runSearch(index, query)
      timings.push(performance.now() - start)
    }

    timings.sort((a, b) => a - b)
    const p95 = timings[Math.floor(timings.length * 0.95)]!

    expect(p95, `p95 was ${p95.toFixed(2)}ms`).toBeLessThan(50)
  })

  it('returns results rather than silently matching nothing at scale', () => {
    expect(runSearch(index, 'tokenization').length).toBeGreaterThan(0)
  })
})

describe('serialisation round trip', () => {
  it('a deserialised index searches identically to the original', () => {
    // The build ships a serialised index; if load options drift from build
    // options, MiniSearch returns nothing instead of failing loudly.
    const original = buildIndex(catalogue)
    const reloaded = MiniSearch.loadJSON<SearchDocument>(
      JSON.stringify(original),
      miniSearchOptions(),
    )

    for (const query of ['tokenization', 'attention', 'algebra']) {
      expect(runSearch(reloaded, query)).toEqual(runSearch(original, query))
    }
  })
})
