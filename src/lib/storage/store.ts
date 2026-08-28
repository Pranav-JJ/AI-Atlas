import { create } from 'zustand'

import type { Difficulty } from '../schema/index.ts'
import { readPersistedState } from './migrations.ts'
import { createSafeStorage, type SafeStorage } from './safeStorage.ts'
import {
  CURRENT_SCHEMA_VERSION,
  defaultState,
  RECENTLY_VIEWED_LIMIT,
  STORAGE_KEY,
  zExportEnvelope,
  type ExportEnvelope,
  type Goal,
  type PersistedState,
} from './schema.ts'

/**
 * The learner's own state: profile, bookmarks, completions, recents.
 *
 * Hand-wired persistence rather than zustand/middleware/persist. The middleware
 * rehydrates by merging whatever JSON it finds, which is exactly the wrong
 * behaviour for data that can be corrupt or from another version. Reads go
 * through readPersistedState, which validates, migrates and salvages, and can
 * report that it had to repair something.
 */

const WRITE_DEBOUNCE_MS = 250

export interface UserState extends PersistedState {
  /** Whether persistence is actually working, for the "not saved" notice. */
  storageAvailable: boolean
  /** True when the last load had to repair or discard stored data. */
  recoveredFromCorruption: boolean

  setLevel(level: Difficulty | null): void
  setGoal(goal: Goal | null): void
  setWeeklyTarget(minutes: number | null): void

  toggleBookmark(resourceId: string): void
  isBookmarked(resourceId: string): boolean

  toggleCompletion(resourceId: string): void
  isCompleted(resourceId: string): boolean

  toggleCheckpoint(pathId: string, itemId: string): void
  isCheckpointCompleted(pathId: string, itemId: string): boolean

  recordView(resourceId: string): void
  dismissNotice(id: string): void
  isNoticeDismissed(id: string): boolean

  exportState(): ExportEnvelope
  importState(raw: unknown): { ok: boolean; error?: string }
  resetAll(): void
}

/** Swappable so tests can supply their own storage without touching globals. */
let storage: SafeStorage = createSafeStorage()

let writeTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(state: PersistedState): void {
  if (writeTimer !== null) clearTimeout(writeTimer)

  // Debounced: ticking several checkboxes quickly should not mean several
  // synchronous JSON serialisations of the whole state.
  writeTimer = setTimeout(() => {
    writeTimer = null
    storage.write(STORAGE_KEY, JSON.stringify(persistable(state)))
  }, WRITE_DEBOUNCE_MS)
}

/** Strips the derived, non-persisted fields before writing. */
function persistable(state: PersistedState): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: state.profile,
    completions: state.completions,
    checkpointCompletions: state.checkpointCompletions,
    bookmarks: state.bookmarks,
    recentlyViewed: state.recentlyViewed,
    dismissedNotices: state.dismissedNotices,
  }
}

/** Flushes any pending debounced write. Called before export and on unload. */
export function flushPendingWrites(): void {
  if (writeTimer === null) return

  clearTimeout(writeTimer)
  writeTimer = null
  storage.write(STORAGE_KEY, JSON.stringify(persistable(useUserStore.getState())))
}

function nowIso(): string {
  return new Date().toISOString()
}

function loadInitial(): { state: PersistedState; recovered: boolean } {
  const raw = storage.read(STORAGE_KEY)
  const { state, recovered } = readPersistedState(raw)
  return { state, recovered }
}

const initial = loadInitial()

export const useUserStore = create<UserState>()((set, get) => {
  /** Applies a change and schedules exactly one persist. */
  const commit = (updater: (state: PersistedState) => Partial<PersistedState>) => {
    set((current) => {
      const changes = updater(current)
      const next = { ...persistable(current), ...changes }
      schedulePersist(next)
      return changes
    })
  }

  return {
    ...initial.state,
    storageAvailable: storage.availability === 'available',
    recoveredFromCorruption: initial.recovered,

    setLevel: (level) =>
      commit((state) => ({ profile: { ...state.profile, level, updatedAt: nowIso() } })),

    setGoal: (goal) =>
      commit((state) => ({ profile: { ...state.profile, goal, updatedAt: nowIso() } })),

    setWeeklyTarget: (weeklyTargetMinutes) =>
      commit((state) => ({
        profile: { ...state.profile, weeklyTargetMinutes, updatedAt: nowIso() },
      })),

    toggleBookmark: (resourceId) =>
      commit((state) => {
        const bookmarks = { ...state.bookmarks }

        if (bookmarks[resourceId]) delete bookmarks[resourceId]
        else bookmarks[resourceId] = { at: nowIso() }

        return { bookmarks }
      }),

    isBookmarked: (resourceId) => get().bookmarks[resourceId] !== undefined,

    toggleCompletion: (resourceId) =>
      commit((state) => {
        const completions = { ...state.completions }

        if (completions[resourceId]) delete completions[resourceId]
        else completions[resourceId] = { at: nowIso() }

        return { completions }
      }),

    isCompleted: (resourceId) => get().completions[resourceId] !== undefined,

    toggleCheckpoint: (pathId, itemId) =>
      commit((state) => {
        const key = `${pathId}::${itemId}`
        const checkpointCompletions = { ...state.checkpointCompletions }

        if (checkpointCompletions[key]) delete checkpointCompletions[key]
        else checkpointCompletions[key] = { at: nowIso() }

        return { checkpointCompletions }
      }),

    isCheckpointCompleted: (pathId, itemId) =>
      get().checkpointCompletions[`${pathId}::${itemId}`] !== undefined,

    recordView: (resourceId) =>
      commit((state) => {
        // Move-to-front, then cap. Re-viewing something promotes it rather than
        // adding a duplicate — this is "where was I", not a history log.
        const withoutExisting = state.recentlyViewed.filter((r) => r.resourceId !== resourceId)

        return {
          recentlyViewed: [{ resourceId, viewedAt: nowIso() }, ...withoutExisting].slice(
            0,
            RECENTLY_VIEWED_LIMIT,
          ),
        }
      }),

    dismissNotice: (id) =>
      commit((state) =>
        state.dismissedNotices.includes(id)
          ? {}
          : { dismissedNotices: [...state.dismissedNotices, id] },
      ),

    isNoticeDismissed: (id) => get().dismissedNotices.includes(id),

    exportState: () => ({
      exportedAt: nowIso(),
      app: 'ai-atlas' as const,
      state: persistable(get()),
    }),

    importState: (raw) => {
      const envelope = zExportEnvelope.safeParse(raw)

      if (!envelope.success) {
        return { ok: false, error: 'That file is not an AI Atlas export.' }
      }

      const { state } = readPersistedState(envelope.data.state)
      set(state)
      schedulePersist(state)

      return { ok: true }
    },

    resetAll: () => {
      const fresh = defaultState()

      if (writeTimer !== null) {
        clearTimeout(writeTimer)
        writeTimer = null
      }
      storage.remove(STORAGE_KEY)
      set(fresh)
    },
  }
})

/**
 * Test seam: swap the backing storage and reload state from it.
 *
 * Exported rather than reaching into module internals from tests, so the store's
 * own loading path is the one being exercised.
 */
export function __resetStoreForTests(nextStorage?: SafeStorage): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer)
    writeTimer = null
  }

  storage = nextStorage ?? createSafeStorage()

  const { state, recovered } = loadInitial()
  useUserStore.setState({
    ...state,
    storageAvailable: storage.availability === 'available',
    recoveredFromCorruption: recovered,
  })
}

export { WRITE_DEBOUNCE_MS }
