import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { resources } from '@/content/generated/index.ts'
import type { SafeStorage } from '@/lib/storage/safeStorage.ts'
import { __resetStoreForTests, useUserStore } from '@/lib/storage/store.ts'

import { Onboarding } from './Onboarding.tsx'
import { Progress } from './Progress.tsx'

function memoryStorage(availability: 'available' | 'unavailable' = 'available'): SafeStorage {
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
    availability,
  }
}

function renderPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

/** A real resource id, so tests exercise the resolved path. */
const realId = resources[0]!.id
const realTitle = resources[0]!.title

beforeEach(() => {
  __resetStoreForTests(memoryStorage())
})

describe('empty progress', () => {
  it('explains what saving does rather than only saying it is empty', () => {
    renderPage(<Progress />)
    expect(screen.getByText(/saving a resource keeps it here/i)).toBeVisible()
  })

  it('states that completion is only ever set explicitly', () => {
    // This is the rule the whole progress calculation rests on.
    renderPage(<Progress />)
    expect(screen.getByText(/never inferred from opening a link or scrolling/i)).toBeVisible()
  })

  it('shows zero counts rather than hiding the summary', () => {
    renderPage(<Progress />)
    const summary = screen.getByRole('heading', { name: 'Summary' }).parentElement!

    expect(within(summary).getAllByText('0').length).toBeGreaterThan(0)
  })
})

describe('saved and completed items', () => {
  it('lists a bookmarked resource by title', () => {
    useUserStore.getState().toggleBookmark(realId)
    renderPage(<Progress />)

    expect(screen.getByRole('link', { name: realTitle })).toBeVisible()
  })

  it('lists a completed resource', () => {
    useUserStore.getState().toggleCompletion(realId)
    renderPage(<Progress />)

    const done = screen.getByRole('heading', { name: 'Marked done' }).parentElement!
    expect(within(done).getByRole('link', { name: realTitle })).toBeVisible()
  })

  it('keeps a record whose resource has left the catalogue, and says so', () => {
    // Silently dropping it would be a quiet edit of the user's own record.
    useUserStore.getState().toggleBookmark('res-that-no-longer-exists')
    renderPage(<Progress />)

    expect(screen.getByText('res-that-no-longer-exists')).toBeVisible()
    expect(screen.getByText(/removed from the catalogue since you saved it/i)).toBeVisible()
  })

  it('can un-save from the progress page itself', async () => {
    const user = userEvent.setup()
    useUserStore.getState().toggleBookmark(realId)
    renderPage(<Progress />)

    await user.click(screen.getByRole('button', { name: new RegExp(`remove bookmark`, 'i') }))

    await waitFor(() => expect(useUserStore.getState().isBookmarked(realId)).toBe(false))
  })
})

describe('weekly target', () => {
  it('is hidden entirely when no target is set', () => {
    renderPage(<Progress />)
    expect(screen.queryByRole('heading', { name: 'This week' })).not.toBeInTheDocument()
  })

  it('reports minutes against the target', () => {
    useUserStore.getState().setWeeklyTarget(180)
    useUserStore.getState().toggleCompletion(realId)
    renderPage(<Progress />)

    expect(screen.getByRole('heading', { name: 'This week' })).toBeVisible()
    expect(screen.getByText(/of 180 minutes/i)).toBeVisible()
  })

  it('says plainly that it counts only recorded lengths, and that they are estimates', () => {
    useUserStore.getState().setWeeklyTarget(180)
    renderPage(<Progress />)

    expect(screen.getByText(/counts only resources that have a recorded length/i)).toBeVisible()
    expect(screen.getByText(/those lengths are estimates/i)).toBeVisible()
  })

  it('reports how many completions it could not count', () => {
    const withoutDuration = resources.find((r) => r.estimated_duration_minutes === null)
    expect(withoutDuration).toBeDefined()

    useUserStore.getState().setWeeklyTarget(180)
    useUserStore.getState().toggleCompletion(withoutDuration!.id)
    renderPage(<Progress />)

    expect(screen.getByText(/no recorded length/i)).toBeVisible()
  })
})

describe('export and reset', () => {
  it('requires an explicit confirmation before deleting', async () => {
    const user = userEvent.setup()
    useUserStore.getState().toggleBookmark(realId)
    renderPage(<Progress />)

    await user.click(screen.getByRole('button', { name: /delete all my data/i }))

    // Still nothing deleted: the first click only reveals the confirmation.
    expect(useUserStore.getState().isBookmarked(realId)).toBe(true)
    expect(screen.getByRole('button', { name: /yes, delete everything/i })).toBeVisible()
  })

  it('deletes only after the confirmation is taken', async () => {
    const user = userEvent.setup()
    useUserStore.getState().toggleBookmark(realId)
    renderPage(<Progress />)

    await user.click(screen.getByRole('button', { name: /delete all my data/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete everything/i }))

    await waitFor(() => expect(useUserStore.getState().isBookmarked(realId)).toBe(false))
  })

  it('can be backed out of', async () => {
    const user = userEvent.setup()
    useUserStore.getState().toggleBookmark(realId)
    renderPage(<Progress />)

    await user.click(screen.getByRole('button', { name: /delete all my data/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(useUserStore.getState().isBookmarked(realId)).toBe(true)
    expect(
      screen.queryByRole('button', { name: /yes, delete everything/i }),
    ).not.toBeInTheDocument()
  })

  it('offers an export and explains it is the only backup', () => {
    renderPage(<Progress />)

    expect(screen.getByRole('button', { name: /export as json/i })).toBeVisible()
    expect(screen.getByText(/exporting is the only backup/i)).toBeVisible()
  })
})

describe('storage that is not working', () => {
  it('says nothing is being saved, and still functions', async () => {
    __resetStoreForTests(memoryStorage('unavailable'))
    const user = userEvent.setup()
    renderPage(<Progress />)

    expect(screen.getByText(/nothing is being saved/i)).toBeVisible()

    // The page still works for this session.
    await user.click(screen.getByRole('button', { name: /delete all my data/i }))
    expect(screen.getByRole('button', { name: /yes, delete everything/i })).toBeVisible()
  })

  it('shows no such notice when storage works', () => {
    renderPage(<Progress />)
    expect(screen.queryByText(/nothing is being saved/i)).not.toBeInTheDocument()
  })
})

describe('onboarding', () => {
  it('records a level and a goal', async () => {
    const user = userEvent.setup()
    renderPage(<Onboarding />)

    await user.click(screen.getByRole('radio', { name: /beginner/i }))
    await user.click(screen.getByRole('radio', { name: /start from scratch/i }))

    await waitFor(() => {
      expect(useUserStore.getState().profile.level).toBe('beginner')
      expect(useUserStore.getState().profile.goal).toBe('start-from-scratch')
    })
  })

  it('lets an answer be cleared again', async () => {
    const user = userEvent.setup()
    useUserStore.getState().setLevel('beginner')
    renderPage(<Onboarding />)

    await user.click(screen.getAllByRole('button', { name: /clear this answer/i })[0]!)

    await waitFor(() => expect(useUserStore.getState().profile.level).toBeNull())
  })

  it('sets a weekly target', async () => {
    const user = userEvent.setup()
    renderPage(<Onboarding />)

    await user.click(screen.getByRole('radio', { name: /3 hours a week/i }))

    await waitFor(() => expect(useUserStore.getState().profile.weeklyTargetMinutes).toBe(180))
  })

  it('says the answers are optional and change nothing about access', () => {
    renderPage(<Onboarding />)
    expect(screen.getByText(/nothing on this site is locked behind them/i)).toBeVisible()
  })

  it('warns when the browser will not remember the answers', () => {
    __resetStoreForTests(memoryStorage('unavailable'))
    renderPage(<Onboarding />)

    expect(screen.getByText(/not saving site data/i)).toBeVisible()
  })
})

describe('accessibility', () => {
  it('has no blocking violations on an empty progress page', async () => {
    const { container } = renderPage(<Progress />)
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations with data present', async () => {
    useUserStore.getState().toggleBookmark(realId)
    useUserStore.getState().toggleCompletion(realId)
    useUserStore.getState().setWeeklyTarget(180)

    const { container } = renderPage(<Progress />)
    await expectNoA11yViolations(container)
  })

  it('has no blocking violations on onboarding', async () => {
    const { container } = renderPage(<Onboarding />)
    await expectNoA11yViolations(container)
  })

  it('groups onboarding questions under named fieldsets', () => {
    renderPage(<Onboarding />)

    expect(screen.getByRole('group', { name: /how would you describe your level/i })).toBeVisible()
    expect(screen.getByRole('group', { name: /what are you trying to do/i })).toBeVisible()
  })
})
