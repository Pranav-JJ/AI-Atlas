/**
 * localStorage that cannot break the page.
 *
 * Storage is not merely "sometimes empty". In a private window, or with site
 * data blocked, or when a quota is exceeded, the accessor THROWS — including on
 * plain reads. Every call here is guarded, and when storage is unusable the app
 * falls back to memory so the session still works; it just will not persist.
 */

export type StorageAvailability = 'available' | 'unavailable'

export interface SafeStorage {
  read(key: string): string | null
  write(key: string, value: string): boolean
  remove(key: string): void
  availability: StorageAvailability
}

/**
 * Probes storage by actually writing.
 *
 * Checking `typeof localStorage !== 'undefined'` is not enough: Safari's private
 * mode historically exposed the object and threw on setItem, and "block site
 * data" behaves the same way. The only reliable test is a real write.
 */
export function detectAvailability(store: Storage | undefined): StorageAvailability {
  if (!store) return 'unavailable'

  const probe = '__ai-atlas-probe__'

  try {
    store.setItem(probe, probe)
    store.removeItem(probe)
    return 'available'
  } catch {
    return 'unavailable'
  }
}

/** In-memory stand-in, so the app behaves identically for one session. */
function createMemoryStorage(): SafeStorage {
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

export function createSafeStorage(
  store: Storage | undefined = globalThis.localStorage,
): SafeStorage {
  if (detectAvailability(store) === 'unavailable' || !store) {
    return createMemoryStorage()
  }

  return {
    read(key) {
      try {
        return store.getItem(key)
      } catch {
        return null
      }
    },
    write(key, value) {
      try {
        store.setItem(key, value)
        return true
      } catch {
        // Most often a quota error. The in-session state is still correct; only
        // persistence failed, and the caller decides whether to tell the user.
        return false
      }
    },
    remove(key) {
      try {
        store.removeItem(key)
      } catch {
        // Nothing useful to do, and nothing worth breaking the page over.
      }
    },
    availability: 'available',
  }
}
