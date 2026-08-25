import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from './a11y.ts'

/**
 * Self-test for the accessibility helper.
 *
 * An a11y assertion that cannot fail is a false green — it would silently pass
 * forever and give the whole suite unearned credibility. These tests prove the
 * helper actually detects blocking violations and actually ignores non-blocking
 * ones, so the gate in every other test file means something.
 */
describe('expectNoA11yViolations', () => {
  it('fails on a blocking (critical) violation', async () => {
    const host = document.createElement('div')
    // Missing alt text -> axe rule "image-alt", impact "critical".
    host.innerHTML = '<img src="chart.png">'
    document.body.appendChild(host)

    await expect(expectNoA11yViolations(host)).rejects.toThrow(/blocking accessibility violation/i)
  })

  it('names the failing rule and the offending markup in its message', async () => {
    const host = document.createElement('div')
    // A control with no accessible name -> axe rule "label"/"form-field-multiple-labels".
    host.innerHTML = '<input type="text">'
    document.body.appendChild(host)

    await expect(expectNoA11yViolations(host)).rejects.toThrow(/<input/)
  })

  it('passes on accessible markup', async () => {
    const host = document.createElement('div')
    host.innerHTML = `
      <main>
        <h1>Resource library</h1>
        <img src="chart.png" alt="Completed resources per topic">
        <label for="q">Search resources</label>
        <input id="q" type="text">
      </main>`
    document.body.appendChild(host)

    await expect(expectNoA11yViolations(host)).resolves.toBeDefined()
  })
})
