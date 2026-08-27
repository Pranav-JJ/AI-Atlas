# AI Atlas

A curated, provenance-tracked learning atlas for **AI, machine learning, deep learning, generative AI and NLP**.

It answers three questions a learner keeps re-asking: *what should I learn next*, *which resource is actually worth my time and why*, and *what have I already done*.

It is not a link dump and not a course platform. Every external resource carries honest provenance — who made it, when a human last checked it, why it is useful, and whether it has been verified at all.

> **Status: Phase 4.** The resource library — search, 11 filters, sorting and detail pages — is live at [pranav-jj.github.io/AI-Atlas](https://pranav-jj.github.io/AI-Atlas/), over a validated catalogue of 124 records. Bookmarks, progress tracking and learning paths do not exist yet. See the roadmap below.

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
| Known at build time (`/`, `/library`, `/topics`, `/about`) | Pre-rendered — the build writes `dist/about/index.html` | True **HTTP 200**, no redirect flash |
| Dynamic (`/library/:id`, `/topics/:id`, query strings) | `dist/404.html` encodes the URL and redirects to `index.html`, which restores it via `replaceState` | One brief redirect, URL preserved exactly |

Static routes are declared in [`src/routes-manifest.ts`](src/routes-manifest.ts). Add a route there when you add it to the route table — [`src/routes-manifest.test.ts`](src/routes-manifest.test.ts) fails if a pre-rendered route isn't actually routed, which would otherwise serve a confident 200 containing the "Page not found" view.

The redirect logic lives in [`src/lib/spa-fallback.ts`](src/lib/spa-fallback.ts) and is **inlined into `404.html` at build time from the same tested source**, so there is no untested copy-paste in a static HTML file.

### Verifying deployment behaviour locally

`vite preview` has its own SPA fallback and so cannot reveal Pages-specific bugs. To reproduce Pages' actual rules (serve the file, else `404.html` with a 404 status):

```bash
npm run build
npm run preview:pages   # http://localhost:4180/AI-Atlas/
```

Expected: `/`, `/topics` and `/about` return **200** (a bare directory URL 301s to its trailing-slash form first); `/topics/nlp` returns **404** while serving the redirector that restores the URL. That 404 is correct — it is what makes deep links work on a host with no rewrite rules.

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

The search index is built at build time and shipped as its own lazily-imported chunk (~9 kB gzipped), fetched only when someone actually types a query. The library and detail routes are code-split too. A test asserts **p95 search latency under 50 ms at 1,000 records**.

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
| 5 | Local user state — bookmarks, completion, profile | Next |
| 6 | Dashboard | |
| 7 | Learning paths and progress | ← **MVP ends here** |
| 8–13 | Datasets · papers · projects · glossary · link health · perf/SEO/a11y hardening | Post-MVP |

## Two rules this product will not bend on

1. **No invented URLs or metadata.** Records ship as `status: "unverified"` with `url: null` until a human opens the link and records the date. The content validator makes this a build failure, not a convention.
2. **No misleading progress.** Path progress is `floor(completedRequired / totalRequired × 100)` — optional items excluded, checkpoints included, `"Not started"` instead of `0%`, and never derived from views or time spent. Topic coverage is shown as a **count, never a percentage**, because the catalogue is curated and incomplete and a percentage would imply mastery we cannot measure.
