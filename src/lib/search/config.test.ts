import MiniSearch from 'minisearch'
import { describe, expect, it } from 'vitest'

import { makeResource } from '@tests/fixtures/content.ts'

import {
  miniSearchOptions,
  SEARCH_BOOSTS,
  SEARCH_FIELDS,
  toSearchDocument,
  type SearchDocument,
} from './config.ts'

describe('toSearchDocument', () => {
  it('projects the fields worth matching on', () => {
    const doc = toSearchDocument(
      makeResource({
        id: 'res-x',
        title: 'Tokenization primer',
        description: 'A description of subword tokenization for beginners.',
        why_useful: 'Because tokenization is where most mental models of an LLM first break down.',
        topics: ['nlp', 'text-preprocessing-tokenization'],
        subtopics: ['bpe'],
        provider_id: 'hugging-face',
        author: 'Jane Doe',
        resource_type: 'tutorial',
      }),
    )

    expect(doc.id).toBe('res-x')
    expect(doc.title).toBe('Tokenization primer')
    expect(doc.topicText).toBe('nlp text-preprocessing-tokenization bpe')
    expect(doc.sourceText).toBe('hugging-face Jane Doe tutorial')
  })

  it('drops null provider and author rather than emitting "null" as a token', () => {
    const doc = toSearchDocument(
      makeResource({ provider_id: null, author: null, resource_type: 'book' }),
    )

    expect(doc.sourceText).toBe('book')
    expect(doc.sourceText).not.toMatch(/null/)
  })

  it('produces only the declared search fields plus the id', () => {
    // Anything extra would bloat the index chunk without improving relevance.
    const doc = toSearchDocument(makeResource())
    expect(Object.keys(doc).sort()).toEqual([...SEARCH_FIELDS, 'id'].sort())
  })

  it('every boosted field is an indexed field', () => {
    for (const field of Object.keys(SEARCH_BOOSTS)) {
      expect(SEARCH_FIELDS).toContain(field as (typeof SEARCH_FIELDS)[number])
    }
  })
})

describe('miniSearchOptions', () => {
  it('returns a fresh object each call, so builder and loader cannot share state', () => {
    const a = miniSearchOptions()
    const b = miniSearchOptions()

    expect(a).not.toBe(b)
    expect(a.fields).not.toBe(b.fields)
    expect(a).toEqual(b)
  })
})

describe('an index built with these options round-trips', () => {
  // This is the contract that matters: MiniSearch requires an index be loaded
  // with the same options it was built with. If that ever diverges, search
  // silently returns nothing rather than failing loudly.
  const docs: SearchDocument[] = [
    toSearchDocument(
      makeResource({
        id: 'res-tokenization',
        title: 'Tokenization algorithms',
        why_useful: 'Explains subword tokenization before embeddings, which is the useful order.',
        topics: ['text-preprocessing-tokenization'],
      }),
    ),
    toSearchDocument(
      makeResource({
        id: 'res-linear-algebra',
        title: 'Essence of linear algebra',
        why_useful: 'Builds geometric intuition for matrices, which later topics quietly assume.',
        topics: ['linear-algebra'],
      }),
    ),
  ]

  function buildAndReload() {
    const index = new MiniSearch<SearchDocument>(miniSearchOptions())
    index.addAll(docs)
    return MiniSearch.loadJSON<SearchDocument>(JSON.stringify(index), miniSearchOptions())
  }

  it('finds a document by a title term after serialisation', () => {
    const results = buildAndReload().search('tokenization')
    expect(results.map((r) => r.id)).toContain('res-tokenization')
  })

  it('finds a document by a topic term', () => {
    const results = buildAndReload().search('linear-algebra')
    expect(results.map((r) => r.id)).toContain('res-linear-algebra')
  })

  it('ranks a title match above a body-only match', () => {
    const results = buildAndReload().search('algebra', { boost: SEARCH_BOOSTS })
    expect(results[0]?.id).toBe('res-linear-algebra')
  })

  it('returns nothing for a term that appears in no document', () => {
    expect(buildAndReload().search('quantumchromodynamics')).toEqual([])
  })
})
