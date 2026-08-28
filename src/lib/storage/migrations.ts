import {
  CURRENT_SCHEMA_VERSION,
  defaultState,
  zPersistedState,
  type PersistedState,
} from './schema.ts'

/**
 * Reading persisted state safely.
 *
 * This data outlives the code that wrote it. It can be from an older version, it
 * can be hand-edited, and anything else on the same origin can corrupt it. The
 * rules here are therefore absolute:
 *
 *   1. Never throw. A broken value costs the user their progress; a thrown
 *      exception costs them the whole site.
 *   2. Never silently discard MORE than necessary. Salvage what parses.
 *   3. Migrations are explicit and chained, one version at a time.
 */

type LegacyState = Record<string, unknown>

/**
 * One step per version. `MIGRATIONS[n]` upgrades version n to n + 1.
 *
 * Note that no v0 was ever released — v1 is the first shipped shape. The v0 step
 * exists so the harness is exercised and correct BEFORE it is first needed,
 * rather than being written in a hurry during the migration that matters.
 */
const MIGRATIONS: Record<number, (state: LegacyState) => LegacyState> = {
  0: (state) => ({
    ...state,
    schemaVersion: 1,
    // Fields introduced in v1. Existing keys are preserved as-is.
    recentlyViewed: Array.isArray(state.recentlyViewed) ? state.recentlyViewed : [],
    dismissedNotices: Array.isArray(state.dismissedNotices) ? state.dismissedNotices : [],
    checkpointCompletions:
      typeof state.checkpointCompletions === 'object' && state.checkpointCompletions !== null
        ? state.checkpointCompletions
        : {},
  }),
}

function detectVersion(state: LegacyState): number {
  const version = state.schemaVersion
  return typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : 0
}

/**
 * Salvage pass for state that fails whole-object validation.
 *
 * Runs each top-level field through the schema on its own, keeping what parses
 * and defaulting what does not. One corrupt bookmark should not cost you your
 * completions.
 */
function salvage(state: LegacyState): PersistedState {
  const result = defaultState()

  const fields = [
    'profile',
    'completions',
    'checkpointCompletions',
    'bookmarks',
    'recentlyViewed',
    'dismissedNotices',
  ] as const

  for (const field of fields) {
    const fieldSchema = zPersistedState.shape[field]
    const parsed = fieldSchema.safeParse(state[field])

    if (parsed.success) {
      // Types are checked per-field above; the assignment is the point of the loop.
      ;(result as Record<string, unknown>)[field] = parsed.data
    }
  }

  return result
}

export interface ReadResult {
  state: PersistedState
  /** True when the stored data could not be read exactly as written. */
  recovered: boolean
}

/**
 * Turns whatever was in storage into valid state.
 *
 * Always succeeds. `recovered` reports whether anything had to be repaired, so
 * the UI can tell the user rather than quietly resetting their progress.
 */
export function readPersistedState(raw: unknown): ReadResult {
  if (raw === null || raw === undefined) {
    return { state: defaultState(), recovered: false }
  }

  let parsed: unknown = raw

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { state: defaultState(), recovered: true }
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { state: defaultState(), recovered: true }
  }

  let working = parsed as LegacyState
  let version = detectVersion(working)
  let migrated = false

  // Data from a NEWER version than this build understands: do not guess at it.
  // Start fresh rather than corrupting it further by writing an older shape.
  if (version > CURRENT_SCHEMA_VERSION) {
    return { state: defaultState(), recovered: true }
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return { state: defaultState(), recovered: true }

    working = step(working)
    version += 1
    migrated = true
  }

  const validated = zPersistedState.safeParse(working)

  if (validated.success) {
    return { state: validated.data, recovered: migrated }
  }

  // Whole-object validation failed. Keep whatever fields are individually valid.
  return { state: salvage(working), recovered: true }
}
