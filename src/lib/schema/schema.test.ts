import { describe, expect, it } from 'vitest'

import {
  makeDataset,
  makePaper,
  makePathItem,
  makeResource,
  makeTopic,
  makeVideo,
} from '@tests/fixtures/content.ts'

import { zLearningPath, zModule } from './path.ts'
import { zDataset, zPaper, zResourceBase, zVideo } from './resource.ts'
import { zTopic } from './taxonomy.ts'

/**
 * Per-record content rules.
 *
 * These are the rules a single record can violate on its own. Cross-record rules
 * (uniqueness, references, cycles) live in src/lib/content/rules.test.ts.
 *
 * Each test corrupts exactly ONE field of an otherwise valid fixture, so a
 * failure identifies the rule unambiguously.
 */

/** Asserts the parse failed, and returns the messages for inspection. */
function expectRejected(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
  value: unknown,
) {
  const result = schema.safeParse(value) as {
    success: boolean
    error?: { issues: Array<{ path: PropertyKey[]; message: string }> }
  }

  expect(result.success).toBe(false)
  return result.error?.issues ?? []
}

function messagesFor(issues: Array<{ path: PropertyKey[]; message: string }>, field: string) {
  return issues.filter((i) => i.path.join('.') === field).map((i) => i.message)
}

describe('fixtures are valid to begin with', () => {
  // Without this, a fixture that is broken for an unrelated reason would make
  // every test below pass for the wrong reason.
  it.each([
    ['resource', zResourceBase, makeResource()],
    ['video', zVideo, makeVideo()],
    ['dataset', zDataset, makeDataset()],
    ['paper', zPaper, makePaper()],
    ['topic', zTopic, makeTopic()],
  ])('%s fixture passes validation unmodified', (_name, schema, fixture) => {
    const result = schema.safeParse(fixture)
    if (!result.success) {
      throw new Error(`fixture invalid: ${JSON.stringify(result.error.issues, null, 2)}`)
    }
    expect(result.success).toBe(true)
  })
})

describe('rule 1 — ids are kebab-case', () => {
  it.each([['Test-Resource'], ['test_resource'], ['test resource'], ['-leading'], ['trailing-']])(
    'rejects id %s',
    (id) => {
      const issues = expectRejected(zResourceBase, makeResource({ id }))
      expect(messagesFor(issues, 'id').join(' ')).toMatch(/kebab-case/i)
    },
  )

  it('accepts digits inside an id', () => {
    expect(zResourceBase.safeParse(makeResource({ id: 'res-cs224n-lecture-3' })).success).toBe(true)
  })
})

describe('rule 4 — external links must be https with no credentials', () => {
  it.each([['http://example.com/guide'], ['ftp://example.com/guide'], ['not-a-url']])(
    'rejects %s',
    (url) => {
      expectRejected(zResourceBase, makeResource({ url }))
    },
  )

  it('rejects javascript: and data: urls', () => {
    expectRejected(zResourceBase, makeResource({ url: 'javascript:alert(1)' }))
    expectRejected(zResourceBase, makeResource({ url: 'data:text/html,<script>alert(1)</script>' }))
  })

  it('rejects a url with embedded credentials', () => {
    const issues = expectRejected(
      zResourceBase,
      makeResource({ url: 'https://user:secret@example.com/guide' }),
    )
    expect(issues.map((i) => i.message).join(' ')).toMatch(/credential/i)
  })

  it('accepts a plain https url', () => {
    expect(
      zResourceBase.safeParse(makeResource({ url: 'https://example.com/a/b?c=d' })).success,
    ).toBe(true)
  })
})

describe('rule 5 — "verified" requires the evidence of a verification', () => {
  it('rejects verified with no url', () => {
    const issues = expectRejected(
      zResourceBase,
      makeResource({
        status: 'verified',
        url: null,
        last_verified_at: '2026-01-01',
        verified_by: 'a',
      }),
    )
    expect(issues.map((i) => i.message).join(' ')).toMatch(/rule 5|rule 6/)
  })

  it('rejects verified with no last_verified_at', () => {
    const issues = expectRejected(
      zResourceBase,
      makeResource({ status: 'verified', last_verified_at: null, verified_by: 'a' }),
    )
    expect(messagesFor(issues, 'last_verified_at').join(' ')).toMatch(/requires last_verified_at/)
  })

  it('rejects verified with no verified_by', () => {
    const issues = expectRejected(
      zResourceBase,
      makeResource({ status: 'verified', last_verified_at: '2026-01-01', verified_by: null }),
    )
    expect(messagesFor(issues, 'verified_by').join(' ')).toMatch(/requires verified_by/)
  })

  it('accepts a fully evidenced verified record', () => {
    const record = makeResource({
      status: 'verified',
      url: 'https://example.com/guide',
      last_verified_at: '2026-08-01',
      verified_by: 'pranav',
    })
    expect(zResourceBase.safeParse(record).success).toBe(true)
  })
})

describe('rule 6 — no url means the record cannot be anything but unverified', () => {
  it.each([['verified'], ['stale'], ['broken'], ['deprecated']])(
    'rejects url:null with status %s',
    (status) => {
      const issues = expectRejected(zResourceBase, makeResource({ url: null, status }))
      expect(issues.map((i) => i.message).join(' ')).toMatch(/must have status "unverified"|rule 5/)
    },
  )

  it('accepts url:null with status unverified', () => {
    expect(zResourceBase.safeParse(makeResource({ url: null, status: 'unverified' })).success).toBe(
      true,
    )
  })
})

describe('rule 7 — why_useful must be substantive', () => {
  it('rejects a why_useful under 40 characters', () => {
    const issues = expectRejected(zResourceBase, makeResource({ why_useful: 'It is good.' }))
    expect(messagesFor(issues, 'why_useful').join(' ')).toMatch(/at least 40 characters/)
  })

  it('rejects an empty why_useful', () => {
    expectRejected(zResourceBase, makeResource({ why_useful: '' }))
  })
})

describe('rule 8 — durations and ranges must be sane', () => {
  it.each([[0], [-30], [12.5]])('rejects estimated_duration_minutes of %s', (minutes) => {
    expectRejected(zResourceBase, makeResource({ estimated_duration_minutes: minutes }))
  })

  it('accepts a null duration for open-ended material', () => {
    expect(
      zResourceBase.safeParse(makeResource({ estimated_duration_minutes: null })).success,
    ).toBe(true)
  })

  it('rejects an hour range whose min exceeds its max', () => {
    const path = {
      id: 'p',
      title: 'A path',
      audience: 'Someone who wants an inverted range rejected here.',
      outcome_statement: 'You will see this record fail validation as intended.',
      prerequisites: { topics: [], description: 'None at all.' },
      estimated_hours: { min: 40, max: 10 },
      estimate_assumptions: 'Assumes nothing, because this record is invalid.',
      modules: [
        {
          id: 'm',
          title: 'A module',
          summary: 'A summary long enough to pass the minimum length rule.',
          items: [makePathItem()],
        },
      ],
      suggested_project_ids: [],
      completion_criteria: 'Never.',
      next_path_ids: [],
      status: 'unverified',
    }
    const issues = expectRejected(zLearningPath, path)
    expect(issues.map((i) => i.message).join(' ')).toMatch(/less than or equal/)
  })
})

describe('rule 11 — module item order must be unique and contiguous from 1', () => {
  const moduleWith = (orders: number[]) => ({
    id: 'test-module',
    title: 'A test module',
    summary: 'A module summary long enough to satisfy the minimum length constraint.',
    items: orders.map((order) => makePathItem({ order })),
  })

  it('rejects duplicate order values', () => {
    const issues = expectRejected(zModule, moduleWith([1, 2, 2]))
    expect(issues.map((i) => i.message).join(' ')).toMatch(/rule 11/)
  })

  it('rejects a gap in the sequence', () => {
    const issues = expectRejected(zModule, moduleWith([1, 2, 4]))
    expect(issues.map((i) => i.message).join(' ')).toMatch(/contiguous/)
  })

  it('rejects a sequence that does not start at 1', () => {
    expectRejected(zModule, moduleWith([2, 3]))
  })

  it('accepts a contiguous sequence given out of order', () => {
    expect(zModule.safeParse(moduleWith([3, 1, 2])).success).toBe(true)
  })
})

describe('path items — resource and checkpoint shapes are mutually exclusive', () => {
  it('rejects a resource item with no resource_id', () => {
    expectRejected(zModule, {
      id: 'm',
      title: 'A module',
      summary: 'A summary long enough to satisfy the minimum length constraint.',
      items: [makePathItem({ resource_id: null })],
    })
  })

  it('rejects a checkpoint item that also references a resource', () => {
    expectRejected(zModule, {
      id: 'm',
      title: 'A module',
      summary: 'A summary long enough to satisfy the minimum length constraint.',
      items: [
        makePathItem({
          kind: 'checkpoint',
          resource_id: 'test-resource',
          checkpoint: {
            title: 'Check',
            prompt: 'A prompt that is long enough to pass validation here.',
            how_to_self_assess: 'An assessment description long enough to pass validation.',
          },
        }),
      ],
    })
  })
})

describe('rule 13 — claiming peer review requires a venue', () => {
  it('rejects peer-reviewed with no venue', () => {
    const issues = expectRejected(
      zPaper,
      makePaper({ peer_review_status: 'peer-reviewed', venue: null }),
    )
    expect(messagesFor(issues, 'venue').join(' ')).toMatch(/rule 13/)
  })

  it('accepts peer-reviewed with a venue', () => {
    expect(
      zPaper.safeParse(makePaper({ peer_review_status: 'peer-reviewed', venue: 'NeurIPS 2020' }))
        .success,
    ).toBe(true)
  })

  it('accepts "unknown" review status, which is the honest default', () => {
    expect(
      zPaper.safeParse(makePaper({ peer_review_status: 'unknown', venue: null })).success,
    ).toBe(true)
  })
})

describe('rule 14 — datasets must declare a licence', () => {
  it('rejects a dataset with no licence field at all', () => {
    const record = makeDataset()
    delete (record as Record<string, unknown>).license
    expectRejected(zDataset, record)
  })

  it('rejects an empty licence string', () => {
    expectRejected(zDataset, makeDataset({ license: '' }))
  })

  it('accepts the explicit string "unknown", which the UI surfaces as a warning', () => {
    expect(zDataset.safeParse(makeDataset({ license: 'unknown' })).success).toBe(true)
  })

  it('requires at least one modality', () => {
    expectRejected(zDataset, makeDataset({ modality: [] }))
  })
})

describe('unknown fields are rejected rather than silently ignored', () => {
  // A typo in a JSON field name would otherwise drop the value without a word.
  it('rejects a misspelled field on a resource', () => {
    const issues = expectRejected(zResourceBase, makeResource({ dificulty: 'beginner' }))
    expect(issues.length).toBeGreaterThan(0)
  })

  it('rejects an unknown field on a topic', () => {
    expectRejected(zTopic, makeTopic({ colour: 'blue' }))
  })
})

describe('videos carry their own metadata', () => {
  it('requires the video-specific fields', () => {
    const record = makeVideo()
    delete (record as Record<string, unknown>).channel
    expectRejected(zVideo, record)
  })

  it('accepts embeddable:null, meaning "unknown, so link out"', () => {
    expect(zVideo.safeParse(makeVideo({ embeddable: null })).success).toBe(true)
  })
})

describe('dates must be ISO calendar dates', () => {
  it.each([['25-08-2026'], ['2026/08/25'], ['August 25, 2026'], ['2026-13-01']])(
    'rejects added_at of %s',
    (added_at) => {
      expectRejected(zResourceBase, makeResource({ added_at }))
    },
  )
})
