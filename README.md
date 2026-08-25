# AI Atlas

A curated, provenance-tracked learning atlas for **AI, machine learning, deep learning, generative AI and NLP**.

It answers three questions a learner keeps re-asking: *what should I learn next*, *which resource is actually worth my time and why*, and *what have I already done*.

It is not a link dump and not a course platform. Every external resource carries honest provenance — who made it, when a human last checked it, why it is useful, and whether it has been verified at all.

> **Status: Phase 1.** Toolchain and deployment pipeline are in place, with routing and a real methodology page. Content, search and progress tracking do not exist yet. See the roadmap below.

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
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (includes the security guardrails below) |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` / `format:check` | Prettier write / verify |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage over `src/lib/**` |
| **`npm run verify`** | **format:check → lint → typecheck → test → build.** This is exactly what CI runs. |

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
| Known at build time (`/`, `/about`) | Pre-rendered — the build writes `dist/about/index.html` | True **HTTP 200**, no redirect flash |
| Dynamic (`/library/:id`, query strings) | `dist/404.html` encodes the URL and redirects to `index.html`, which restores it via `replaceState` | One brief redirect, URL preserved exactly |

Static routes are declared in [`src/routes-manifest.ts`](src/routes-manifest.ts). Add a route there when you add it to the route table — [`src/routes-manifest.test.ts`](src/routes-manifest.test.ts) fails if a pre-rendered route isn't actually routed, which would otherwise serve a confident 200 containing the "Page not found" view.

The redirect logic lives in [`src/lib/spa-fallback.ts`](src/lib/spa-fallback.ts) and is **inlined into `404.html` at build time from the same tested source**, so there is no untested copy-paste in a static HTML file.

### Verifying deployment behaviour locally

`vite preview` has its own SPA fallback and so cannot reveal Pages-specific bugs. To reproduce Pages' actual rules (serve the file, else `404.html` with a 404 status):

```bash
npm run build
npm run preview:pages   # http://localhost:4180/AI-Atlas/
```

Expected: `/` and `/about` return **200**; `/library?q=nlp` returns **404** while serving the redirector that restores the URL. That 404 is correct — it is what makes deep links work on a host with no rewrite rules.

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
| 2 | Content schema, Zod validation, build pipeline | Next |
| 3 | Design system, app shell, routing | |
| 4 | Resource library — search, filter, sort, detail | |
| 5 | Local user state — bookmarks, completion, profile | |
| 6 | Dashboard | |
| 7 | Learning paths and progress | ← **MVP ends here** |
| 8–13 | Datasets · papers · projects · glossary · link health · perf/SEO/a11y hardening | Post-MVP |

## Two rules this product will not bend on

1. **No invented URLs or metadata.** Records ship as `status: "unverified"` with `url: null` until a human opens the link and records the date. The content validator makes this a build failure, not a convention.
2. **No misleading progress.** Path progress is `floor(completedRequired / totalRequired × 100)` — optional items excluded, checkpoints included, `"Not started"` instead of `0%`, and never derived from views or time spent. Topic coverage is shown as a **count, never a percentage**, because the catalogue is curated and incomplete and a percentage would imply mastery we cannot measure.
