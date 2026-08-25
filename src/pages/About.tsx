/**
 * Methodology, source policy, and privacy.
 *
 * This page is written in Phase 1 rather than later because its content is
 * editorial policy already decided in the plan — it does not depend on the data
 * model. It also gives the deployment a genuine deep route to verify against,
 * instead of a stub that pretends to be a feature.
 */
export function About() {
  return (
    <>
      <h1 className="text-fg text-3xl font-semibold tracking-tight">
        Methodology and source policy
      </h1>

      <p className="text-fg-muted mt-4 leading-relaxed">
        AI Atlas is a curated catalogue, not a search engine and not a ranking of everything that
        exists. This page describes exactly how resources are chosen, how progress is calculated,
        and what the site does with your data — so you can judge how much to trust it.
      </p>

      <Section title="How resources are selected">
        <p>
          We prefer canonical and primary sources: official documentation, the author&rsquo;s own
          publication, and material from established academic or educational organisations.
          Community-created material is included when it is genuinely good, and is{' '}
          <strong className="text-fg font-semibold">always labelled as community-created</strong>{' '}
          rather than presented as official.
        </p>
        <p>
          Every resource carries a written justification for why it is in the catalogue. If we
          cannot say why something is useful, it does not get added.
        </p>
      </Section>

      <Section title="What “verified” means">
        <p>
          A resource is marked <Status kind="ok">verified</Status> only when a person has opened the
          link, confirmed the title matches, and checked that the cost, registration requirements
          and difficulty are described accurately. The date of that check is recorded and shown to
          you.
        </p>
        <p>
          A resource is <Status kind="warn">unverified</Status> when it has been added but not yet
          checked. It becomes <Status kind="warn">stale</Status> automatically if more than 180 days
          have passed since its last check, and <Status kind="danger">broken</Status> when its link
          is reported dead — at which point the link is disabled rather than left to fail silently.
        </p>
        <p>
          We do not invent URLs, titles, authors, durations, ratings, or claims. A resource with no
          verified URL shows no link at all, rather than a plausible-looking one.
        </p>
      </Section>

      <Section title="How ranking works">
        <p>
          Default ordering is a transparent, deterministic score.{' '}
          <strong className="text-fg font-semibold">Popularity is not an input</strong> — there are
          no view counts, star counts or &ldquo;trending&rdquo; signals, because those measure reach
          rather than quality and are trivially gamed.
        </p>
        <p>
          The score rewards: being verified, coming from an official or academic source, matching
          your stated level, being free, stating its learning outcomes, and having been checked
          recently. It penalises stale records, and excludes broken ones from default results.
        </p>
        <p>
          Each resource page shows why it ranks where it does. When you type a search query,
          ordering switches to text relevance instead.
        </p>
      </Section>

      <Section title="How progress is calculated">
        <p>
          Path progress is the number of <strong className="text-fg font-semibold">required</strong>{' '}
          items you have marked complete, divided by the total number of required items, rounded
          down:
        </p>
        <p className="bg-surface-subtle text-fg border-border rounded border p-3 font-mono text-sm">
          progress = floor(completedRequired / totalRequired × 100)
        </p>
        <ul>
          <li>
            Optional items are excluded from the denominator entirely. Completing one never moves
            the bar; it is counted separately.
          </li>
          <li>Checkpoints count as required items — you self-assess and tick them.</li>
          <li>A path with no required items shows &ldquo;Not started&rdquo;, never 0% or 100%.</li>
          <li>
            Progress is <strong className="text-fg font-semibold">never</strong> inferred from time
            spent, pages viewed, or scroll depth. Only an explicit tick from you counts.
          </li>
        </ul>
        <p>
          Topic coverage is deliberately shown as a{' '}
          <strong className="text-fg font-semibold">count, not a percentage</strong>. The catalogue
          is curated and incomplete, so &ldquo;you know 40% of NLP&rdquo; would be a claim we have
          no basis to make.
        </p>
      </Section>

      <Section title="Estimated times">
        <p>
          Time estimates are ranges with their assumptions stated, not schedules. How long something
          takes depends on your background and how much of the exercise work you actually do. Treat
          them as rough planning aids.
        </p>
      </Section>

      <Section title="Your data and privacy">
        <p>
          There are no accounts. Your level, goal, bookmarks, completions and recently viewed items
          are stored <strong className="text-fg font-semibold">only in your own browser</strong>,
          and are never transmitted anywhere. There is no analytics, no tracking, and no third-party
          scripts.
        </p>
        <p>
          The practical consequence: your progress does not sync between devices, and clearing site
          data erases it. You can export it as a file at any time from the progress page.
        </p>
      </Section>

      <Section title="Licensing and datasets">
        <p>
          Descriptions are our own paraphrase; we do not copy source text. Provider, author and
          canonical link are always preserved.
        </p>
        <p>
          <strong className="text-fg font-semibold">
            Dataset licences, terms of use, privacy constraints and research-only restrictions must
            be checked at the source before you use anything.
          </strong>{' '}
          The metadata here is a starting point for that check, not a substitute for it, and it can
          be out of date.
        </p>
      </Section>

      <Section title="Limitations">
        <p>
          This is an educational resource. Inclusion is not an endorsement, a guarantee of quality
          or safety, or professional advice. Coverage is uneven and reflects the judgement of
          whoever curated it. Where a summary states what a source claims, that is distinguished
          from our own reading of it.
        </p>
        <p>
          If you find a broken link or inaccurate metadata, please report it — the reporting link
          arrives with the resource library in Phase 4.
        </p>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-fg text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-fg-muted mt-3 space-y-3 leading-relaxed [&_li]:ml-4 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  )
}

function Status({ kind, children }: { kind: 'ok' | 'warn' | 'danger'; children: React.ReactNode }) {
  const styles = {
    ok: 'bg-ok-subtle text-ok',
    warn: 'bg-warn-subtle text-warn',
    danger: 'bg-danger-subtle text-danger',
  } as const

  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[0.8125rem] ${styles[kind]}`}>
      {children}
    </span>
  )
}
