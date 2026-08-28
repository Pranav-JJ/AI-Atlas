import { describe, expect, it } from 'vitest'

import { readPersistedState } from './migrations.ts'
import { CURRENT_SCHEMA_VERSION, defaultState, type PersistedState } from './schema.ts'

function validState(overrides: Partial<PersistedState> = {}): PersistedState {
  return { ...defaultState(), ...overrides }
}

describe('reading nothing', () => {
  it.each([null, undefined])('returns defaults for %s without flagging recovery', (raw) => {
    const { state, recovered } = readPersistedState(raw)

    expect(state).toEqual(defaultState())
    expect(recovered).toBe(false)
  })
})

describe('reading valid state', () => {
  it('round-trips through JSON unchanged', () => {
    const original = validState({
      profile: {
        level: 'beginner',
        goal: 'nlp-practitioner',
        weeklyTargetMinutes: 120,
        updatedAt: '2026-08-28T10:00:00.000Z',
      },
      bookmarks: { 'res-a': { at: '2026-08-28T10:00:00.000Z' } },
      completions: { 'res-b': { at: '2026-08-28T10:00:00.000Z' } },
      recentlyViewed: [{ resourceId: 'res-a', viewedAt: '2026-08-28T10:00:00.000Z' }],
      dismissedNotices: ['onboarding'],
    })

    const { state, recovered } = readPersistedState(JSON.stringify(original))

    expect(state).toEqual(original)
    expect(recovered).toBe(false)
  })

  it('accepts an already-parsed object as well as a string', () => {
    const original = validState()
    expect(readPersistedState(original).state).toEqual(original)
  })
})

describe('corrupt input never throws', () => {
  it.each([
    ['truncated JSON', '{"schemaVersion":1,"profile":'],
    ['not JSON at all', 'hello world'],
    ['a JSON array', '[]'],
    ['a JSON string', '"just a string"'],
    ['a JSON number', '42'],
    ['null literal', 'null'],
    ['empty string', ''],
  ])('falls back to defaults for %s', (_name, raw) => {
    let result: ReturnType<typeof readPersistedState> | undefined

    expect(() => {
      result = readPersistedState(raw)
    }).not.toThrow()

    expect(result?.state).toEqual(defaultState())
    expect(result?.recovered).toBe(true)
  })
})

describe('partial corruption is salvaged rather than wiped', () => {
  it('keeps the fields that parse and defaults the one that does not', () => {
    // One broken bookmark must not cost the user their completions.
    const damaged = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profile: { level: 'beginner', goal: null, weeklyTargetMinutes: null, updatedAt: null },
      completions: { 'res-kept': { at: '2026-08-28T10:00:00.000Z' } },
      checkpointCompletions: {},
      bookmarks: 'this is not an object',
      recentlyViewed: [],
      dismissedNotices: [],
    }

    const { state, recovered } = readPersistedState(damaged)

    expect(recovered).toBe(true)
    expect(state.completions).toEqual({ 'res-kept': { at: '2026-08-28T10:00:00.000Z' } })
    expect(state.profile.level).toBe('beginner')
    expect(state.bookmarks).toEqual({})
  })

  it('drops an invalid profile without touching bookmarks', () => {
    const damaged = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profile: { level: 'wizard', goal: null, weeklyTargetMinutes: null, updatedAt: null },
      completions: {},
      checkpointCompletions: {},
      bookmarks: { 'res-a': { at: '2026-08-28T10:00:00.000Z' } },
      recentlyViewed: [],
      dismissedNotices: [],
    }

    const { state } = readPersistedState(damaged)

    expect(state.profile.level).toBeNull()
    expect(state.bookmarks).toEqual({ 'res-a': { at: '2026-08-28T10:00:00.000Z' } })
  })

  it('ignores unknown top-level keys rather than failing on them', () => {
    const withExtra = { ...validState(), somethingElse: 'from a future version' }
    const { state } = readPersistedState(withExtra)

    expect(state).toEqual(defaultState())
    expect(state).not.toHaveProperty('somethingElse')
  })

  it('rejects a recents list longer than the cap', () => {
    const tooMany = validState({
      recentlyViewed: Array.from({ length: 25 }, (_, i) => ({
        resourceId: `res-${i}`,
        viewedAt: '2026-08-28T10:00:00.000Z',
      })),
    })

    const { state, recovered } = readPersistedState(tooMany)

    expect(recovered).toBe(true)
    expect(state.recentlyViewed).toEqual([])
  })
})

describe('migrations', () => {
  it('upgrades a v0 shape to the current version', () => {
    // No v0 was ever released. The step exists so the harness is proven correct
    // BEFORE a migration that matters has to be written under pressure.
    const legacy = {
      profile: { level: 'beginner', goal: null, weeklyTargetMinutes: null, updatedAt: null },
      completions: { 'res-a': { at: '2026-01-01T00:00:00.000Z' } },
      bookmarks: {},
    }

    const { state, recovered } = readPersistedState(legacy)

    expect(recovered).toBe(true)
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    // Existing data survives the upgrade.
    expect(state.completions).toEqual({ 'res-a': { at: '2026-01-01T00:00:00.000Z' } })
    expect(state.profile.level).toBe('beginner')
    // Fields introduced by v1 are filled in.
    expect(state.recentlyViewed).toEqual([])
    expect(state.dismissedNotices).toEqual([])
    expect(state.checkpointCompletions).toEqual({})
  })

  it('treats a missing schemaVersion as v0 rather than as current', () => {
    const { recovered } = readPersistedState({ profile: {}, completions: {} })
    expect(recovered).toBe(true)
  })

  it('does not migrate state already at the current version', () => {
    const { recovered } = readPersistedState(validState())
    expect(recovered).toBe(false)
  })

  it('starts fresh for a version NEWER than this build understands', () => {
    // Two tabs, two versions. Writing an older shape over newer data would
    // corrupt it further, so the older build declines to interpret it.
    const future = { ...validState(), schemaVersion: 99 }
    const { state, recovered } = readPersistedState(future)

    expect(state).toEqual(defaultState())
    expect(recovered).toBe(true)
  })

  it('starts fresh when a migration step is missing', () => {
    const { state, recovered } = readPersistedState({ schemaVersion: -1 })
    expect(state).toEqual(defaultState())
    expect(recovered).toBe(true)
  })
})
