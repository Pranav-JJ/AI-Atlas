import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSafeStorage, detectAvailability, type SafeStorage } from './safeStorage.ts'
import { RECENTLY_VIEWED_LIMIT, STORAGE_KEY, defaultState } from './schema.ts'
import { __resetStoreForTests, flushPendingWrites, useUserStore } from './store.ts'

/** A storage double whose contents tests can inspect and preload. */
function fakeStorage(
  initial: Record<string, string> = {},
): SafeStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))

  return {
    map,
    read: (key) => map.get(key) ?? null,
    write: (key, value) => {
      map.set(key, value)
      return true
    },
    remove: (key) => {
      map.delete(key)
    },
    availability: 'available',
  }
}

let store: ReturnType<typeof fakeStorage>

beforeEach(() => {
  vi.useFakeTimers()
  store = fakeStorage()
  __resetStoreForTests(store)
})

afterEach(() => {
  vi.useRealTimers()
})

/** Advances past the write debounce and returns what was persisted. */
function persisted(): unknown {
  vi.advanceTimersByTime(500)
  const raw = store.map.get(STORAGE_KEY)
  return raw === undefined ? undefined : JSON.parse(raw)
}

describe('bookmarks', () => {
  it('toggles on and off', () => {
    const { toggleBookmark } = useUserStore.getState()

    toggleBookmark('res-a')
    expect(useUserStore.getState().isBookmarked('res-a')).toBe(true)

    useUserStore.getState().toggleBookmark('res-a')
    expect(useUserStore.getState().isBookmarked('res-a')).toBe(false)
  })

  it('persists across a reload', () => {
    useUserStore.getState().toggleBookmark('res-a')
    persisted()

    // Same storage, fresh store: exactly what a page reload does.
    __resetStoreForTests(store)

    expect(useUserStore.getState().isBookmarked('res-a')).toBe(true)
  })

  it('records when it was saved', () => {
    useUserStore.getState().toggleBookmark('res-a')
    expect(useUserStore.getState().bookmarks['res-a']?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('completions', () => {
  it('toggles and persists', () => {
    useUserStore.getState().toggleCompletion('res-b')
    persisted()
    __resetStoreForTests(store)

    expect(useUserStore.getState().isCompleted('res-b')).toBe(true)
  })

  it('is independent of bookmarks', () => {
    useUserStore.getState().toggleCompletion('res-b')

    expect(useUserStore.getState().isCompleted('res-b')).toBe(true)
    expect(useUserStore.getState().isBookmarked('res-b')).toBe(false)
  })
})

describe('checkpoints', () => {
  it('keys by path and item, so the same item in two paths is separate', () => {
    useUserStore.getState().toggleCheckpoint('path-a', 'item-1')

    expect(useUserStore.getState().isCheckpointCompleted('path-a', 'item-1')).toBe(true)
    expect(useUserStore.getState().isCheckpointCompleted('path-b', 'item-1')).toBe(false)
  })
})

describe('recently viewed', () => {
  it('puts the most recent first', () => {
    const { recordView } = useUserStore.getState()
    recordView('res-a')
    useUserStore.getState().recordView('res-b')

    expect(useUserStore.getState().recentlyViewed.map((r) => r.resourceId)).toEqual([
      'res-b',
      'res-a',
    ])
  })

  it('promotes a re-view rather than duplicating it', () => {
    useUserStore.getState().recordView('res-a')
    useUserStore.getState().recordView('res-b')
    useUserStore.getState().recordView('res-a')

    const ids = useUserStore.getState().recentlyViewed.map((r) => r.resourceId)
    expect(ids).toEqual(['res-a', 'res-b'])
  })

  it(`caps the list at ${RECENTLY_VIEWED_LIMIT}, dropping the oldest`, () => {
    for (let i = 0; i < RECENTLY_VIEWED_LIMIT + 5; i += 1) {
      useUserStore.getState().recordView(`res-${i}`)
    }

    const ids = useUserStore.getState().recentlyViewed.map((r) => r.resourceId)
    expect(ids).toHaveLength(RECENTLY_VIEWED_LIMIT)
    expect(ids[0]).toBe(`res-${RECENTLY_VIEWED_LIMIT + 4}`)
    expect(ids).not.toContain('res-0')
  })
})

describe('profile', () => {
  it('stores level, goal and weekly target', () => {
    useUserStore.getState().setLevel('intermediate')
    useUserStore.getState().setGoal('build-llm-apps')
    useUserStore.getState().setWeeklyTarget(180)

    const { profile } = useUserStore.getState()
    expect(profile.level).toBe('intermediate')
    expect(profile.goal).toBe('build-llm-apps')
    expect(profile.weeklyTargetMinutes).toBe(180)
    expect(profile.updatedAt).not.toBeNull()
  })

  it('allows clearing a choice back to null', () => {
    useUserStore.getState().setLevel('beginner')
    useUserStore.getState().setLevel(null)

    expect(useUserStore.getState().profile.level).toBeNull()
  })
})

describe('writes are debounced', () => {
  it('does not write on every keystroke-sized change', () => {
    useUserStore.getState().toggleBookmark('res-a')
    useUserStore.getState().toggleBookmark('res-b')
    useUserStore.getState().toggleBookmark('res-c')

    // Nothing written yet: the debounce has not elapsed.
    expect(store.map.get(STORAGE_KEY)).toBeUndefined()

    vi.advanceTimersByTime(500)

    const written = JSON.parse(store.map.get(STORAGE_KEY)!)
    expect(Object.keys(written.bookmarks).sort()).toEqual(['res-a', 'res-b', 'res-c'])
  })

  it('flushes on demand, so an export never misses a recent change', () => {
    useUserStore.getState().toggleBookmark('res-a')
    expect(store.map.get(STORAGE_KEY)).toBeUndefined()

    flushPendingWrites()

    expect(JSON.parse(store.map.get(STORAGE_KEY)!).bookmarks).toHaveProperty('res-a')
  })
})

describe('export and import', () => {
  it('exports a labelled envelope, not a bare blob', () => {
    useUserStore.getState().toggleBookmark('res-a')
    const envelope = useUserStore.getState().exportState()

    expect(envelope.app).toBe('ai-atlas')
    expect(envelope.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(envelope.state.bookmarks).toHaveProperty('res-a')
  })

  it('exports valid JSON', () => {
    useUserStore.getState().toggleBookmark('res-a')
    const text = JSON.stringify(useUserStore.getState().exportState())

    expect(() => JSON.parse(text)).not.toThrow()
  })

  it('imports its own export', () => {
    useUserStore.getState().toggleBookmark('res-a')
    useUserStore.getState().setLevel('advanced')
    const envelope = useUserStore.getState().exportState()

    useUserStore.getState().resetAll()
    expect(useUserStore.getState().isBookmarked('res-a')).toBe(false)

    const result = useUserStore.getState().importState(envelope)

    expect(result.ok).toBe(true)
    expect(useUserStore.getState().isBookmarked('res-a')).toBe(true)
    expect(useUserStore.getState().profile.level).toBe('advanced')
  })

  it('refuses a file that is not an AI Atlas export', () => {
    const result = useUserStore.getState().importState({ some: 'other file' })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not an AI Atlas export/i)
  })

  it('leaves existing state untouched when an import is refused', () => {
    useUserStore.getState().toggleBookmark('res-keep')
    useUserStore.getState().importState('nonsense')

    expect(useUserStore.getState().isBookmarked('res-keep')).toBe(true)
  })
})

describe('reset', () => {
  it('clears everything in memory and in storage', () => {
    useUserStore.getState().toggleBookmark('res-a')
    useUserStore.getState().setLevel('beginner')
    persisted()

    useUserStore.getState().resetAll()

    expect(useUserStore.getState().bookmarks).toEqual({})
    expect(useUserStore.getState().profile).toEqual(defaultState().profile)
    expect(store.map.get(STORAGE_KEY)).toBeUndefined()
  })

  it('does not let a pending write resurrect the cleared data', () => {
    useUserStore.getState().toggleBookmark('res-a')
    useUserStore.getState().resetAll()

    vi.advanceTimersByTime(500)

    expect(store.map.get(STORAGE_KEY)).toBeUndefined()
  })
})

describe('corrupt stored data', () => {
  it('loads defaults and flags the recovery rather than crashing', () => {
    const corrupted = fakeStorage({ [STORAGE_KEY]: '{"schemaVersion":1,"profile":' })

    expect(() => __resetStoreForTests(corrupted)).not.toThrow()

    expect(useUserStore.getState().bookmarks).toEqual({})
    expect(useUserStore.getState().recoveredFromCorruption).toBe(true)
  })

  it('reports a clean load as not recovered', () => {
    __resetStoreForTests(fakeStorage())
    expect(useUserStore.getState().recoveredFromCorruption).toBe(false)
  })
})

describe('unavailable storage', () => {
  function blockedStorage(): SafeStorage {
    const map = new Map<string, string>()
    return {
      read: (key) => map.get(key) ?? null,
      write: (key, value) => {
        map.set(key, value)
        return true
      },
      remove: (key) => {
        map.delete(key)
      },
      availability: 'unavailable',
    }
  }

  it('still works for the session, and says persistence is off', () => {
    __resetStoreForTests(blockedStorage())

    useUserStore.getState().toggleBookmark('res-a')

    expect(useUserStore.getState().isBookmarked('res-a')).toBe(true)
    expect(useUserStore.getState().storageAvailable).toBe(false)
  })
})

describe('detectAvailability', () => {
  it('detects storage that throws on write, not just a missing object', () => {
    // Private windows expose localStorage and throw on setItem. Only a real
    // write proves it works.
    const throwing = {
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {},
      getItem: () => null,
    } as unknown as Storage

    expect(detectAvailability(throwing)).toBe('unavailable')
  })

  it('reports unavailable when there is no storage object at all', () => {
    expect(detectAvailability(undefined)).toBe('unavailable')
  })

  it('reports available for working storage, leaving no probe behind', () => {
    const map = new Map<string, string>()
    const working = {
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
      getItem: (k: string) => map.get(k) ?? null,
    } as unknown as Storage

    expect(detectAvailability(working)).toBe('available')
    expect(map.size).toBe(0)
  })
})

describe('createSafeStorage', () => {
  it('falls back to memory when the real storage is unusable', () => {
    const throwing = {
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {},
      getItem: () => null,
    } as unknown as Storage

    const safe = createSafeStorage(throwing)

    expect(safe.availability).toBe('unavailable')
    expect(safe.write('k', 'v')).toBe(true)
    expect(safe.read('k')).toBe('v')
  })

  it('reports a failed write rather than throwing', () => {
    let allow = true
    const quotaBound = {
      setItem: () => {
        if (!allow) throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
      getItem: () => null,
    } as unknown as Storage

    const safe = createSafeStorage(quotaBound)
    allow = false

    expect(() => safe.write('k', 'v')).not.toThrow()
    expect(safe.write('k', 'v')).toBe(false)
  })
})

describe('dismissed notices', () => {
  it('records a dismissal and persists it', () => {
    useUserStore.getState().dismissNotice('onboarding-prompt')
    persisted()
    __resetStoreForTests(store)

    expect(useUserStore.getState().isNoticeDismissed('onboarding-prompt')).toBe(true)
  })

  it('does not record the same dismissal twice', () => {
    useUserStore.getState().dismissNotice('onboarding-prompt')
    useUserStore.getState().dismissNotice('onboarding-prompt')

    expect(useUserStore.getState().dismissedNotices).toEqual(['onboarding-prompt'])
  })

  it('reports an undismissed notice as not dismissed', () => {
    expect(useUserStore.getState().isNoticeDismissed('never-seen')).toBe(false)
  })
})

describe('storage that throws on read or remove', () => {
  // Reads throw too, not just writes — a blocked-data setting can fail any
  // access. None of it may reach the caller.
  function throwingOnRead(): Storage {
    return {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
      removeItem: () => {
        throw new Error('SecurityError')
      },
    } as unknown as Storage
  }

  it('returns null instead of propagating a read failure', () => {
    const safe = createSafeStorage(throwingOnRead())
    expect(() => safe.read('k')).not.toThrow()
    expect(safe.read('k')).toBeNull()
  })

  it('swallows a remove failure', () => {
    const safe = createSafeStorage(throwingOnRead())
    expect(() => safe.remove('k')).not.toThrow()
  })
})
