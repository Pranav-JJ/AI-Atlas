# Editorial policy

AI Atlas is a curated catalogue. Its only real asset is that its metadata can be trusted. This document states what we promise, what we do not, and which promises are enforced by the build rather than by good intentions.

---

## The two rules that are not negotiable

**1. Nothing is invented.** No URL, title, author, duration, rating, benchmark result or peer-review status is ever written from memory or inference. If a fact is not taken from the source, the field is `null`.

**2. Nothing unchecked is presented as authoritative.** A record whose link nobody has opened is `unverified`, and the interface says so. A record with no link shows no link — never a plausible-looking one.

Both are enforced by `npm run content:validate` (rules 4, 5 and 6 below) and run in CI. They are build failures, not conventions someone can forget.

---

## Verification lifecycle

| Status | Meaning |
| --- | --- |
| `unverified` | Added to the catalogue. Nobody has opened the link and checked the metadata against it. |
| `verified` | A person opened the link and confirmed the title, cost, access requirements and difficulty, on a recorded date, under a recorded name. |
| `stale` | Verified more than **180 days** ago. Applied automatically at build time; you cannot set it by hand. |
| `broken` | Link reported dead. The UI disables the link rather than letting it fail silently. |
| `deprecated` | Superseded or withdrawn by its author. |

### How a record becomes verified

1. **Slot.** Author the record with its editorial judgement — `why_useful`, `topics`, `difficulty`, `learning_outcomes` — and `status: "unverified"`.
2. **Source.** Find a canonical candidate, in this order of preference: official documentation → the author's own publication → an established academic or educational organisation → community material.
3. **Open it.** Confirm the link loads, the title matches **exactly**, and that `cost_type`, registration requirements, region restrictions and `difficulty` describe reality.
4. **Record.** Set `url`, `title` (verbatim from the source), `source_date`, `provider_id`, `last_verified_at` (today), `verified_by`, and `status: "verified"`.
5. **Review.** A second person checks: nothing fabricated, claims separated from inferences, licence and attribution preserved, paid/registration/region/research-only flags correct.

Automated link checking is **not** verification. A script confirming HTTP 200 proves a server answered; it says nothing about whether the page is still the thing we described. Scripts may only produce `unverified` drafts for human review — they never publish.

### Re-verification

Records older than 180 days are downgraded to `stale` **at build time**. Staleness is derived from `last_verified_at`, so the build never rewrites content files: the only thing that clears a stale record is opening the link again and updating the date.

---

## Source preference and labelling

- Prefer canonical and primary sources.
- Community-created material is included when it is genuinely good, and is **always labelled as community-created** via `provider.kind`. It is never passed off as official.
- Vendor documentation is included where it is the best available treatment, and `quality_notes` must say whose product it is.
- Descriptions are **our own paraphrase**. Source text is not copied.
- Provider, author and canonical link are always preserved.

## What `why_useful` is for

Every record must justify its place in at least 40 characters. If we cannot say why a resource earns a learner's time, it does not belong in the catalogue. This is rule 7, and it is enforced.

`why_useful` is our editorial opinion. `description` is a factual account of what the resource contains. Keep them distinct.

## Claims versus inferences

For papers, `abstract_summary` is a paraphrase of **what the source says**. `key_idea` is **our reading of it**. The interface renders these under distinct labels, and they must never be merged.

`peer_review_status` defaults to `unknown`. Setting it to `peer-reviewed` requires naming the venue (rule 13). We do not assert peer review we cannot point at — an arXiv identifier is not evidence of it.

## Datasets

`license` is required and has no default. Where the licence genuinely cannot be determined, the literal string `"unknown"` is required, which the interface surfaces as a warning rather than hiding.

Dataset licences, terms of use, privacy constraints and research-only restrictions **must be checked at the source before use**. Our metadata is a starting point for that check, not a substitute, and it can be out of date.

## Estimates

Time estimates are **ranges with their assumptions stated**, never schedules. `estimated_hours` carries a `min` and a `max`, and `estimate_assumptions` is required alongside it.

## What we do not claim

Inclusion is not an endorsement, a guarantee of quality or safety, or professional advice. Coverage is uneven and reflects the judgement of whoever curated it.

---

## The 14 validation rules

Errors block the build. Warnings are reported and do not.

| # | Rule | Severity | Enforced in |
| --- | --- | --- | --- |
| 1 | Ids are kebab-case and unique across the **entire** content set | error | schema + `rules.ts` |
| 2 | Every topic reference resolves | error | `rules.ts` |
| 3 | Every record reference resolves (resource, provider, dataset, project, path, term) | error | `rules.ts` |
| 4 | Urls are `https`, with no credentials and no `javascript:`/`data:` schemes | error | schema |
| 5 | `status: "verified"` requires `url`, `last_verified_at` **and** `verified_by` | error | schema |
| 6 | `url: null` forces `status: "unverified"` | error | schema |
| 7 | `why_useful` is at least 40 characters | error | schema |
| 8 | Durations are positive integers; `hours.min <= hours.max` | error | schema |
| 9 | Verification older than 180 days downgrades to `stale` | warning | `rules.ts` (build) |
| 10 | The topic graph is acyclic, through both `parentId` and `prerequisiteTopics` | error | `rules.ts` |
| 11 | Module item `order` is unique and contiguous from 1 | error | schema |
| 12 | No two records share a url | warning | `rules.ts` |
| 13 | `peer_review_status: "peer-reviewed"` requires a `venue` | error | schema |
| 14 | Datasets declare a `license` (possibly the string `"unknown"`) | error | schema |

Unknown fields are also rejected, so a typo in a JSON key fails loudly instead of silently dropping the value.

Every rule has a test that proves it **fails a deliberately broken fixture** with a message naming the file and the record — see `src/lib/schema/schema.test.ts`, `src/lib/content/rules.test.ts` and `tests/content-pipeline.test.ts`. A validation rule with no failing test is a rule nobody has checked actually fires.

---

## How progress is calculated

Documented here because it is an editorial promise, not just an implementation detail.

```
pathProgress = floor(completedRequiredItems / totalRequiredItems * 100)
```

- Only `required: true` items count toward the denominator. Optional items are counted and displayed separately, and completing one never moves the bar.
- Checkpoints count as required items.
- A path with no required items shows **"Not started"** — never `0%` or `100%`.
- Progress is **never** inferred from time spent, pages viewed, or scroll depth. Only an explicit tick from the learner counts.

**Topic coverage is shown as a count, never a percentage.** The catalogue is curated and incomplete, so "you know 40% of NLP" would be a claim we have no basis to make.

## How ranking works

Default ordering with no search query is a transparent, deterministic score. **Popularity is not an input** — no view counts, no stars, no "trending" — because those measure reach rather than quality and are trivially gamed.

```
+3  status is verified
+2  provider kind is official or academic
+2  matches the learner's stated level
+1  cost_type is free
+1  learning_outcomes is non-empty
+1  verified within the last 180 days
-2  status is stale
-5  status is broken   (also excluded from default results)
```

With a search query, ordering switches to text relevance. Each resource page shows why it ranks where it does.

## Reporting a problem

Broken links and inaccurate metadata are expected over time, not exceptional. Report them by opening an issue; the in-app reporting affordance arrives with the resource library.
