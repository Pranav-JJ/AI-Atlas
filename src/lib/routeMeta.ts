/**
 * Per-route metadata, resolved at BUILD time.
 *
 * The reason this exists: meta tags set by React are applied after the page
 * runs. Search crawlers execute JavaScript and will see them, but the social
 * crawlers behind link previews — Slack, Twitter, LinkedIn, iMessage — read the
 * HTML as served and do not. A runtime-only <title> therefore gives every
 * shared link on this site the same generic preview.
 *
 * So the build injects real per-route metadata into each pre-rendered page. This
 * module is the single source those pages and the sitemap are generated from,
 * and it is plain data with no React import so the build can use it directly.
 */

export interface RouteMeta {
  path: string
  title: string
  description: string
  /** Roughly how often the page changes, for the sitemap. */
  changefreq: 'daily' | 'weekly' | 'monthly'
  /** Relative importance within the site, for the sitemap. */
  priority: number
}

const SITE_NAME = 'AI Atlas'

/** Titles read as "Page — AI Atlas", except the home page which is just the site. */
export function formatTitle(title: string): string {
  return title === SITE_NAME ? SITE_NAME : `${title} — ${SITE_NAME}`
}

/**
 * The fixed section routes.
 *
 * Kept in step with what each page renders by a test that mounts every route
 * and compares document.title against this table — the two would otherwise
 * drift the first time someone reworded a heading.
 */
export const SECTION_META: readonly RouteMeta[] = [
  {
    path: '/',
    title: SITE_NAME,
    description:
      'A curated, provenance-tracked learning atlas for AI, machine learning, deep learning, generative AI and NLP.',
    changefreq: 'weekly',
    priority: 1.0,
  },
  {
    path: '/paths',
    title: 'Learning paths',
    description:
      'Ordered routes through the AI Atlas catalogue, with prerequisites, honest time ranges and progress you control.',
    changefreq: 'weekly',
    priority: 0.9,
  },
  {
    path: '/library',
    title: 'Resource library',
    description:
      'Search and filter the AI Atlas catalogue by topic, type, difficulty, cost, duration and verification status.',
    changefreq: 'weekly',
    priority: 0.9,
  },
  {
    path: '/datasets',
    title: 'Datasets and benchmarks',
    description:
      'Datasets and benchmarks with their licence, access terms, known limitations and sensitive-data considerations — always to be checked at the source.',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    path: '/papers',
    title: 'Papers and research',
    description:
      'Primary sources with their prerequisites, publication status, and a clear separation between what each paper claims and how we read it.',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    path: '/projects',
    title: 'Project ideas',
    description:
      'Projects a single learner can finish on their own laptop, each with milestones, an evaluation approach, common failure modes and responsible-use notes.',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    path: '/glossary',
    title: 'Glossary',
    description:
      'Plain-language definitions of the terms that come up constantly in AI and machine learning, each with the misconception people usually arrive with.',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    path: '/topics',
    title: 'Topics',
    description:
      'The AI Atlas topic map: foundations, machine learning, deep learning, NLP, generative AI and production MLOps, with prerequisites for each.',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    path: '/progress',
    title: 'Your progress',
    description:
      'Everything AI Atlas remembers about you, stored only in this browser. Export it or delete it at any time.',
    changefreq: 'monthly',
    priority: 0.3,
  },
  {
    path: '/onboarding',
    title: 'Set your starting point',
    description:
      'Tell AI Atlas your level and goal so it can recommend a sensible order. Stored only in your browser.',
    changefreq: 'monthly',
    priority: 0.3,
  },
  {
    path: '/about',
    title: 'Methodology and source policy',
    description:
      'How AI Atlas selects resources, what "verified" means, how ranking and progress are calculated, and what happens to your data.',
    changefreq: 'monthly',
    priority: 0.6,
  },
]

/** Trims a description to something a preview card will actually show. */
export function truncateDescription(text: string, limit = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean

  const cut = clean.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : limit).trimEnd()}…`
}

interface RecordLike {
  id: string
  title?: string
  term?: string
  name?: string
  description?: string
  plain_definition?: string
  problem_statement?: string
  outcome_statement?: string
  short_definition?: string
}

/** Builds the route entries for one content collection. */
export function recordRoutes(
  records: readonly RecordLike[],
  prefix: string,
  options: { changefreq?: RouteMeta['changefreq']; priority?: number } = {},
): RouteMeta[] {
  const { changefreq = 'monthly', priority = 0.6 } = options

  return records.map((record) => ({
    path: `${prefix}/${record.id}`,
    title: record.title ?? record.term ?? record.name ?? record.id,
    description: truncateDescription(
      record.description ??
        record.plain_definition ??
        record.outcome_statement ??
        record.problem_statement ??
        record.short_definition ??
        '',
    ),
    changefreq,
    priority,
  }))
}
