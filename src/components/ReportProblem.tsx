import { buildReportUrl, type ReportContext } from '@/lib/repo.ts'

import { ExternalLink } from './ExternalLink.tsx'

/**
 * "Something wrong with this entry?"
 *
 * Deliberately present on every record page rather than buried in an About
 * section. Broken links and stale metadata are expected over time, not
 * exceptional, and the person best placed to notice is the reader who just
 * clicked through and found something unexpected.
 *
 * The link is prefilled with the record's identifying details, because someone
 * who has to compose a report from scratch will usually not bother.
 */
export function ReportProblem({ context }: { context: ReportContext }) {
  return (
    <p className="text-fg-subtle mt-8 text-xs leading-relaxed">
      Found a dead link or something inaccurate here?{' '}
      <ExternalLink href={buildReportUrl(context)} hideIcon>
        Report it
      </ExternalLink>{' '}
      — the form is prefilled with what we would need to know.
    </p>
  )
}
