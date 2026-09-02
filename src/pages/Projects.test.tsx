import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { projects, resources } from '@/content/generated/index.ts'
import { isDataset } from '@/lib/datasets.ts'

import { ProjectDetail } from './ProjectDetail.tsx'
import { Projects } from './Projects.tsx'

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

function renderIndex(url = '/projects') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${id}`]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const currentUrl = () => screen.getByTestId('location').textContent ?? ''

describe('the seeded project collection', () => {
  it('spans more than one level', () => {
    expect(projects.length).toBeGreaterThanOrEqual(5)
    expect(new Set(projects.map((p) => p.difficulty)).size).toBeGreaterThan(1)
  })

  it('keeps every project feasible on a laptop', () => {
    // The plan's constraint: projects must be realistic for one learner without
    // rented hardware. requires_gpu defaults false and must stay that way here.
    for (const project of projects) {
      expect(project.requires_gpu, project.id).toBe(false)
    }
  })

  it('gives every project failure modes and responsible-use notes', () => {
    for (const project of projects) {
      expect(project.common_failure_modes.length, project.id).toBeGreaterThan(0)
      expect(project.responsible_use_notes.length, project.id).toBeGreaterThan(20)
    }
  })

  it('gives every project at least two milestones and an evaluation approach', () => {
    for (const project of projects) {
      expect(project.milestones.length, project.id).toBeGreaterThanOrEqual(2)
      expect(project.evaluation_approach.length, project.id).toBeGreaterThan(20)
    }
  })

  it('states effort as a range, never a single number', () => {
    for (const project of projects) {
      expect(project.estimated_effort_hours.min, project.id).toBeLessThan(
        project.estimated_effort_hours.max,
      )
    }
  })

  it('only recommends datasets that are actually datasets', () => {
    const datasetIds = new Set(resources.filter(isDataset).map((d) => d.id))

    for (const project of projects) {
      for (const id of project.recommended_dataset_ids) {
        expect(datasetIds.has(id), `${project.id} -> ${id}`).toBe(true)
      }
    }
  })
})

describe('every project page renders the full field set', () => {
  // The definition of done for this phase.
  it.each(projects.map((p) => [p.id]))('%s renders all required sections', (id) => {
    renderDetail(id)

    expect(screen.getByRole('heading', { name: /what this teaches/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /milestones/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /how to tell whether it worked/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /how this usually goes wrong/i })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /before you use this for anything real/i }),
    ).toBeVisible()
  })

  it.each(projects.map((p) => [p.id]))('%s renders every milestone and failure mode', (id) => {
    const project = projects.find((p) => p.id === id)!
    renderDetail(id)

    for (const milestone of project.milestones) {
      expect(screen.getByText(milestone)).toBeVisible()
    }
    for (const failure of project.common_failure_modes) {
      expect(screen.getByText(failure)).toBeVisible()
    }
  })

  it('shows the responsible-use notes as a warning, not a footnote', () => {
    const project = projects[0]!
    renderDetail(project.id)

    const note = screen.getByRole('note')
    expect(within(note).getByText(project.responsible_use_notes)).toBeVisible()
  })

  it('numbers milestones, because their order is the point', () => {
    const { container } = renderDetail(projects[0]!.id)
    expect(container.querySelector('ol')).not.toBeNull()
  })

  it('404s an unknown project id', () => {
    renderDetail('not-a-real-project')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
  })
})

describe('hardware and effort are stated honestly', () => {
  it('says a laptop is enough when no GPU is needed', () => {
    renderDetail(projects[0]!.id)
    expect(screen.getByText(/a laptop is enough/i)).toBeVisible()
  })

  it('shows effort as a range with its assumption', () => {
    const project = projects[0]!
    renderDetail(project.id)

    expect(
      screen.getByText(
        new RegExp(
          `${project.estimated_effort_hours.min}–${project.estimated_effort_hours.max} hours`,
        ),
      ),
    ).toBeVisible()
    expect(screen.getByText(/assumes you do the evaluation step/i)).toBeVisible()
  })

  it('describes tools as suggestions rather than requirements', () => {
    renderDetail(projects[0]!.id)
    expect(screen.getByText(/suggestions, not requirements/i)).toBeVisible()
  })

  it('repeats the licence caution wherever a dataset is recommended', () => {
    const withDataset = projects.find((p) => p.recommended_dataset_ids.length > 0)
    expect(withDataset).toBeDefined()

    renderDetail(withDataset!.id)
    expect(screen.getByText(/licence and access terms at the source/i)).toBeVisible()
  })

  it('says "bring your own" rather than leaving the data section blank', () => {
    const withoutDataset = projects.find((p) => p.recommended_dataset_ids.length === 0)
    expect(withoutDataset).toBeDefined()

    renderDetail(withoutDataset!.id)
    expect(screen.getByText(/bring your own/i)).toBeVisible()
  })
})

describe('the project index', () => {
  it('lists every project grouped by level', () => {
    renderIndex()

    expect(screen.getByRole('status')).toHaveTextContent(`${projects.length} projects`)
    expect(screen.getByRole('heading', { level: 2, name: /^beginner$/i })).toBeVisible()
  })

  it('states that nothing needs rented hardware', () => {
    renderIndex()
    expect(screen.getByText(/runs on an ordinary laptop/i)).toBeVisible()
  })

  it('marks whether a project supplies data or expects your own', () => {
    renderIndex()
    expect(screen.getAllByText(/uses a public dataset/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/bring your own data/i).length).toBeGreaterThan(0)
  })

  it('shows no GPU badge when no project needs one', () => {
    // Exact text, not a loose match: the page's own copy says "None needs a
    // GPU", which a fuzzy regex would happily match.
    renderIndex()
    expect(screen.queryByText('Needs a GPU')).not.toBeInTheDocument()
  })

  it('restores a topic filter from the URL', () => {
    const topic = projects[0]!.topics[0]!
    const expected = projects.filter((p) => p.topics.includes(topic)).length

    renderIndex(`/projects?topic=${topic}`)

    expect(screen.getByRole('status')).toHaveTextContent(`${expected} project`)
  })

  it('records a ticked topic in the URL', async () => {
    const user = userEvent.setup()
    renderIndex()

    const checkbox = screen.getAllByRole('checkbox')[0]!
    await user.click(checkbox)

    await waitFor(() => expect(currentUrl()).toContain('topic='))
  })

  it('offers an honest empty state', () => {
    renderIndex('/projects?topic=no-such-topic')
    expect(screen.getByText(/no projects match these filters/i)).toBeVisible()
    expect(screen.getByText(/small and still growing/i)).toBeVisible()
  })

  it('clears filters back to a bare URL', async () => {
    const user = userEvent.setup()
    renderIndex(`/projects?topic=${projects[0]!.topics[0]!}`)

    await user.click(screen.getByRole('button', { name: /^clear$/i }))

    await waitFor(() => expect(currentUrl()).toBe('/projects'))
  })

  it('links each project to its detail page', () => {
    renderIndex()
    const link = screen.getByRole('link', { name: projects[0]!.title })

    expect(link).toHaveAttribute('href', `/projects/${projects[0]!.id}`)
  })
})

describe('accessibility', () => {
  it('has no blocking violations on the index', async () => {
    const { container } = renderIndex()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on a project detail page', async () => {
    const { container } = renderDetail(projects[0]!.id)
    await expectNoA11yViolations(container)
  })

  it('has exactly one h1 on a detail page', () => {
    renderDetail(projects[0]!.id)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
