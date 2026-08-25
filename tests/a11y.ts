import axe, { type AxeResults, type ElementContext, type RunOptions } from 'axe-core'
import { expect } from 'vitest'

/**
 * Accessibility assertion helper.
 *
 * We use axe-core directly rather than a matcher library (jest-axe) so there is
 * one fewer dependency to keep compatible with Vitest, and so the failure output
 * is shaped for this project: it names the rule, the impact, and the offending
 * markup, which is what you actually need to fix it.
 *
 * Acceptance criterion (§E.1): zero CRITICAL or SERIOUS violations on every route.
 * Minor/moderate findings are reported but do not fail, so the gate stays credible
 * and does not get disabled the first time a cosmetic rule fires.
 */
const BLOCKING_IMPACTS = new Set(['critical', 'serious'])

export async function expectNoA11yViolations(
  container: ElementContext = document.body,
  options: RunOptions = {},
): Promise<AxeResults> {
  const results = await axe.run(container, {
    // Colour contrast cannot be computed in jsdom (no layout/paint engine).
    // It is asserted separately against the token values, and in Lighthouse CI.
    rules: { 'color-contrast': { enabled: false } },
    ...options,
  })

  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))

  if (blocking.length > 0) {
    const report = blocking
      .map((v) => {
        const nodes = v.nodes.map((n) => `      ${n.html}\n      -> ${n.failureSummary}`).join('\n')
        return `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`
      })
      .join('\n\n')

    expect.fail(`Found ${blocking.length} blocking accessibility violation(s):\n\n${report}\n`)
  }

  return results
}
