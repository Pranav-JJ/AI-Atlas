import { describe, expect, it } from 'vitest'

import { makeResource, makeTopic } from '@tests/fixtures/content.ts'

import {
  countResourcesByTopic,
  getAncestors,
  getChildren,
  getTopic,
  groupTopicsByDomain,
  resourcesForTopic,
} from './topics.ts'

const topics = [
  makeTopic({ id: 'nlp', domain: 'nlp', parentId: null, order: 0 }),
  makeTopic({ id: 'tokenization', domain: 'nlp', parentId: 'nlp', order: 1 }),
  makeTopic({ id: 'embeddings', domain: 'nlp', parentId: 'nlp', order: 2 }),
  makeTopic({ id: 'bpe', domain: 'nlp', parentId: 'tokenization', order: 1 }),
  makeTopic({ id: 'foundations', domain: 'foundations', parentId: null, order: 0 }),
  makeTopic({ id: 'python', domain: 'foundations', parentId: 'foundations', order: 1 }),
]

describe('getTopic', () => {
  it('finds a topic by id', () => {
    expect(getTopic(topics, 'tokenization')?.id).toBe('tokenization')
  })

  it('returns null for an unknown id rather than throwing', () => {
    expect(getTopic(topics, 'nope')).toBeNull()
  })
})

describe('getChildren', () => {
  it('returns direct children only, not grandchildren', () => {
    expect(getChildren(topics, 'nlp').map((t) => t.id)).toEqual(['tokenization', 'embeddings'])
  })

  it('sorts by order', () => {
    const shuffled = [
      makeTopic({ id: 'c', parentId: 'p', order: 3 }),
      makeTopic({ id: 'a', parentId: 'p', order: 1 }),
      makeTopic({ id: 'b', parentId: 'p', order: 2 }),
    ]
    expect(getChildren(shuffled, 'p').map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties on order by name, so the order is stable', () => {
    const tied = [
      makeTopic({ id: 'zebra', name: 'Zebra', parentId: 'p', order: 1 }),
      makeTopic({ id: 'alpha', name: 'Alpha', parentId: 'p', order: 1 }),
    ]
    expect(getChildren(tied, 'p').map((t) => t.id)).toEqual(['alpha', 'zebra'])
  })

  it('returns an empty array for a leaf', () => {
    expect(getChildren(topics, 'bpe')).toEqual([])
  })
})

describe('getAncestors', () => {
  it('returns the chain from root downwards, excluding the topic itself', () => {
    expect(getAncestors(topics, 'bpe').map((t) => t.id)).toEqual(['nlp', 'tokenization'])
  })

  it('returns nothing for a root topic', () => {
    expect(getAncestors(topics, 'nlp')).toEqual([])
  })

  it('returns nothing for an unknown topic', () => {
    expect(getAncestors(topics, 'ghost')).toEqual([])
  })

  it('stops rather than hanging if the data contains a cycle', () => {
    // Rule 10 forbids this, but this code runs in a browser against generated
    // content — an infinite loop here would hang the tab, not fail a build.
    const cyclic = [makeTopic({ id: 'a', parentId: 'b' }), makeTopic({ id: 'b', parentId: 'a' })]
    expect(getAncestors(cyclic, 'a').length).toBeLessThanOrEqual(2)
  })

  it('stops when a parent reference dangles', () => {
    const orphan = [makeTopic({ id: 'child', parentId: 'missing' })]
    expect(getAncestors(orphan, 'child')).toEqual([])
  })
})

describe('groupTopicsByDomain', () => {
  it('groups by domain with the root separated from its children', () => {
    const groups = groupTopicsByDomain(topics)
    const nlp = groups.find((g) => g.domain === 'nlp')

    expect(nlp?.root?.id).toBe('nlp')
    expect(nlp?.children.map((t) => t.id)).toEqual(['tokenization', 'embeddings'])
  })

  it('orders domains by the declared display order, not alphabetically', () => {
    const domains = groupTopicsByDomain(topics).map((g) => g.domain)
    expect(domains).toEqual(['foundations', 'nlp'])
  })

  it('omits domains with no topics rather than rendering an empty section', () => {
    expect(groupTopicsByDomain(topics).map((g) => g.domain)).not.toContain('deep-learning')
  })

  it('lists children of the root only, so grandchildren do not flatten into it', () => {
    const nlp = groupTopicsByDomain(topics).find((g) => g.domain === 'nlp')
    expect(nlp?.children.map((t) => t.id)).not.toContain('bpe')
  })
})

describe('resourcesForTopic', () => {
  const resources = [
    makeResource({ id: 'a', topics: ['tokenization'], subtopics: [] }),
    makeResource({ id: 'b', topics: ['nlp'], subtopics: ['bpe'] }),
    makeResource({ id: 'c', topics: ['python'], subtopics: [] }),
  ]

  it('matches on topics', () => {
    expect(resourcesForTopic(resources, 'tokenization').map((r) => r.id)).toEqual(['a'])
  })

  it('matches on subtopics too', () => {
    expect(resourcesForTopic(resources, 'bpe').map((r) => r.id)).toEqual(['b'])
  })

  it('does NOT roll descendants up into their parent', () => {
    // A resource tagged `tokenization` must not appear under `nlp`, or a domain
    // page becomes an undifferentiated dump of everything beneath it.
    expect(resourcesForTopic(resources, 'nlp').map((r) => r.id)).toEqual(['b'])
  })

  it('returns an empty array for a topic with nothing tagged', () => {
    expect(resourcesForTopic(resources, 'embeddings')).toEqual([])
  })
})

describe('countResourcesByTopic', () => {
  it('counts each resource once per topic', () => {
    const counts = countResourcesByTopic(
      [
        makeResource({ id: 'a', topics: ['nlp', 'tokenization'] }),
        makeResource({ id: 'b', topics: ['nlp'] }),
      ],
      topics,
    )

    expect(counts.get('nlp')).toBe(2)
    expect(counts.get('tokenization')).toBe(1)
  })

  it('does not double-count a topic listed in both topics and subtopics', () => {
    const counts = countResourcesByTopic(
      [makeResource({ id: 'a', topics: ['nlp'], subtopics: ['nlp'] })],
      topics,
    )
    expect(counts.get('nlp')).toBe(1)
  })

  it('reports zero for topics with no resources, rather than omitting them', () => {
    const counts = countResourcesByTopic([], topics)
    expect(counts.get('embeddings')).toBe(0)
  })

  it('ignores tags that reference an unknown topic', () => {
    const counts = countResourcesByTopic([makeResource({ id: 'a', topics: ['ghost'] })], topics)
    expect(counts.has('ghost')).toBe(false)
  })
})
