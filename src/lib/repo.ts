/**
 * Where this catalogue lives, for links back to it.
 *
 * A single constant so a fork or a rename is one edit rather than a hunt
 * through every component that builds a GitHub URL.
 */
export const REPO_URL = 'https://github.com/Pranav-JJ/AI-Atlas'

export interface ReportContext {
  recordId: string
  title: string
  url: string | null
  /** Content file, so a maintainer knows exactly what to open. */
  kind: 'resource' | 'dataset' | 'paper' | 'project' | 'path' | 'glossary term'
}

/**
 * A prefilled GitHub issue for reporting a bad link or wrong metadata.
 *
 * Prefilled with the identifying details so a reporter does not have to work
 * out what we would need — most people who spot a dead link will not file a
 * report at all if it means composing one from scratch.
 *
 * Deliberately a plain link to GitHub rather than a form: this is a static
 * site with no backend, and pretending otherwise would mean either a
 * third-party form service or an endpoint that does not exist.
 */
export function buildReportUrl(context: ReportContext): string {
  const title = `Problem with ${context.kind}: ${context.title}`

  const body = [
    `**Record:** \`${context.recordId}\``,
    `**Recorded URL:** ${context.url ?? '(none recorded)'}`,
    '',
    '**What is wrong?**',
    '',
    '- [ ] The link is dead or redirects somewhere unrelated',
    '- [ ] The description or metadata is inaccurate',
    '- [ ] The cost, access or licence details are wrong',
    '- [ ] Something else',
    '',
    '**Details**',
    '',
    '<!-- What did you find? If the resource has moved, the new address is very helpful. -->',
  ].join('\n')

  const params = new URLSearchParams({ title, body, labels: 'content-report' })
  return `${REPO_URL}/issues/new?${params.toString()}`
}
