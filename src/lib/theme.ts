/**
 * Theme selection and persistence.
 *
 * Three states, not two. "system" is the default and is genuinely distinct from
 * an explicit light or dark choice: it must keep following the OS setting if the
 * user changes it later, which a boolean cannot express.
 *
 *   system  -> no data-theme attribute; CSS falls through to prefers-color-scheme
 *   light   -> data-theme="light"
 *   dark    -> data-theme="dark"
 *
 * See src/styles/tokens.css for how the three states are handled in CSS.
 */

export const THEME_CHOICES = ['light', 'system', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

/** Namespaced and versioned, like every other key this app writes. */
export const THEME_STORAGE_KEY = 'ai-atlas:theme'

export const DEFAULT_THEME: ThemeChoice = 'system'

function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value)
}

/**
 * Reads the stored choice, falling back to "system".
 *
 * Storage access throws outright in some contexts (private windows, browsers set
 * to block site data), so every read and write here is guarded. A theme
 * preference is never worth breaking the page over.
 */
export function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeChoice(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    if (choice === DEFAULT_THEME) {
      // Storing the default would pin the user to it if the default ever changes.
      localStorage.removeItem(THEME_STORAGE_KEY)
      return
    }
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Preference simply will not persist. The page still works.
  }
}

/** Applies a choice to the document. "system" removes the attribute entirely. */
export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
): void {
  if (choice === 'system') {
    root.removeAttribute('data-theme')
    return
  }
  root.setAttribute('data-theme', choice)
}

/** What the choice actually resolves to right now, for labelling and icons. */
export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * The script inlined into index.html to run before first paint.
 *
 * Without it the browser paints the default (light) palette and then React
 * corrects it, which a dark-mode user sees as a white flash on every load.
 *
 * Kept here, next to the logic it mirrors, so the two cannot drift. It is
 * deliberately tiny and dependency-free because it runs render-blocking.
 *
 * NOTE for Phase 13: this is an inline script, so a Content-Security-Policy will
 * need its hash. That is a known, accepted cost — the alternative is the flash.
 */
export const NO_FLASH_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`
