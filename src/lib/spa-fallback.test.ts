import { describe, expect, it } from 'vitest'

import { applyFallbackRedirect, decodeFallbackUrl, encodeFallbackUrl } from './spa-fallback.ts'

const BASE = '/AI-Atlas/'

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
    expect(encodeFallbackUrl(BASE, '/AI-Atlas/library', '', '')).toBe('/AI-Atlas/?/library')
  })

  it('moves the query string behind an & separator', () => {
    expect(encodeFallbackUrl(BASE, '/AI-Atlas/library', '?q=nlp', '')).toBe(
      '/AI-Atlas/?/library&q=nlp',
    )
  })

  it('escapes ampersands in the original query so they survive the round trip', () => {
    expect(encodeFallbackUrl(BASE, '/AI-Atlas/library', '?q=nlp&type=video', '')).toBe(
      '/AI-Atlas/?/library&q=nlp~and~type=video',
    )
  })

  it('preserves the hash', () => {
    expect(encodeFallbackUrl(BASE, '/AI-Atlas/library', '?q=nlp', '#results')).toBe(
      '/AI-Atlas/?/library&q=nlp#results',
    )
  })

  it('works when the site is served from the domain root', () => {
    expect(encodeFallbackUrl('/', '/library', '?q=nlp', '')).toBe('/?/library&q=nlp')
  })
})

describe('decodeFallbackUrl', () => {
  it('returns null for a normal visit with no query', () => {
    expect(decodeFallbackUrl('/AI-Atlas/', '', '')).toBeNull()
  })

  it('returns null for a normal query string that is not a fallback', () => {
    expect(decodeFallbackUrl('/AI-Atlas/library', '?q=nlp', '')).toBeNull()
  })

  it('restores a route with query and hash', () => {
    expect(decodeFallbackUrl('/AI-Atlas/', '?/library&q=nlp~and~type=video', '#results')).toBe(
      '/AI-Atlas/library?q=nlp&type=video#results',
    )
  })
})

describe('round trip', () => {
  const cases = [
    '/AI-Atlas/library',
    '/AI-Atlas/library?q=nlp',
    '/AI-Atlas/library?q=nlp&type=video&difficulty=beginner',
    '/AI-Atlas/library?q=nlp&type=video#results',
    '/AI-Atlas/paths/nlp-foundations',
    '/AI-Atlas/library/res-some-resource-id?from=dashboard',
    // The filter state that Phase 4 puts in the URL — the real reason this matters.
    '/AI-Atlas/library?q=attention&topic=nlp&topic=transformers&cost=free&sort=curated',
  ]

  it.each(cases)('restores %s exactly', (url) => {
    expect(roundTrip(BASE, url)).toBe(url)
  })

  it('restores correctly when hosted at the domain root', () => {
    expect(roundTrip('/', '/library?q=nlp&type=video')).toBe('/library?q=nlp&type=video')
  })
})

describe('applyFallbackRedirect (browser integration)', () => {
  function setLocation(url: string) {
    window.history.replaceState(null, '', url)
  }

  it('rewrites history when the load came from the 404 fallback', () => {
    setLocation('/AI-Atlas/?/library&q=nlp~and~type=video')

    applyFallbackRedirect()

    expect(window.location.pathname).toBe('/AI-Atlas/library')
    expect(window.location.search).toBe('?q=nlp&type=video')
  })

  it('leaves a normal visit untouched', () => {
    setLocation('/AI-Atlas/library?q=nlp')

    applyFallbackRedirect()

    expect(window.location.pathname).toBe('/AI-Atlas/library')
    expect(window.location.search).toBe('?q=nlp')
  })

  it('leaves the bare home page untouched', () => {
    setLocation('/AI-Atlas/')

    applyFallbackRedirect()

    expect(window.location.pathname).toBe('/AI-Atlas/')
    expect(window.location.search).toBe('')
  })

  it('preserves the hash through the rewrite', () => {
    setLocation('/AI-Atlas/?/paths/nlp-foundations#module-2')

    applyFallbackRedirect()

    expect(window.location.pathname).toBe('/AI-Atlas/paths/nlp-foundations')
    expect(window.location.hash).toBe('#module-2')
  })

  it('does not add a history entry, so Back still leaves the site', () => {
    setLocation('/AI-Atlas/?/library')
    const lengthBefore = window.history.length

    applyFallbackRedirect()

    expect(window.history.length).toBe(lengthBefore)
  })
})
