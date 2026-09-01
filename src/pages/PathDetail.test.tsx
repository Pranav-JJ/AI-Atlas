import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { learningPaths } from '@/content/generated/index.ts'
import { computePathProgress } from '@/lib/selectors/computePathProgress.ts'
import type { SafeStorage } from '@/lib/storage/safeStorage.ts'
import { __resetStoreForTests, useUserStore } from '@/lib/storage/store.ts'

import { PathDetail } from './PathDetail.tsx'
import { Paths } from './Paths.tsx'

function memoryStorage(): SafeStorage {
  const map = new Map<string, string>()
  return {
    read: (k) => map.get(k) ?? null,
    write: (k, v) => {
      map.set(k, v)
      return true
    },
    remove: (k) => {
      map.delete(k)
    },
    availability: 'available',
  }
}

const path = learningPaths[0]!

function renderPath(id = path.id) {
  return render(
    <MemoryRouter initialEntries={[`/paths/${id}`]}>
      <Routes>
        <Route path="/paths" element={<Paths />} />
        <Route path="/paths/:pathId" element={<PathDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={['/paths']}>
      <Routes>
        <Route path="/paths" element={<Paths />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Ticks every required item, the way a learner finishing the path would. */
function completeAllRequired() {
  const store = useUserStore.getState()

  for (const module of path.modules) {
    for (const item of module.items) {
      if (!item.required) continue

      if (item.kind === 'checkpoint') {
        store.toggleCheckpoint(path.id, `${module.id}#${item.order}`)
      } else if (item.resource_id) {
        store.toggleCompletion(item.resource_id)
      }
    }
  }
}

beforeEach(() => {
  __resetStoreForTests(memoryStorage())
})

describe('the catalogue ships a usable path', () => {
  it('has at least one path with required items and checkpoints', () => {
    expect(learningPaths.length).toBeGreaterThan(0)

    const progress = computePathProgress(path, { completions: {}, checkpointCompletions: {} })
    expect(progress.totalRequired).toBeGreaterThan(0)

    const checkpoints = path.modules.flatMap((m) => m.items.filter((i) => i.kind === 'checkpoint'))
    expect(checkpoints.length).toBeGreaterThan(0)
  })

  it('every resource item resolves to a real resource', () => {
    // Enforced by content rule 3, asserted here because the UI would otherwise
    // render "no longer in the catalogue" rows.
    renderPath()
    expect(screen.queryByText(/no longer in the catalogue/i)).not.toBeInTheDocument()
  })
})

describe('path detail', () => {
  it('renders the title and outcome', () => {
    renderPath()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(path.title)
    expect(screen.getByText(path.outcome_statement)).toBeVisible()
  })

  it('404s an unknown path id', () => {
    renderPath('not-a-real-path')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/page not found/i)
  })

  it('shows what the path assumes, framed as prerequisites', () => {
    renderPath()
    expect(screen.getByRole('heading', { name: /what this assumes/i })).toBeVisible()
    expect(screen.getByText(path.prerequisites.description)).toBeVisible()
  })

  it('renders the time as a RANGE, never a single number', () => {
    renderPath()
    const { min, max } = path.estimated_hours

    expect(screen.getByText(new RegExp(`${min}–${max}`))).toBeVisible()
  })

  it('shows the assumptions behind the estimate alongside it', () => {
    // A number without its assumptions is a schedule, which this is not.
    renderPath()
    expect(screen.getByText(path.estimate_assumptions)).toBeVisible()
  })

  it('states the completion criteria', () => {
    renderPath()
    expect(screen.getByText(path.completion_criteria)).toBeVisible()
  })

  it('marks each item as required or optional', () => {
    renderPath()
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Optional').length).toBeGreaterThan(0)
  })

  it('shows the note explaining why an item sits where it does', () => {
    const withNote = path.modules.flatMap((m) => m.items).find((i) => i.note !== null)
    expect(withNote).toBeDefined()

    renderPath()
    expect(screen.getByText(withNote!.note!)).toBeVisible()
  })

  it('renders a checkpoint with its prompt and self-assessment', () => {
    const checkpoint = path.modules.flatMap((m) => m.items).find((i) => i.kind === 'checkpoint')
    expect(checkpoint).toBeDefined()

    renderPath()
    expect(screen.getByText(checkpoint!.checkpoint!.prompt)).toBeVisible()
    expect(screen.getByText(checkpoint!.checkpoint!.how_to_self_assess)).toBeVisible()
  })

  it('says there is no follow-on path rather than inventing one', () => {
    renderPath()
    expect(screen.getByText(/no follow-on path exists yet/i)).toBeVisible()
  })

  it('warns that the path has not been reviewed', () => {
    renderPath()
    expect(screen.getByText(/not reviewed by a second person/i)).toBeVisible()
  })
})

describe('progress', () => {
  it('starts at 0% with a real denominator, not "Not started"', () => {
    // This path HAS required items, so 0% is an accurate statement.
    renderPath()
    const bar = screen.getByRole('progressbar')

    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('advances when a required item is ticked', async () => {
    const user = userEvent.setup()
    renderPath()

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0]!)

    await waitFor(() => {
      expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(
        0,
      )
    })
  })

  it('does NOT advance when an optional item is ticked', async () => {
    // The acceptance criterion for this phase.
    const user = userEvent.setup()
    renderPath()

    const before = screen.getByRole('progressbar').getAttribute('aria-valuenow')

    const optionalLabel = screen.getAllByText('Optional')[0]!.closest('li')!
    const optionalCheckbox = within(optionalLabel).getByRole('checkbox')
    await user.click(optionalCheckbox)

    await waitFor(() => expect(optionalCheckbox).toBeChecked())
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(before)
  })

  it('counts optional completions separately', async () => {
    const user = userEvent.setup()
    renderPath()

    const optionalItem = screen.getAllByText('Optional')[0]!.closest('li')!
    await user.click(within(optionalItem).getByRole('checkbox'))

    await waitFor(() => expect(screen.getByText(/\+1 of \d+ optional/)).toBeVisible())
  })

  it('reaches 100% only when every required item is done, and says so', async () => {
    completeAllRequired()
    renderPath()

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText(/every required item is complete/i)).toBeVisible()
  })

  it('is completable end to end through the UI alone', async () => {
    // The definition of done for this phase: a learner can finish the path in
    // the browser without anything being set behind their back.
    const user = userEvent.setup()
    renderPath()

    const requiredItems = screen.getAllByText('Required').map((badge) => badge.closest('li')!)

    for (const item of requiredItems) {
      await user.click(within(item).getByRole('checkbox'))
    }

    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'),
    )
  })

  it('publishes the rule it used, on the page', () => {
    renderPath()
    expect(screen.getByText(/floor\(completedRequired \/ totalRequired/)).toBeInTheDocument()
    expect(screen.getByText(/completing an optional one never moves the bar/i)).toBeInTheDocument()
  })

  it('never infers completion from merely rendering the page', () => {
    renderPath()
    expect(Object.keys(useUserStore.getState().completions)).toHaveLength(0)
    expect(Object.keys(useUserStore.getState().checkpointCompletions)).toHaveLength(0)
  })
})

describe('checkpoints are separate from resource completions', () => {
  it('ticking a checkpoint does not mark any resource done', async () => {
    const user = userEvent.setup()
    renderPath()

    const checkpointItem = screen.getAllByText('Checkpoint')[0]!.closest('li')!
    await user.click(within(checkpointItem).getByRole('checkbox'))

    await waitFor(() =>
      expect(Object.keys(useUserStore.getState().checkpointCompletions)).toHaveLength(1),
    )
    expect(Object.keys(useUserStore.getState().completions)).toHaveLength(0)
  })
})

describe('path index', () => {
  it('lists the path with its outcome and time range', () => {
    renderIndex()

    expect(screen.getByRole('link', { name: path.title })).toBeVisible()
    expect(screen.getByText(path.outcome_statement)).toBeVisible()
    expect(
      screen.getByText(new RegExp(`${path.estimated_hours.min}–${path.estimated_hours.max} hours`)),
    ).toBeVisible()
  })

  it('shows no progress bar for an untouched path', () => {
    // A 0% bar for something never opened is the same misleading zero the
    // dashboard avoids.
    renderIndex()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows a progress bar once the path is started', () => {
    completeAllRequired()
    renderIndex()

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('is honest that the other planned paths do not exist yet', () => {
    renderIndex()
    expect(screen.getByText(/only one path is written so far/i)).toBeVisible()
  })
})

describe('accessibility', () => {
  it('has no blocking violations on the path index', async () => {
    const { container } = renderIndex()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on a path detail page', async () => {
    const { container } = renderPath()
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations with the path complete', async () => {
    completeAllRequired()
    const { container } = renderPath()
    await expectNoA11yViolations(container)
  })

  it('labels the progress bar with what it measures', () => {
    renderPath()
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(
      new RegExp(`${path.title}.*required items complete`, 'i'),
    )
  })

  it('gives every item checkbox a name identifying the item', () => {
    renderPath()
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toHaveAccessibleName(/mark .+ as (not )?done/i)
    }
  })
})
