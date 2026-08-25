import { describe, expect, it } from 'vitest'

import { decodeFallbackUrl, encodeFallbackUrl } from './spa-fallback.ts'

const BASE = '/ai-atlas/'

/** Full round trip: what 404.html produces, fed back through what the app consumes. */
function roundTrip(base: string, url: string): string {
  const [pathAndQuery = '', hashPart] = url.split('#')
  const [pathname = '', queryPart] = pathAndQuery.split('?')
  const search = queryPart ? `?${queryPart}` : ''
  const hash = hashPart ? `#${hashPart}` : ''

  const encoded = encodeFallbackUrl(base, pathname, search, hash)

  const [encPathAndQuery = '', encHashPart] = encoded.split('#')
  const [encPathname = '', encQueryPart] = encPathAndQuery.split('?')

  const restored = decodeFallbackUrl(
    encPathname,
    encQueryPart ? `?${encQueryPart}` : '',
    encHashPart ? `#${encHashPart}` : '',
  )

  return restored ?? '<not-a-fallback>'
}

describe('encodeFallbackUrl', () => {
  it('encodes a plain deep route', () => {
    expect(encodeFallbackUrl(BASE, '/ai-atlas/library', '', '')).toBe('/ai-atlas/?/library')
  })

  it('moves the query string behind an & separator', () => {
    expect(encodeFallbackUrl(BASE, '/ai-atlas/library', '?q=nlp', '')).toBe(
      '/ai-atlas/?/library&q=nlp',
    )
  })

  it('escapes ampersands in the original query so they survive the round trip', () => {
    expect(encodeFallbackUrl(BASE, '/ai-atlas/library', '?q=nlp&type=video', '')).toBe(
      '/ai-atlas/?/library&q=nlp~and~type=video',
    )
  })

  it('preserves the hash', () => {
    expect(encodeFallbackUrl(BASE, '/ai-atlas/library', '?q=nlp', '#results')).toBe(
      '/ai-atlas/?/library&q=nlp#results',
    )
  })

  it('works when the site is served from the domain root', () => {
    expect(encodeFallbackUrl('/', '/library', '?q=nlp', '')).toBe('/?/library&q=nlp')
  })
})

describe('decodeFallbackUrl', () => {
  it('returns null for a normal visit with no query', () => {
    expect(decodeFallbackUrl('/ai-atlas/', '', '')).toBeNull()
  })

  it('returns null for a normal query string that is not a fallback', () => {
    expect(decodeFallbackUrl('/ai-atlas/library', '?q=nlp', '')).toBeNull()
  })

  it('restores a route with query and hash', () => {
    expect(decodeFallbackUrl('/ai-atlas/', '?/library&q=nlp~and~type=video', '#results')).toBe(
      '/ai-atlas/library?q=nlp&type=video#results',
    )
  })
})

describe('round trip', () => {
  const cases = [
    '/ai-atlas/library',
    '/ai-atlas/library?q=nlp',
    '/ai-atlas/library?q=nlp&type=video&difficulty=beginner',
    '/ai-atlas/library?q=nlp&type=video#results',
    '/ai-atlas/paths/nlp-foundations',
    '/ai-atlas/library/res-some-resource-id?from=dashboard',
    // The filter state that Phase 4 puts in the URL — the real reason this matters.
    '/ai-atlas/library?q=attention&topic=nlp&topic=transformers&cost=free&sort=curated',
  ]

  it.each(cases)('restores %s exactly', (url) => {
    expect(roundTrip(BASE, url)).toBe(url)
  })

  it('restores correctly when hosted at the domain root', () => {
    expect(roundTrip('/', '/library?q=nlp&type=video')).toBe('/library?q=nlp&type=video')
  })
})
