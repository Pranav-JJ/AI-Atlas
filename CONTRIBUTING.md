# Contributing

Most contributions to AI Atlas are **content edits, not code changes**. Adding a resource means editing one JSON file and opening a pull request. No components change.

Read [EDITORIAL_POLICY.md](EDITORIAL_POLICY.md) first — it explains what the catalogue promises and which promises the build enforces.

---

## Adding a resource

1. Pick the file under [`content/resources/`](content/resources/) matching the domain: `foundations`, `machine-learning`, `deep-learning`, `nlp`, `genai` or `mlops`.
2. Copy an existing record and edit it. Every field is required — use `null` where a value is genuinely unknown, never a guess.
3. Run `npm run content:validate`.
4. Open a pull request.

```jsonc
{
  "id": "res-something-descriptive",     // kebab-case, unique across ALL content, never reused
  "title": "Verbatim title from the source",
  "description": "What the resource contains. Factual, our own words, 20-600 chars.",
  "url": "https://...",                  // https only, or null if not yet sourced
  "resource_type": "tutorial",           // video | course | book | tutorial | documentation |
                                         // paper | article | dataset | benchmark | library |
                                         // model-hub | notebook | project | community | podcast
  "provider_id": "scikit-learn",         // must exist in content/providers.json, or null
  "author": null,
  "topics": ["model-selection-validation"],  // >= 1, all must exist in content/topics.json
  "subtopics": [],
  "difficulty": "intermediate",          // beginner | intermediate | advanced
  "estimated_duration_minutes": 60,      // positive integer, or null for open-ended material
  "format": "text",                      // text | video | audio | interactive | code
  "cost_type": "free",                   // free | freemium | paid | free-with-registration
  "language": "en",                      // BCP-47
  "prerequisites": { "topics": [], "resources": [] },
  "source_date": null,                   // when the source was published, if stated
  "last_verified_at": null,              // set ONLY when you have opened the link yourself
  "verified_by": null,
  "quality_notes": null,                 // caveats: vendor-authored, partially paywalled, etc.
  "why_useful": "At least 40 characters saying why this earns a learner's time.",
  "learning_outcomes": ["What you can do afterwards"],   // 0-8 items
  "is_beginner_friendly": true,
  "is_project_based": false,
  "has_certificate": false,
  "theory_vs_practice": "balanced",      // theory | balanced | practice
  "status": "unverified",
  "added_at": "2026-08-25"
}
```

Some types carry extra fields: **videos** add `channel`, `playlist_url`, `is_part_of_course`, `embeddable`; **papers** add `authors`, `year`, `venue`, `peer_review_status`, `abstract_summary`, `key_idea`, `code_url`, `dataset_ids`; **datasets** add `task`, `modality`, `license`, `access_requirements`, `known_limitations` and more. Copy a neighbouring record of the same type.

### The rules that trip people up

- **`status` must be `"unverified"` unless you personally opened the link.** Setting `"verified"` requires `url`, `last_verified_at` *and* `verified_by`. The build rejects a verified record missing any of them.
- **`url: null` forces `status: "unverified"`.** There is nothing to have verified.
- **`why_useful` must be at least 40 characters.** If you cannot say why the resource earns someone's time, it does not belong in the catalogue.
- **Unknown fields are errors, not ignored.** A typo like `dificulty` fails the build rather than silently dropping your value.
- **Never invent a title, author, duration or date.** Copy the title verbatim; use `null` for anything you did not read off the source.

## Adding a topic

Edit [`content/topics.json`](content/topics.json). Topics form a graph, so two things are checked: `parentId` and every entry in `prerequisiteTopics` must exist, and neither may form a cycle.

## Adding a provider

Edit [`content/providers.json`](content/providers.json). `kind` is one of `official`, `academic`, `commercial` or `community`, and it is load-bearing: it drives both ranking and the label shown to users. Community material is included when it is good, but it is always shown as community-created.

---

## Commands

```bash
npm run content:validate    # check content/ against the schemas and the 14 rules
npm run content:build       # compile content/ into src/content/generated/
npm run verify              # everything CI runs
```

`content:validate` reports errors and warnings separately. Errors block the build; warnings (a stale verification, a duplicate url) do not.

Example failure:

```
  error  content/resources/nlp.json (res-example) [rule 2: topic references resolve]
         topics: references unknown topic "tokenisation"
```

## How the pipeline fits together

```
content/*.json ──(zod schemas + cross-record rules)──▶ src/content/generated/*.ts
                                                  └──▶ prebuilt search index
```

- `content/` is the **source of truth**. It is the only thing you edit.
- `src/content/generated/` is **derived and gitignored**. It is rebuilt by `predev`, `prebuild` and CI. Never edit it, and never commit it.
- Content is compiled into typed TypeScript modules rather than fetched as JSON at runtime: no network request, no loading state, and a content/schema mismatch becomes a compile error instead of a crash in someone's browser.
- The search index is built at build time. Tokenising the catalogue in the browser on every page load would be the most expensive thing the app does.

## Code changes

```bash
npm ci
npm run dev
npm run verify     # format, content validation, lint, typecheck, tests, build
```

Two ESLint rules exist for security reasons and should not be disabled casually:

- **`dangerouslySetInnerHTML` is banned.** Content is JSON strings; React escapes them.
- **`target="_blank"` requires `rel="noopener noreferrer"`.**

Every validation rule needs a test proving it **fails a deliberately broken fixture**. A rule with no failing test is a rule nobody has checked actually fires. Fixture builders live in [`tests/fixtures/content.ts`](tests/fixtures/content.ts) — they return valid records that your test then corrupts in exactly one field.
