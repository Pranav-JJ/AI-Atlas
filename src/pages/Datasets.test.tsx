import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { resources } from '@/content/generated/index.ts'
import { hasNamedLicence, isDataset } from '@/lib/datasets.ts'

import { Datasets } from './Datasets.tsx'
import { ResourceDetail } from './ResourceDetail.tsx'

const datasets = resources.filter(isDataset)

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

function renderIndex(url = '/datasets') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <Routes>
        <Route path="/datasets" element={<Datasets />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/library/${id}`]}>
      <Routes>
        <Route path="/library/:resourceId" element={<ResourceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const currentUrl = () => screen.getByTestId('location').textContent ?? ''

describe('the seeded dataset catalogue', () => {
  it('ships datasets across several tasks and modalities', () => {
    expect(datasets.length).toBeGreaterThanOrEqual(6)
    expect(new Set(datasets.flatMap((d) => d.task)).size).toBeGreaterThan(3)
  })

  it('gives every dataset a non-empty licence field', () => {
    // Enforced by content rule 14; asserted here because the UI depends on it.
    for (const dataset of datasets) {
      expect(dataset.license.trim().length, dataset.id).toBeGreaterThan(0)
    }
  })

  it('records known limitations for every dataset', () => {
    // A dataset entry with no caveats is almost always an incomplete entry.
    for (const dataset of datasets) {
      expect(dataset.known_limitations.length, dataset.id).toBeGreaterThan(0)
    }
  })

  it('never records a benchmark score, only which metric is used', () => {
    // A number without its exact evaluation setup is not comparable to
    // anything, so we deliberately store metrics without values.
    for (const dataset of datasets) {
      for (const task of dataset.benchmark_tasks) {
        expect(Object.keys(task).sort()).toEqual(['metric', 'name'])
      }
    }
  })
})

describe('the licence warning cannot be avoided', () => {
  // The definition of done for this phase: no dataset can be shown without its
  // licence field AND the standing warning.
  it.each(datasets.map((d) => [d.id, d.title]))(
    '%s shows its licence and the warning on its detail page',
    (id) => {
      renderDetail(id)

      expect(screen.getByRole('heading', { name: /licence and access/i })).toBeVisible()
      expect(screen.getByText(/must be checked/i)).toBeVisible()
      expect(screen.getByText(/starting point for that check/i)).toBeVisible()
    },
  )

  it('shows the warning on the index too', () => {
    renderIndex()
    expect(screen.getByText(/must be verified/i)).toBeVisible()
  })

  it('has no dismiss control on the warning', () => {
    // A dismissible warning is a warning that will be dismissed once and never
    // seen again, which defeats the point of a standing caution.
    renderDetail(datasets[0]!.id)
    const notes = screen.getAllByRole('note')

    for (const note of notes) {
      expect(within(note).queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it('says explicitly when a licence is not settled', () => {
    const unsettled = datasets.find((d) => !hasNamedLicence(d.license))
    expect(unsettled).toBeDefined()

    renderDetail(unsettled!.id)
    expect(screen.getByText(/licence for this dataset is not settled/i)).toBeVisible()
  })

  it('does not add the unsettled note to a dataset with a named licence', () => {
    const named = datasets.find((d) => hasNamedLicence(d.license))
    expect(named).toBeDefined()

    renderDetail(named!.id)
    expect(screen.queryByText(/licence for this dataset is not settled/i)).not.toBeInTheDocument()
  })

  it('surfaces sensitive-data notes as their own warning', () => {
    const sensitive = datasets.find((d) => d.sensitive_data_notes !== null)
    expect(sensitive).toBeDefined()

    renderDetail(sensitive!.id)
    expect(screen.getByRole('note', { name: /sensitive data/i })).toBeVisible()
  })
})

describe('access requirements are visually distinct', () => {
  it('labels each access level in words, not by colour alone', () => {
    renderIndex()

    // Colour is never the only signal — every badge carries text.
    const labels = screen.getAllByText(
      /open access|requires|research use only|restricted|access terms unknown/i,
    )
    expect(labels.length).toBeGreaterThan(0)
  })

  it('marks research-only and restricted access with the danger tone', async () => {
    // No seeded dataset is research-only, so this asserts the mapping directly
    // rather than pretending the catalogue exercises it.
    const { ACCESS_TONE } = await import('@/lib/datasets.ts')

    expect(ACCESS_TONE['research-only']).toBe('danger')
    expect(ACCESS_TONE['restricted']).toBe('danger')
    expect(ACCESS_TONE['open']).toBe('ok')
    expect(ACCESS_TONE['unknown']).toBe('warn')
  })
})

describe('filters', () => {
  it('lists every dataset with no filters applied', () => {
    renderIndex()
    expect(screen.getByRole('status')).toHaveTextContent(`${datasets.length} datasets`)
  })

  it('filters by modality and records it in the URL', async () => {
    const user = userEvent.setup()
    renderIndex()

    await user.click(screen.getByRole('checkbox', { name: /^tabular$/i }))

    await waitFor(() => expect(currentUrl()).toContain('modality=tabular'))
    const expected = datasets.filter((d) => d.modality.includes('tabular')).length
    expect(screen.getByRole('status')).toHaveTextContent(`${expected} dataset`)
  })

  it('filters by access requirement', () => {
    const openCount = datasets.filter((d) => d.access_requirements === 'open').length
    renderIndex('/datasets?access=open')

    expect(screen.getByRole('status')).toHaveTextContent(`${openCount} dataset`)
  })

  it('filters to datasets whose licence is not settled', () => {
    const unsettled = datasets.filter((d) => !hasNamedLicence(d.license)).length
    renderIndex('/datasets?licence=unsettled')

    expect(screen.getByRole('status')).toHaveTextContent(`${unsettled} dataset`)
  })

  it('filters to datasets that name a licence', () => {
    const named = datasets.filter((d) => hasNamedLicence(d.license)).length
    renderIndex('/datasets?licence=named')

    expect(screen.getByRole('status')).toHaveTextContent(`${named} dataset`)
  })

  it('filters by task', () => {
    const task = datasets[0]!.task[0]!
    const expected = datasets.filter((d) => d.task.includes(task)).length

    renderIndex(`/datasets?task=${task}`)
    expect(screen.getByRole('status')).toHaveTextContent(`${expected} dataset`)
  })

  it('offers an honest empty state when nothing matches', () => {
    renderIndex('/datasets?modality=audio&modality=video')
    expect(screen.getByText(/no datasets match these filters/i)).toBeVisible()
    expect(screen.getByText(/small and still growing/i)).toBeVisible()
  })

  it('clears back to a bare URL', async () => {
    const user = userEvent.setup()
    renderIndex('/datasets?licence=named')

    await user.click(screen.getByRole('button', { name: /clear all/i }))

    await waitFor(() => expect(currentUrl()).toBe('/datasets'))
  })
})

describe('index cards', () => {
  it('shows the licence status on the card, not only the detail page', () => {
    renderIndex()
    expect(screen.getAllByText(/licence not settled/i).length).toBeGreaterThan(0)
  })

  it('links each dataset to its canonical library detail page', () => {
    // One record, one URL. A separate /datasets/:id would mean two URLs for the
    // same thing and two places for the warning to be forgotten.
    renderIndex()
    const link = screen.getByRole('link', { name: datasets[0]!.title })

    expect(link).toHaveAttribute('href', `/library/${datasets[0]!.id}`)
  })
})

describe('accessibility', () => {
  it('has no blocking violations on the index', async () => {
    const { container } = renderIndex()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on a dataset detail page', async () => {
    const { container } = renderDetail(datasets[0]!.id)
    await expectNoA11yViolations(container)
  })

  it('groups dataset filters under named fieldsets', () => {
    renderIndex()
    for (const legend of ['Modality', 'Task', 'Access', 'Licence']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument()
    }
  })
})
