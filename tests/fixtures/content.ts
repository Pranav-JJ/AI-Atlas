import type {
  AnyResource,
  GlossaryTerm,
  LearningPath,
  Project,
  Provider,
  Topic,
} from '@/lib/schema/index.ts'
import { emptyContentSet, type ContentSet, type Sourced } from '@/lib/content/rules.ts'

/**
 * Builders for valid content records that tests then deliberately break.
 *
 * Every builder returns something that PASSES validation. A test names the one
 * field it corrupts, so the assertion is unambiguous about which rule fired and
 * why — rather than a fixture that fails for three reasons at once.
 *
 * Overrides are loosely typed on purpose: most of these tests supply values that
 * the TypeScript types forbid (a number where a string belongs, an unknown enum
 * member), which is exactly the class of mistake a content contributor makes in
 * a JSON file where no compiler is watching.
 */

type Overrides = Record<string, unknown>

export function makeTopic(overrides: Overrides = {}): Topic {
  return {
    id: 'test-topic',
    name: 'Test topic',
    domain: 'nlp',
    parentId: null,
    short_definition: 'A topic used in tests, long enough to satisfy the minimum length rule.',
    prerequisiteTopics: [],
    order: 1,
    ...overrides,
  } as Topic
}

export function makeProvider(overrides: Overrides = {}): Provider {
  return {
    id: 'test-provider',
    name: 'Test Provider',
    kind: 'official',
    site_url: 'https://example.com',
    ...overrides,
  } as Provider
}

export function makeResource(overrides: Overrides = {}): AnyResource {
  return {
    id: 'test-resource',
    title: 'A test resource',
    description: 'A description that comfortably exceeds the twenty character minimum length.',
    url: 'https://example.com/guide',
    resource_type: 'tutorial',
    provider_id: null,
    author: null,
    topics: ['test-topic'],
    subtopics: [],
    difficulty: 'beginner',
    estimated_duration_minutes: 30,
    format: 'text',
    cost_type: 'free',
    language: 'en',
    prerequisites: { topics: [], resources: [] },
    source_date: null,
    last_verified_at: null,
    verified_by: null,
    quality_notes: null,
    why_useful:
      'This sentence exists purely so the why_useful field clears its forty character floor.',
    learning_outcomes: [],
    is_beginner_friendly: true,
    is_project_based: false,
    has_certificate: false,
    theory_vs_practice: 'balanced',
    status: 'unverified',
    added_at: '2026-01-01',
    ...overrides,
  } as AnyResource
}

export function makeDataset(overrides: Overrides = {}): AnyResource {
  return makeResource({
    id: 'test-dataset',
    resource_type: 'dataset',
    task: ['text-classification'],
    domain: 'reviews',
    modality: ['text'],
    size_description: '50k documents',
    license: 'CC-BY-4.0',
    license_url: null,
    access_requirements: 'open',
    sensitive_data_notes: null,
    known_limitations: [],
    benchmark_tasks: [],
    documentation_url: null,
    access_instructions: null,
    ...overrides,
  })
}

export function makePaper(overrides: Overrides = {}): AnyResource {
  return makeResource({
    id: 'test-paper',
    resource_type: 'paper',
    authors: ['A. Researcher'],
    year: 2020,
    venue: null,
    peer_review_status: 'unknown',
    abstract_summary: null,
    key_idea: null,
    code_url: null,
    dataset_ids: [],
    ...overrides,
  })
}

export function makeVideo(overrides: Overrides = {}): AnyResource {
  return makeResource({
    id: 'test-video',
    resource_type: 'video',
    format: 'video',
    channel: 'Test Channel',
    playlist_url: null,
    is_part_of_course: false,
    embeddable: null,
    ...overrides,
  })
}

export function makePathItem(overrides: Overrides = {}): unknown {
  return {
    kind: 'resource',
    resource_id: 'test-resource',
    checkpoint: null,
    required: true,
    order: 1,
    note: null,
    ...overrides,
  }
}

export function makeLearningPath(overrides: Overrides = {}): LearningPath {
  return {
    id: 'test-path',
    title: 'A test path',
    audience: 'Someone who needs a valid learning path fixture for these tests.',
    outcome_statement: 'You will have a learning path record that passes validation.',
    prerequisites: { topics: [], description: 'No prerequisites for this fixture.' },
    estimated_hours: { min: 5, max: 10 },
    estimate_assumptions: 'Assumes this fixture is never actually studied by anyone.',
    modules: [
      {
        id: 'test-module',
        title: 'A test module',
        summary: 'A module summary long enough to satisfy the minimum length constraint.',
        items: [makePathItem()],
      },
    ],
    suggested_project_ids: [],
    completion_criteria: 'All required items complete.',
    next_path_ids: [],
    status: 'unverified',
    ...overrides,
  } as LearningPath
}

export function makeProject(overrides: Overrides = {}): Project {
  return {
    id: 'test-project',
    title: 'A test project',
    problem_statement:
      'A problem statement that is comfortably longer than the forty character minimum required here.',
    learning_objectives: ['Learn something measurable from this fixture'],
    topics: ['test-topic'],
    difficulty: 'beginner',
    recommended_dataset_ids: [],
    suggested_tools: ['python'],
    expected_output: 'A repository containing a working solution.',
    milestones: ['Load and inspect the data', 'Train and evaluate a baseline'],
    evaluation_approach: 'Compare against a trivial baseline on a held-out split.',
    stretch_goals: [],
    common_failure_modes: ['Evaluating on data the model already saw'],
    estimated_effort_hours: { min: 4, max: 8 },
    responsible_use_notes: 'This fixture has no real-world use and no associated risks.',
    requires_gpu: false,
    ...overrides,
  } as Project
}

export function makeGlossaryTerm(overrides: Overrides = {}): GlossaryTerm {
  return {
    id: 'test-term',
    term: 'Test term',
    aliases: [],
    plain_definition: 'A definition written plainly, and long enough to pass validation.',
    technical_explanation:
      'A more technical explanation, comfortably longer than the forty character minimum.',
    example: null,
    formula_latex: null,
    code_example: null,
    common_misconception: null,
    related_term_ids: [],
    topics: ['test-topic'],
    resource_ids: [],
    ...overrides,
  } as GlossaryTerm
}

function sourced<T>(records: T[], file: string): Array<Sourced<T>> {
  return records.map((record) => ({ file, record }))
}

/** Assembles a minimal but internally consistent content set. */
export function makeContentSet(
  parts: Partial<Record<keyof ContentSet, unknown[]>> = {},
): ContentSet {
  const set = emptyContentSet()

  set.topics = sourced((parts.topics as Topic[]) ?? [makeTopic()], 'content/topics.json')
  set.providers = sourced((parts.providers as Provider[]) ?? [], 'content/providers.json')
  set.resources = sourced((parts.resources as AnyResource[]) ?? [], 'content/resources/test.json')
  set.paths = sourced((parts.paths as LearningPath[]) ?? [], 'content/paths/test.json')
  set.projects = sourced((parts.projects as Project[]) ?? [], 'content/projects/test.json')
  set.glossary = sourced((parts.glossary as GlossaryTerm[]) ?? [], 'content/glossary/test.json')

  return set
}
