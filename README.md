# AI Atlas

A curated, provenance-tracked learning atlas for **AI, machine learning, deep learning, generative AI and NLP**.

It answers three questions a learner keeps re-asking: *what should I learn next*, *which resource is actually worth my time and why*, and *what have I already done*.

It is not a link dump and not a course platform. Every external resource carries honest provenance — who made it, when a human last checked it, why it is useful, and whether it has been verified at all.

> **Status: Phase 12.** Every surface the plan described exists at [pranav-jj.github.io/AI-Atlas](https://pranav-jj.github.io/AI-Atlas/), over a validated catalogue of 160 records, with a scheduled link-health check and a report-a-problem affordance on every record. One phase remains: SEO, performance and accessibility hardening.

---

## Quick start

Requires **Node >= 22** (developed against v22.21.1) and npm.

```bash
npm ci          # or `npm install` on first clone
npm run dev     # http://localhost:5173/AI-Atlas/
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` locally at the real base path |
| `npm run preview:pages` | Serve `dist/` under **GitHub Pages' actual rules** — see below |
| `npm run content:validate` | Check `content/` against the schemas and the 14 editorial rules |
| `npm run content:build` | Compile `content/` into typed modules + a prebuilt search index |
| `npm run links:check` | Check every external URL and report; never edits content, always exits 0 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (includes the security guardrails below) |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` / `format:check` | Prettier write / verify |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage over `src/lib/**` |
| **`npm run verify`** | **format:check → content:validate → content:build → lint → typecheck → test → build.** This is exactly what CI runs. |

## Architecture at a glance

```
content/*.json  ──(zod validate)──▶ scripts/build-content.mjs ──▶ src/content/generated/*.ts
                                                              └──▶ search index (lazy chunk)
React SPA (Vite) ─ React Router (basename) ─ route chunks ─────────┘
        ├─ pure selectors (filter/sort/progress/recommend)   ← no React, fully unit-testable
        └─ Zustand store (persist → localStorage, versioned)
                                    npm run build ──▶ dist/ ──▶ GitHub Actions ──▶ Pages
```

- **No server runtime, no database, no API keys.** GitHub Pages compatibility is a hard architectural constraint.
- **Content is data, not code.** Adding a resource is a JSON edit and a PR; no component changes.
- **User progress is browser-local** (`localStorage`), versioned and exportable. There are no accounts.

## Deployment and the base path

The site is served from a subpath: `https://pranav-jj.github.io/AI-Atlas/`.

`VITE_BASE_PATH` in [`vite.config.ts`](vite.config.ts) is the **single** place this is configured. It needs a leading and trailing slash.

| Target | Value |
| --- | --- |
| Project site (this repo) | `/AI-Atlas/` |
| User/org root site, or custom domain | `/` |

```bash
VITE_BASE_PATH=/ npm run build   # root-domain build
```

GitHub Pages setup is **manual** (the `gh` CLI is not installed in this environment):

1. Create the repository on GitHub and push this branch.
2. **Settings → Pages → Source → GitHub Actions.**
3. Push to `main`. [`deploy.yml`](.github/workflows/deploy.yml) builds and publishes `dist/`, then smoke-tests the live URL.

The deploy workflow takes the base path from `actions/configure-pages`, so **renaming the repository or adding a custom domain needs no code change** — only the local default in `vite.config.ts` is `/AI-Atlas/`.

### How routing survives a static host

GitHub Pages has no rewrite rules, so an SPA deep link would normally 404. Two mechanisms handle it:

| Route kind | Mechanism | Result |
| --- | --- | --- |
| Known at build time (`/`, `/paths`, `/library`, `/datasets`, `/papers`, `/projects`, `/glossary`, `/topics`, `/progress`, `/onboarding`, `/about`) | Pre-rendered — the build writes `dist/about/index.html` | True **HTTP 200**, no redirect flash |
| Dynamic (`/paths/:id`, `/library/:id`, `/topics/:id`, query strings) | `dist/404.html` encodes the URL and redirects to `index.html`, which restores it via `replaceState` | One brief redirect, URL preserved exactly |

Static routes are declared in [`src/routes-manifest.ts`](src/routes-manifest.ts). Add a route there when you add it to the route table — [`src/routes-manifest.test.ts`](src/routes-manifest.test.ts) fails if a pre-rendered route isn't actually routed, which would otherwise serve a confident 200 containing the "Page not found" view.

The redirect logic lives in [`src/lib/spa-fallback.ts`](src/lib/spa-fallback.ts) and is **inlined into `404.html` at build time from the same tested source**, so there is no untested copy-paste in a static HTML file.

### Verifying deployment behaviour locally

`vite preview` has its own SPA fallback and so cannot reveal Pages-specific bugs. To reproduce Pages' actual rules (serve the file, else `404.html` with a 404 status):

```bash
npm run build
npm run preview:pages   # http://localhost:4180/AI-Atlas/
```

Expected: `/`, `/library`, `/topics`, `/progress`, `/onboarding` and `/about` return **200** (a bare directory URL 301s to its trailing-slash form first); `/topics/nlp` and `/library/:id` return **404** while serving the redirector that restores the URL. That 404 is correct — it is what makes deep links work on a host with no rewrite rules.

## Content

`content/` is the source of truth. Adding a resource is a JSON edit and a pull request — no component changes. See [CONTRIBUTING.md](CONTRIBUTING.md) to add one, and [EDITORIAL_POLICY.md](EDITORIAL_POLICY.md) for what the catalogue promises.

```
content/*.json ──(zod schemas + 14 cross-record rules)──▶ src/content/generated/*.ts
                                                     └──▶ prebuilt MiniSearch index
```

`src/content/generated/` is **derived and gitignored**, rebuilt by `predev`, `prebuild` and CI. Never edit or commit it.

Content is compiled into typed TypeScript rather than fetched as JSON at runtime: no network request, no loading state for content, and a content/schema mismatch becomes a compile error instead of a crash in someone's browser. The search index is built at build time — tokenising the catalogue in the browser on every page load would be the most expensive thing the app does.

### Two promises the build enforces

1. **Nothing is invented.** No URL, title, author, duration or peer-review status is written from memory. Unknown means `null`.
2. **Nothing unchecked is presented as authoritative.** `status: "verified"` requires a URL, a verification date *and* a verifier (rule 5); a record with no URL is forced to `unverified` (rule 6). Verifications older than 180 days are downgraded to `stale` automatically.

These are validation rules, not conventions — `npm run content:validate` fails, and it is a required CI check. Every one of the 14 rules has a test proving it **rejects a deliberately broken fixture** with a message naming the file and the record. A validation rule with no failing test is a rule nobody has checked actually fires.

Note that **an automated link check is not verification.** A script confirming HTTP 200 proves a server answered; it says nothing about whether the page still matches how we described it. Scripts may only produce `unverified` drafts for human review.

## The resource library

The library is the product's core surface. Three rules shape it:

**The URL is the source of truth.** Every filter, the query, the sort and the page size live in the query string, so a filtered view is shareable, survives a reload, and is correct under the back button. A URL is user-editable, so unknown or malformed values are *dropped* rather than rejected — a stray parameter narrows the view at worst, never produces an error page.

**Search and filtering are independent.** Text relevance decides what is *relevant*; facets decide what is *admissible*. Search runs first and returns ranked ids; facets then filter. Neither needs to know about the other, so each is tested and changed on its own.

**Facet semantics are uniform.** Within a facet values are OR-ed, across facets AND-ed. That is the only combination where ticking another box inside a facet can never shrink the result set.

### Deliberate honesty constraints

- A **broken** resource never renders a live link, and its dead URL appears in no `href` on the page. Broken records are also excluded from default results, but remain findable by filtering for them explicitly, because a maintainer needs to list them.
- A resource with **no URL** renders no button at all — not a disabled one, and not a plausible-looking link.
- Filtering by duration **excludes** resources with no recorded length. Including them would silently assert "this fits in 60 minutes" about something whose length nobody has established.
- The empty state names **which filter to loosen**, computed by re-running the filter without each active facet — not a generic "no results".
- The detail page's "why this ranks where it does" is rendered from **the same computation that produced the ordering**, so the explanation cannot drift from the ranking it explains.

### Performance

The search index is built at build time and shipped as its own lazily-imported chunk (~9 kB gzipped), fetched only when someone actually types a query. The library, detail, progress and onboarding routes are code-split too. A test asserts **p95 search latency under 50 ms at 1,000 records**.

**Known cost:** the entry chunk is ~125 kB gzipped, up from ~102 kB in Phase 4. Zod is now client-side, because validating persisted state on read is what makes the corruption handling correct — and `Home` reads the store, so it sits on the critical path. That is within the 180 kB budget, but it is a real cost for one feature. `zod/mini` (shipped in Zod 4) is the obvious lever if Phase 13 needs the headroom.

## The dashboard

The home page resumes work rather than marketing the product. What it will not do matters as much as what it does:

- **A first visit sees no zeroed counters and no empty progress widgets.** "0 saved, 0 done, 0%" tells a new arrival nothing and reads as broken. A first visit is the absence of *any* signal — profile, bookmarks, completions, history — not merely a missing profile, so someone who saved things but skipped onboarding is not treated as a new arrival.
- **Sections that would be empty are not rendered at all.**
- **Every recommendation shows its own reason**, verbatim, including "this is not personalised — tell us your level". The basis is always visible rather than implied.
- **Topic coverage is a count**, with the catalogue size as context and an explicit statement that it is not a measure of how much of a subject you know.
- **There is no path progress bar**, because there are no paths yet. The dashboard says so instead of rendering a bar with nothing behind it.

`recommendNext` prefers, in order: the next incomplete *required* item of a path already started → the path a finished path points at → the highest-scoring uncompleted resource matching the profile → nothing, stated plainly. It never suggests a resource with no link, or one that is broken or deprecated, and it ranks using **the same curated score the library sorts by** — a recommendation that disagreed with the library's own ordering would confuse anyone who went looking themselves.

Goal-to-topic mappings are checked against the real taxonomy by a test. A typo there would silently make a goal recommend nothing in particular, which is invisible because the fallback still returns a plausible resource.

## Learning paths and the progress rule

A path is an ordered route through part of the catalogue with the reasoning for each step written down — a suggestion, not a syllabus. Every path states what it assumes, so you can start in the middle.

**Progress has exactly one calculation**, and it lives in [`computePathProgress.ts`](src/lib/selectors/computePathProgress.ts):

```
progress = floor(completedRequired / totalRequired × 100)
```

- **Only required items count.** Optional items are tracked and shown separately; completing one never moves the bar.
- **Checkpoints count as required items** — you self-assess and tick them.
- **A path with no required items shows "Not started"**, never 0% or 100%, and renders no bar at all. An empty bar reads as "0% done", which is a different and unsupported claim.
- **Rounding is floor.** 2 of 3 is 66%, never 67% — rounding up would let a path read 100% before it was finished.
- **Progress is never inferred** from opening a link, scrolling, or time on page.

This rule is written in three places — the code, `EDITORIAL_POLICY.md`, and the path page itself — so a test asserts the policy document still matches the implementation. The rule is also rendered on the path page under "How this is calculated", from the same exported constants the code uses.

Time estimates are **ranges with their assumptions shown next to them**, never a single number. A number without its assumptions is a schedule, and this is not one.

## Datasets and benchmarks

Datasets are **specialisations of the resource record**, not a separate kind of thing. They live in `content/datasets/` but load into the same collection, so they appear in the library and all of its filters with no second code path — and cannot drift into a differently-shaped record over time.

Each has **one canonical URL** at `/library/:id`. `/datasets` is a specialised explorer over them (modality, task, access, licence) that links there. A separate `/datasets/:id` would mean two URLs for one record and two places for the warning to be forgotten.

### The licence warning is structurally unavoidable

The requirement was that no dataset can be shown without its licence field *and* a standing warning. Rather than remembering to add the warning on each new surface, the licence, the access terms and the warning are **one inseparable component** ([`DatasetDetails.tsx`](src/components/DatasetDetails.tsx)) — you cannot render one without the others. A parameterised test asserts this for **every** dataset in the catalogue, and another asserts the warning has no dismiss control.

### What is and is not recorded

- **Licences are read off the source, never recalled.** Where a source states a named licence it is recorded with a link to where it was read. Where it says "other", that is recorded as "other" — not upgraded to a guess. Where nothing is stated, `unknown`.
- Datasets whose licence is `unknown` or `other` are flagged as **"licence not settled"** on the card and in the warning, and are filterable as a group — the practical question is whether you still have work to do before using the data.
- **Benchmark metrics are recorded; benchmark scores are not.** A number without its exact evaluation setup is not comparable to anything. A test asserts no score field ever creeps in.
- Every dataset records **known limitations**. A dataset entry with no caveats is almost always an incomplete entry, so a test requires at least one.

## Papers

Papers live in `content/papers/` and, like datasets, load into the same resource collection — so they appear in the library and keep one canonical URL at `/library/:id`. `/papers` is a specialised index over them.

### Two summaries, never confusable

Each paper carries two summaries that must never be mistaken for one another:

- **"What the source says"** — a paraphrase of the paper's own abstract, read from the source rather than recalled.
- **"Our reading"** — AI Atlas's interpretation, explicitly attributed to us.

They get different headings, different backgrounds and a separate attribution line each, and each sits in its own labelled region so a screen reader user can tell them apart too. Tests assert both headings render for every paper, and that the two texts are never identical — identical text would make the separation theatre.

### Publication status is never assumed

`peer_review_status` is recorded **only where the source page states a venue**. Being on arXiv, or being widely cited, is not evidence of peer review.

Of the seven seeded papers, **only one** states a venue on its arXiv page ("Accepted at NeurIPS 2020"). The other six are marked `unknown` — with the interface saying so plainly rather than leaving the field blank for a reader to fill in optimistically. A test asserts that unknown papers have no venue, and that any paper claiming peer review names one.

**No benchmark figures are reproduced**, in either summary. A test scans for score patterns and fails if one creeps in: a number without its exact evaluation setup is not comparable to anything.

## Projects

Six projects, grouped by level, each anchored to a real dataset in the catalogue or explicitly telling you to bring your own.

Every project carries the same field set, and a parameterised test asserts **every one of them renders all of it**:

- What it teaches, and what you should end up with
- **Numbered milestones** — the order is the point
- **How to tell whether it worked**, decided before you start so the result cannot be chosen after the fact
- **How this usually goes wrong** — given its own warning-toned block rather than tucked at the end, because knowing the failure modes is worth more than another feature idea
- **Responsible-use notes**, rendered as a standing warning

### Constraints these hold to

- **Nothing needs rented hardware.** `requires_gpu` defaults false, is surfaced as a badge only when true, and a test asserts every seeded project stays laptop-feasible. A catalogue of projects that quietly assume a cloud budget is useless to the person it is for.
- **Effort is a range with its assumption stated** — that you do the evaluation step rather than stopping once something runs.
- **Tools are suggestions, not requirements**, and the page says so.
- Wherever a project recommends a dataset, the **licence caution is repeated** rather than assumed to have been read on the dataset page.

Several projects are deliberately about evaluation rather than model-building — showing that a summarisation metric disagrees with your own judgement, or that a respectable accuracy hides unacceptable group disparities. Those are the lessons that transfer.

## Glossary and concept pages

19 terms, each leading with a plain-language definition and — always visible — **what people usually get wrong about it**. The misconception is often the most useful thing on the page, and someone who already believes they understand a term will never expand a collapsed section to find it.

Progressive disclosure means the plain definition, the worked example and the misconception are visible without any interaction; the technical explanation, formula and code sit behind one "Go deeper" toggle. A beginner never has to expand anything to get a usable answer.

### The Markdown gate — decided by not taking it

The plan set a condition: *if* Markdown is introduced here, an allowlist sanitiser and XSS fixture tests become part of this phase's definition of done.

**Markdown was not introduced.** Glossary content is plain strings that React escapes, so there is no HTML path to sanitise, no parser to keep patched, and no `dangerouslySetInnerHTML` exemption to justify. The ESLint ban stands unbroken across the whole codebase.

The safety tests were written anyway, because "we don't render HTML" is a claim that should be provable:

- Fixtures containing `<script>`, `<img onerror>`, `javascript:` links and `<iframe>` are rendered and asserted to appear as **literal text**, with no such element produced.
- A real glossary page is rendered and asserted to contain no `script`, `iframe` or `object` element.
- Source files are checked for `dangerouslySetInnerHTML` directly, which catches the case where someone disables the lint rule inline.

**LaTeX is shown as source, not typeset.** Rendering it would mean adding a maths typesetter that emits HTML — a large dependency and a fresh injection surface, for a handful of short formulas. The page says the formula is LaTeX source rather than pretending otherwise.

Runtime dependencies remain six: `react`, `react-dom`, `react-router`, `zod`, `zustand`, `minisearch`. No Markdown parser, no sanitiser, no syntax highlighter, no maths renderer.

## Link health

Links rot. A weekly [scheduled workflow](.github/workflows/link-check.yml) checks every external URL in the catalogue — 75 of them — and maintains a single tracking issue.

Two rules govern it, and both are enforced rather than intended:

1. **It never edits content.** Deciding a link is dead is an editorial call. A script that rewrites records on a 404 will eventually retire something because a CDN had a bad afternoon. The workflow requests `contents: read` only, and a test asserts it never asks for write.
2. **It never fails a build.** It runs as its own workflow, exits 0 whatever it finds, and is wrapped in `|| true` so that a crash in the checker cannot masquerade as a content problem. Third-party flakiness must not gate publishing.

### Only evidence counts as evidence

A checker that cries wolf gets ignored, and an ignored checker is worse than none. So the classification separates two very different things:

| Response | Verdict |
| --- | --- |
| 404, 410 | **Gone** — the server positively says there is nothing there. Raised for review. |
| 401, 403, 405, 429 | Blocked. Bot protection and rate limits are routine for automated requests and say nothing about the link. |
| 5xx | Server error, retried once, then recorded as transient. |
| DNS / TLS / timeout | Unreachable. A CI resolver, an outage and a retired domain are indistinguishable from here. |

Only **gone** reaches the actionable section of the issue. Everything else goes in a collapsed block explicitly labelled *not evidence that a link is dead*. The issue closes itself when nothing is left to act on, so an open issue always means real work.

The check is polite: HEAD before GET, four at a time, a gap between requests, one retry, a 25-second timeout, and an honest user agent identifying the project.

### Reporting a problem

Every resource, dataset, paper, project, path and glossary page carries a **"Report it"** link that opens a GitHub issue prefilled with the record id, the recorded URL and the categories we actually act on. Someone who has to compose a report from scratch usually will not.

It is a plain GitHub link rather than a form, because this is a static site with no backend — anything else would mean a third-party form service or an endpoint that does not exist.

## Your data

There are no accounts. Everything AI Atlas remembers — level, goal, weekly target, bookmarks, completions, recently viewed — lives in **one `localStorage` key in your browser** and is never transmitted. `/progress` shows the complete extent of it, exports it, and deletes it.

### Reading it back safely

Persisted data outlives the code that wrote it, is user-editable, and can be corrupted by anything sharing the origin. [`migrations.ts`](src/lib/storage/migrations.ts) therefore holds three absolute rules:

1. **Never throw.** Broken data costs a user their progress; an exception costs them the whole site.
2. **Never discard more than necessary.** If whole-object validation fails, each field is validated on its own — one corrupt bookmark must not cost you your completions.
3. **Migrations are explicit and chained**, one version at a time.

The version lives *inside* the payload, not in the key name. Encoding it in the key means a schema bump silently orphans everyone's progress unless someone remembers to read the old key too.

Data from a **newer** version than the running build is left alone and defaults are used — two tabs on two versions must not let the older one write an older shape over newer data.

### Storage that does not work

Private windows and blocked-site-data settings don't return `null` — they **throw**, including on reads. Availability is detected by attempting a real write, every access is guarded, and when storage is unusable the app falls back to memory so the session still works. `/progress` and onboarding both say plainly that nothing is being saved.

### Completion is never inferred

It is set only by an explicit tick, never from opening a link, scrolling, or time on page. That is the rule the whole progress calculation rests on, so it is enforced at the single component that can set it.

The weekly target counts only completed resources that have a **recorded** length, and says so — including how many completions it could not count.

## Design system and accessibility

Colour is defined once, as CSS custom properties in [`src/styles/tokens.css`](src/styles/tokens.css), and consumed through Tailwind utilities. Three theme states, not two — `system` is genuinely distinct from an explicit choice, because it must keep following the OS setting if that changes later.

A render-blocking script in `<head>` applies a stored theme before first paint, so dark-mode users get no white flash. It is injected by a Vite plugin from [`src/lib/theme.ts`](src/lib/theme.ts) rather than pasted into `index.html`, so the storage key cannot drift from the module that owns it.

### Contrast is tested, not asserted

axe-core cannot check colour contrast under jsdom — there is no layout or paint engine. So [`src/lib/contrast.test.ts`](src/lib/contrast.test.ts) parses `tokens.css` and computes WCAG ratios directly against the token values, for **every** foreground/background pair that actually occurs in the UI, in **both** themes. It also asserts that the system-dark and explicit-dark blocks stay identical, and that no colour is defined only inside a theme block.

Body text must clear **4.5:1**. Boundaries that identify a control must clear **3:1** — that is what `--border-interactive` is for. `--border` and `--border-strong` are decorative separators and deliberately do not meet that bar; using them on a form control is a bug.

### Other accessibility guarantees, each covered by a test

- Zero critical or serious axe violations on every route.
- Exactly one `<h1>` per page, and heading levels never skip.
- Skip-to-content link is first in the tab order and targets the `<main>` landmark.
- No positive `tabindex` anywhere; the only `tabindex="-1"` is inside the `aria-hidden` mobile nav, which mirrors links that are reachable in the header.
- External links always carry `rel="noopener noreferrer"` and announce that they open a new tab.
- `prefers-reduced-motion` disables all transitions and the skeleton shimmer.

## Dependency pinning notes

Several packages are deliberately **not** on `latest`. Read this before "upgrading" them:

| Package | Pinned | Why not latest |
| --- | --- | --- |
| `typescript` | `5.9.3` | `latest` is 7.x (the native port). `typescript-eslint@8` peer-requires `>=4.8.4 <6.1.0`, so 7.x breaks linting. |
| `eslint` | `^9.39.5` (`maintenance` tag) | `latest` is 10.x, but `eslint-plugin-jsx-a11y@6.10.2` supports only up to ESLint 9. Accessibility linting matters more here than being on the newest major. |
| `react-router` | `^7.18.2` | v8 requires Node `>=22.22.0`; the dev environment is 22.21.1. |
| `jsdom` | `^29.1.1` | v30 requires Node `>=22.22.2`. |
| `@types/node` | `^22` | Must match the Node runtime, not the newest types. |

Raising the local Node version to `>=22.22.2` would unblock `react-router@8` and `jsdom@30`. TypeScript and ESLint stay pinned until `typescript-eslint` and `jsx-a11y` catch up.

Deliberately **not** installed: no UI kit (the ~6 primitives needed are hand-rolled), no charting library (a CSS progress bar is enough), no CMS, no hosted search, no analytics SDK.

## Security guardrails

Enforced by ESLint, not by convention ([`eslint.config.js`](eslint.config.js)):

- **`dangerouslySetInnerHTML` is banned.** Content is JSON strings only; React escapes them. If Markdown is introduced in Phase 11, it must go through an allowlist sanitizer, and relaxing this rule is a deliberate, tested, per-file decision.
- **`target="_blank"` requires `rel="noopener noreferrer"`** (tabnabbing). Prefer the `ExternalLink` component.

Content-level rules (URL scheme, verification status) are enforced at build time by the content validator in Phase 2.

## Testing

- **Vitest + Testing Library + jsdom** for unit and component tests.
- **axe-core** for accessibility, via [`tests/a11y.ts`](tests/a11y.ts). Critical and serious violations fail the build; minor/moderate are reported but do not block, so the gate stays credible.
- [`tests/a11y.test.ts`](tests/a11y.test.ts) is a **self-test for the helper** — it proves the assertion can actually fail. An a11y check that cannot fail is a false green.
- Colour contrast is *not* checked in jsdom (no layout engine); it is asserted against token values and in Lighthouse CI.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Toolchain bootstrap | ✅ Done |
| 1 | GitHub Pages pipeline (deploy early to de-risk base paths) | ✅ Done |
| 2 | Content schema, Zod validation, build pipeline | ✅ Done |
| 3 | Design system, app shell, routing | ✅ Done |
| 4 | Resource library — search, filter, sort, detail | ✅ Done |
| 5 | Local user state — bookmarks, completion, profile | ✅ Done |
| 6 | Dashboard | ✅ Done |
| 7 | Learning paths and progress | ✅ Done — **MVP complete** |
| 8 | Datasets and benchmarks explorer | ✅ Done |
| 9 | Papers and research | ✅ Done |
| 10 | Project explorer | ✅ Done |
| 11 | Glossary and concept pages | ✅ Done |
| 12 | Link health and editorial operations | ✅ Done |
| 13 | SEO, performance and accessibility hardening | Next |

## Two rules this product will not bend on

1. **No invented URLs or metadata.** Records ship as `status: "unverified"` with `url: null` until a human opens the link and records the date. The content validator makes this a build failure, not a convention.
2. **No misleading progress.** Path progress is `floor(completedRequired / totalRequired × 100)` — optional items excluded, checkpoints included, `"Not started"` instead of `0%`, and never derived from views or time spent. Topic coverage is shown as a **count, never a percentage**, because the catalogue is curated and incomplete and a percentage would imply mastery we cannot measure.
