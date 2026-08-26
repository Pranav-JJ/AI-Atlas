import { useEffect, useState } from 'react'

import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  THEME_CHOICES,
  type ThemeChoice,
} from '@/lib/theme.ts'

const LABELS: Record<ThemeChoice, string> = {
  light: 'Light',
  system: 'System',
  dark: 'Dark',
}

const ICONS: Record<ThemeChoice, string> = {
  // Simple glyphs rather than an icon dependency; each is paired with a text label.
  light:
    'M12 3v2m0 14v2m9-9h-2M5 12H3m14.7-6.7-1.4 1.4M7.7 16.3l-1.4 1.4m12.4 0-1.4-1.4M7.7 7.7 6.3 6.3',
  system: 'M4 5h16v10H4zM8 19h8',
  dark: 'M20 13a8 8 0 1 1-9-9 6 6 0 0 0 9 9Z',
}

/**
 * Three-state theme control: Light / System / Dark.
 *
 * "System" is a genuine third state, not the absence of a choice — it must keep
 * following the OS setting if the user changes it later, which a light/dark
 * boolean cannot express.
 *
 * Built as a radiogroup rather than a cycling button so the current state and
 * the available options are both visible, and so a screen reader user does not
 * have to activate a control repeatedly to discover what it does.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  // Initialised from storage rather than a constant, so the first paint matches
  // what the no-flash script in <head> already applied.
  const [choice, setChoice] = useState<ThemeChoice>(() => readStoredTheme())

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  function select(next: ThemeChoice) {
    setChoice(next)
    storeTheme(next)
    applyTheme(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`border-border bg-surface inline-flex rounded-lg border p-0.5 ${className}`}
    >
      {THEME_CHOICES.map((option) => {
        const selected = option === choice

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => select(option)}
            title={`${LABELS[option]} theme`}
            className={`flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-xs transition-colors ${
              selected
                ? 'bg-surface-subtle text-fg font-medium'
                : 'text-fg-subtle hover:text-fg-muted'
            }`}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={ICONS[option]} />
              {option === 'light' ? <circle cx="12" cy="12" r="3.5" /> : null}
            </svg>
            <span className="sr-only sm:not-sr-only">{LABELS[option]}</span>
          </button>
        )
      })}
    </div>
  )
}
