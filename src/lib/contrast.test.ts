import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  AA_BODY_TEXT,
  AA_NON_TEXT,
  contrastRatio,
  contrastRatioHex,
  extractTokens,
  parseHex,
  relativeLuminance,
} from './contrast.ts'

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8')

/**
 * Light lives on bare `:root`; the explicit dark override is the one the toggle
 * sets. The system-dark block repeats the same values, and a test below asserts
 * that the two dark blocks agree — so checking the explicit one covers both.
 */
const light = extractTokens(tokensCss, ':root {')
const dark = extractTokens(tokensCss, ":root[data-theme='dark']")

describe('contrast maths', () => {
  it('parses both hex forms', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('#16181d')).toEqual({ r: 22, g: 24, b: 29 })
    expect(parseHex('nonsense')).toBeNull()
  })

  it('matches the WCAG reference extremes', () => {
    expect(contrastRatioHex('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatioHex('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatioHex('#2f5fe0', '#fbfbfd')).toBeCloseTo(
      contrastRatioHex('#fbfbfd', '#2f5fe0'),
      10,
    )
  })

  it('computes known luminance anchors', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 6)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6)
  })

  it('rejects a pair it cannot parse rather than returning a wrong number', () => {
    expect(() => contrastRatioHex('#fff', 'var(--bg)')).toThrow(/could not parse/)
  })

  it('agrees with a hand-computed mid-tone pair', () => {
    // #767676 on #ffffff is the canonical "just passes AA" grey.
    expect(contrastRatio({ r: 118, g: 118, b: 118 }, { r: 255, g: 255, b: 255 })).toBeGreaterThan(
      4.5,
    )
    expect(contrastRatio({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 })).toBeLessThan(4.6)
  })
})

describe('the token file parsed cleanly', () => {
  it('found both themes', () => {
    expect(Object.keys(light).length).toBeGreaterThan(15)
    expect(Object.keys(dark).length).toBeGreaterThan(10)
  })

  it('defines every colour on bare :root, so none exists only inside a theme block', () => {
    // A colour defined only under a media query or [data-theme] would be
    // undefined in the other theme, and inherit whatever the host painted.
    for (const name of Object.keys(dark)) {
      expect(light[name], `${name} is overridden in dark but never defined on :root`).toBeDefined()
    }
  })

  it('keeps the system-dark and explicit-dark blocks identical', () => {
    // These are two separate blocks by necessity (a media query cannot also be
    // an attribute selector). If they drift, the toggle and the OS setting
    // produce visibly different palettes.
    const systemDark = extractTokens(tokensCss, ":root:not([data-theme='light'])")

    for (const [name, value] of Object.entries(dark)) {
      if (name.startsWith('--radius') || name.startsWith('--z-') || name.startsWith('--duration')) {
        continue
      }
      expect(systemDark[name], `${name} differs between system dark and explicit dark`).toBe(value)
    }
  })
})

/** Foreground/background pairs that actually occur in the UI. */
const TEXT_PAIRS: Array<[fg: string, bg: string, label: string]> = [
  ['--fg', '--bg', 'body text on page background'],
  ['--fg', '--surface', 'body text on a card'],
  ['--fg', '--surface-subtle', 'body text on a subtle surface'],
  ['--fg-muted', '--bg', 'muted text on page background'],
  ['--fg-muted', '--surface', 'muted text on a card'],
  ['--fg-subtle', '--bg', 'subtle text on page background'],
  ['--fg-subtle', '--surface', 'subtle text on a card'],
  ['--accent', '--bg', 'link on page background'],
  ['--accent', '--surface', 'link on a card'],
  ['--accent-fg', '--accent', 'text on an accent button'],
  ['--ok', '--ok-subtle', 'verified chip'],
  ['--warn', '--warn-subtle', 'unverified / stale chip'],
  ['--danger', '--danger-subtle', 'broken chip'],
  ['--ok', '--surface', 'verified text on a card'],
  ['--warn', '--surface', 'warning text on a card'],
  ['--danger', '--surface', 'danger text on a card'],
]

/**
 * Non-text pairs, which need 3:1 under WCAG 1.4.11 rather than 4.5:1.
 *
 * Only boundaries that IDENTIFY a control belong here. `--border` and
 * `--border-strong` are decorative separators — a card is already distinguished
 * from the page by its background, so its outline carries no information and is
 * not held to this bar. Form controls are, which is what --border-interactive
 * exists for.
 */
const NON_TEXT_PAIRS: Array<[fg: string, bg: string, label: string]> = [
  ['--focus', '--bg', 'focus ring on page background'],
  ['--focus', '--surface', 'focus ring on a card'],
  ['--focus', '--surface-subtle', 'focus ring on a subtle surface'],
  ['--border-interactive', '--bg', 'control boundary on page background'],
  ['--border-interactive', '--surface', 'control boundary on a card'],
  ['--accent', '--bg', 'accent-filled control on page background'],
]

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme meets WCAG AA', (themeName, tokens) => {
  it.each(TEXT_PAIRS)('%s on %s (%s) is at least 4.5:1', (fg, bg, _label) => {
    const fgValue = tokens[fg]
    const bgValue = tokens[bg]

    expect(fgValue, `${fg} missing from ${themeName}`).toBeDefined()
    expect(bgValue, `${bg} missing from ${themeName}`).toBeDefined()

    const ratio = contrastRatioHex(fgValue!, bgValue!)
    expect(
      ratio,
      `${themeName}: ${fg} (${fgValue}) on ${bg} (${bgValue}) is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(AA_BODY_TEXT)
  })

  it.each(NON_TEXT_PAIRS)('%s on %s (%s) is at least 3:1', (fg, bg, _label) => {
    const ratio = contrastRatioHex(tokens[fg]!, tokens[bg]!)
    expect(ratio, `${themeName}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    )
  })
})
