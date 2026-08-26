import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyTheme,
  DEFAULT_THEME,
  NO_FLASH_SCRIPT,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
} from './theme.ts'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readStoredTheme', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readStoredTheme()).toBe('system')
    expect(DEFAULT_THEME).toBe('system')
  })

  it('reads a stored choice back', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('falls back to the default for a value it does not recognise', () => {
    // Someone else's key collision, or a value from a future version.
    localStorage.setItem(THEME_STORAGE_KEY, 'solarized')
    expect(readStoredTheme()).toBe('system')
  })

  it('survives storage that throws instead of returning null', () => {
    // Private windows and "block site data" settings throw on access rather
    // than returning null. A theme preference must never break the page.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readStoredTheme()).toBe('system')
  })
})

describe('storeTheme', () => {
  it('persists an explicit choice', () => {
    storeTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('removes the key when the choice is the default', () => {
    // Storing the default would pin the user to it if the default ever changed.
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    storeTheme('system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => storeTheme('dark')).not.toThrow()
  })
})

describe('applyTheme', () => {
  it.each(['light', 'dark'] as const)('sets data-theme="%s"', (choice) => {
    applyTheme(choice)
    expect(document.documentElement.getAttribute('data-theme')).toBe(choice)
  })

  it('removes the attribute for system, rather than setting a value', () => {
    // The attribute's ABSENCE is what lets CSS fall through to
    // prefers-color-scheme. Setting data-theme="system" would match nothing.
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('resolveTheme', () => {
  function mockPrefersDark(matches: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches, media: query }) as MediaQueryList,
    )
  }

  it('returns an explicit choice unchanged', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves system against the OS preference', () => {
    mockPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')

    mockPrefersDark(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('falls back to light when matchMedia is unavailable', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => {
      throw new Error('not supported')
    })
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('NO_FLASH_SCRIPT', () => {
  it('references the same storage key as the module', () => {
    // These are two representations of one decision. If they drift, the script
    // silently stops finding the preference and the flash returns.
    expect(NO_FLASH_SCRIPT).toContain(THEME_STORAGE_KEY)
  })

  it('is wrapped in a try/catch, since it runs before anything can catch for it', () => {
    expect(NO_FLASH_SCRIPT).toMatch(/^try\{/)
    expect(NO_FLASH_SCRIPT).toMatch(/catch\(e\)\{\}$/)
  })

  it('actually applies a stored theme when executed', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    // Execute the real script text, exactly as the browser would.
    new Function(NO_FLASH_SCRIPT)()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies nothing when the stored value is "system" or absent', () => {
    new Function(NO_FLASH_SCRIPT)()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)

    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    new Function(NO_FLASH_SCRIPT)()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('ignores an unrecognised stored value rather than setting it', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    new Function(NO_FLASH_SCRIPT)()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('THEME_CHOICES', () => {
  it('orders the control light -> system -> dark', () => {
    expect([...THEME_CHOICES]).toEqual(['light', 'system', 'dark'])
  })
})
