/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * This exists so "contrast is at least 4.5:1 in both themes" is a test result
 * rather than a claim in a document. Colour contrast cannot be checked by
 * axe-core under jsdom — there is no layout or paint engine — so it is asserted
 * directly against the token values instead.
 *
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Parses `#rgb` or `#rrggbb`. Returns null for anything else. */
export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '')

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = [...hex].map((c) => parseInt(c + c, 16))
    return { r: r!, g: g!, b: b! }
  }

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  return null
}

function channelLuminance(value8Bit: number): number {
  const c = value8Bit / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a)
  const lumB = relativeLuminance(b)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)

  return (lighter + 0.05) / (darker + 0.05)
}

export function contrastRatioHex(a: string, b: string): number {
  const colourA = parseHex(a)
  const colourB = parseHex(b)

  if (!colourA || !colourB) {
    throw new Error(`contrastRatioHex: could not parse "${a}" and/or "${b}"`)
  }

  return contrastRatio(colourA, colourB)
}

/** WCAG AA thresholds. */
export const AA_BODY_TEXT = 4.5
export const AA_LARGE_TEXT = 3
/** Non-text contrast: focus rings, borders that carry meaning, icons. */
export const AA_NON_TEXT = 3

/**
 * Extracts custom properties from one CSS rule block.
 *
 * A deliberately small parser: it only has to read our own token file, and
 * pulling in a full CSS parser to check a dozen hex values would be a poor
 * trade. It matches `--name: value;` pairs inside the given selector's block.
 */
export function extractTokens(source: string, selector: string): Record<string, string> {
  // Comments first: tokens.css documents its own selectors in a header comment,
  // and without this the parser matches the prose instead of the rule — silently
  // returning the wrong theme's values.
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')

  const index = css.indexOf(selector)
  if (index === -1) return {}

  const open = css.indexOf('{', index)
  if (open === -1) return {}

  // Walk braces so nested at-rules inside the block do not end it early.
  let depth = 0
  let end = open

  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }

  const block = css.slice(open + 1, end)
  const tokens: Record<string, string> = {}

  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = match[1]
    const value = match[2]
    if (name && value) tokens[name] = value.trim()
  }

  return tokens
}
