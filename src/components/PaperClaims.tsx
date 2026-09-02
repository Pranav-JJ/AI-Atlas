import {
  PEER_REVIEW_EXPLANATIONS,
  PEER_REVIEW_LABELS,
  PEER_REVIEW_TONES,
  type PaperFields,
} from '@/lib/papers.ts'

import { Badge } from './Badge.tsx'
import { ExternalLink } from './ExternalLink.tsx'

/**
 * A paper's claims, our reading of them, and its publication status.
 *
 * The central requirement of this surface is that a reader can always tell
 * WHICH of the two summaries came from the paper and which came from us. They
 * are therefore given different headings, different backgrounds, and an
 * explicit attribution line each — not merely placed in sequence and hoped for.
 *
 * Publication status is never omitted. An arXiv identifier is not evidence of
 * peer review, and an absent field would let the reader assume either way.
 */
export function PaperClaims({ paper }: { paper: PaperFields }) {
  const tone = PEER_REVIEW_TONES[paper.peer_review_status] ?? 'warn'

  return (
    <>
      {paper.abstract_summary !== null || paper.key_idea !== null ? (
        <section className="mt-8" aria-labelledby="paper-summaries">
          <h2 id="paper-summaries" className="text-fg text-sm font-semibold">
            Summary
          </h2>

          {paper.abstract_summary !== null ? (
            <article
              aria-labelledby="what-the-source-says"
              className="border-border bg-surface-subtle mt-3 rounded-lg border p-4"
            >
              <h3
                id="what-the-source-says"
                className="text-fg text-xs font-semibold tracking-wide uppercase"
              >
                What the source says
              </h3>
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">{paper.abstract_summary}</p>
              <p className="text-fg-subtle mt-2 text-xs">
                A paraphrase of the paper&rsquo;s own abstract. No benchmark figures are reproduced
                here.
              </p>
            </article>
          ) : null}

          {paper.key_idea !== null ? (
            <article
              aria-labelledby="our-reading"
              className="border-accent/40 bg-accent-subtle mt-3 rounded-lg border p-4"
            >
              <h3
                id="our-reading"
                className="text-fg text-xs font-semibold tracking-wide uppercase"
              >
                Our reading
              </h3>
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">{paper.key_idea}</p>
              <p className="text-fg-subtle mt-2 text-xs">
                AI Atlas&rsquo;s interpretation, not a claim made by the paper. Read the source
                before relying on it.
              </p>
            </article>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="publication">
        <h2 id="publication" className="text-fg text-sm font-semibold">
          Publication
        </h2>

        <dl className="border-border mt-3 rounded-lg border">
          {paper.authors.length > 0 ? (
            <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-b p-3">
              <dt className="text-fg-subtle text-sm">Authors</dt>
              <dd className="text-fg max-w-[42ch] text-right text-sm">
                {paper.authors.join(', ')}
              </dd>
            </div>
          ) : null}

          <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-b p-3">
            <dt className="text-fg-subtle text-sm">Year</dt>
            <dd className="text-fg text-right text-sm">{paper.year ?? 'Not recorded'}</dd>
          </div>

          <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-b p-3">
            <dt className="text-fg-subtle text-sm">Venue</dt>
            <dd className="text-fg text-right text-sm">{paper.venue ?? 'None recorded'}</dd>
          </div>

          {/* Always rendered, including — especially — when unknown. */}
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 p-3">
            <dt className="text-fg-subtle text-sm">Peer review</dt>
            <dd className="text-right text-sm">
              <Badge tone={tone}>
                {PEER_REVIEW_LABELS[paper.peer_review_status] ?? paper.peer_review_status}
              </Badge>
            </dd>
          </div>
        </dl>

        <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
          {PEER_REVIEW_EXPLANATIONS[paper.peer_review_status] ??
            'Publication status has not been established.'}
        </p>

        {paper.code_url ? (
          <p className="mt-4 text-sm">
            <ExternalLink href={paper.code_url}>Code released with the paper</ExternalLink>
          </p>
        ) : null}
      </section>
    </>
  )
}
