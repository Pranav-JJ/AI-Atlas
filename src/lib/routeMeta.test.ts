import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { allRoutes } from '@/content/generated/index.ts'
import { glossary, projects, resources, topics } from '@/content/generated/index.ts'

import { formatTitle, recordRoutes, SECTION_META, truncateDescription } from './routeMeta.ts'

describe('formatTitle', () => {
  it('appends the site name to a page title', () => {
    expect(formatTitle('Glossary')).toBe('Glossary — AI Atlas')
  })

  it('does not repeat the site name on the home page', () => {
    expect(formatTitle('AI Atlas')).toBe('AI Atlas')
  })
})

describe('truncateDescription', () => {
  it('leaves a short description alone', () => {
    expect(truncateDescription('Short enough.')).toBe('Short enough.')
  })

  it('collapses whitespace, so a wrapped JSON string does not become ragged', () => {
    expect(truncateDescription('a   b\n\nc')).toBe('a b c')
  })

  it('cuts at a word boundary and marks the truncation', () => {
    const long = 'word '.repeat(80)
    const result = truncateDescription(long, 100)

    expect(result.length).toBeLessThanOrEqual(101)
    expect(result.endsWith('…')).toBe(true)
    expect(result).not.toMatch(/wo…$/)
  })
})

describe('recordRoutes', () => {
  it('builds a path from the prefix and the record id', () => {
    const routes = recordRoutes(
      [{ id: 'res-x', title: 'A thing', description: 'Describes it.' }],
      '/library',
    )
    expect(routes[0]?.path).toBe('/library/res-x')
  })

  it('falls back through the fields different collections actually use', () => {
    // Glossary terms have `term`, projects have `problem_statement`, and so on.
    expect(
      recordRoutes([{ id: 'a', term: 'Overfitting', plain_definition: 'x'.repeat(30) }], '/g')[0]
        ?.title,
    ).toBe('Overfitting')
    expect(
      recordRoutes([{ id: 'b', name: 'A topic', short_definition: 'y'.repeat(30) }], '/t')[0]
        ?.title,
    ).toBe('A topic')
  })

  it('uses the id rather than an empty title when nothing else exists', () => {
    expect(recordRoutes([{ id: 'orphan' }], '/x')[0]?.title).toBe('orphan')
  })
})

describe('the generated route list', () => {
  it('covers every section plus every content record', () => {
    const expected =
      SECTION_META.length + resources.length + projects.length + glossary.length + topics.length + 1

    expect(allRoutes.length).toBe(expected)
  })

  it('contains no duplicate paths', () => {
    // A duplicate would mean one pre-rendered file silently overwriting another.
    const paths = allRoutes.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('gives every route a non-empty title', () => {
    for (const route of allRoutes) {
      expect(route.title.trim().length, route.path).toBeGreaterThan(0)
    }
  })

  it('gives every route a description a preview card can show', () => {
    for (const route of allRoutes) {
      expect(route.description.trim().length, route.path).toBeGreaterThan(10)
      expect(route.description.length, route.path).toBeLessThanOrEqual(201)
    }
  })

  it('starts every path with a slash and never ends with one', () => {
    for (const route of allRoutes) {
      expect(route.path.startsWith('/'), route.path).toBe(true)
      if (route.path !== '/') expect(route.path.endsWith('/'), route.path).toBe(false)
    }
  })

  it('includes a page for every resource, so every record is shareable', () => {
    const paths = new Set(allRoutes.map((r) => r.path))
    for (const resource of resources) {
      expect(paths.has(`/library/${resource.id}`), resource.id).toBe(true)
    }
  })
})

describe('the built output carries per-route metadata', () => {
  /**
   * These read dist/, so they only mean anything after a build. They are the
   * check that matters most for sharing: social crawlers do not run JavaScript,
   * so a title applied by React never reaches a link preview.
   */
  function readBuilt(path: string): string | null {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return null
    }
  }

  const home = readBuilt('dist/index.html')

  it.runIf(home !== null)('gives the home page a canonical URL', () => {
    expect(home).toMatch(/<link rel="canonical" href="https:\/\/[^"]+" \/>/)
  })

  it.runIf(home !== null)('gives a record page its own title, not the site default', () => {
    const record = readBuilt('dist/glossary/term-overfitting/index.html')
    expect(record).not.toBeNull()
    expect(record).toContain('<title>Overfitting — AI Atlas</title>')
    expect(record).toContain('og:title')
  })

  it.runIf(home !== null)('writes a sitemap listing every route', () => {
    const sitemap = readBuilt('dist/sitemap.xml')
    expect(sitemap).not.toBeNull()

    const count = (sitemap ?? '').match(/<url>/g)?.length ?? 0
    expect(count).toBe(allRoutes.length)
  })

  it.runIf(home !== null)('writes a robots.txt pointing at the sitemap', () => {
    const robots = readBuilt('dist/robots.txt')
    expect(robots).toContain('Sitemap:')
    expect(robots).toContain('sitemap.xml')
  })

  it.runIf(home !== null)('escapes markup in metadata rather than emitting it raw', () => {
    // Titles come from content, which is user-editable via pull request.
    const record = readBuilt('dist/library/ds-squad/index.html') ?? ''
    const head = record.slice(0, record.indexOf('</head>'))

    expect(head).not.toMatch(/content="[^"]*<[a-z]/i)
  })
})
