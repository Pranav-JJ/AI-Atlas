import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { expectNoA11yViolations } from '@tests/a11y.ts'
import { THEME_STORAGE_KEY } from '@/lib/theme.ts'

import {
  Badge,
  Breadcrumbs,
  Callout,
  Chip,
  EmptyState,
  ErrorBoundary,
  ExternalLink,
  Skeleton,
  ThemeToggle,
  VerificationChip,
} from './index.ts'

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('Badge', () => {
  it('renders its label as text, so meaning survives greyscale and screen readers', () => {
    render(<Badge tone="ok">free</Badge>)
    expect(screen.getByText('free')).toBeVisible()
  })

  it('prefers the screen-reader label when one is given', () => {
    render(<Badge srLabel="free to access">free</Badge>)
    expect(screen.getByText('free to access')).toBeInTheDocument()
    // The visible text is hidden from assistive tech so it is not read twice.
    expect(screen.getByText('free')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('VerificationChip', () => {
  it('says plainly that an unverified record has not been checked', () => {
    render(<VerificationChip status="unverified" />)

    expect(screen.getByText('Unverified')).toBeVisible()
    expect(screen.getByText(/nobody has opened this link/i)).toBeInTheDocument()
  })

  it('shows the verification date for a verified record', () => {
    render(<VerificationChip status="verified" lastVerifiedAt="2026-08-01" />)

    expect(screen.getByText('Verified')).toBeVisible()
    expect(screen.getByText('2026-08-01')).toBeVisible()
  })

  it('shows the date for a stale record, since that is what makes it stale', () => {
    render(<VerificationChip status="stale" lastVerifiedAt="2025-01-01" />)
    expect(screen.getByText('2025-01-01')).toBeVisible()
  })

  it('does NOT show a date for unverified, where there is no verification to date', () => {
    render(<VerificationChip status="unverified" lastVerifiedAt="2026-08-01" />)
    expect(screen.queryByText('2026-08-01')).not.toBeInTheDocument()
  })

  it('labels a broken link as disabled rather than merely flagged', () => {
    render(<VerificationChip status="broken" />)
    expect(screen.getByText(/reported dead, so it has been disabled/i)).toBeInTheDocument()
  })

  it.each(['verified', 'unverified', 'stale', 'broken', 'deprecated'] as const)(
    'renders a label for status %s',
    (status) => {
      const { container } = render(<VerificationChip status={status} />)
      expect(container.textContent?.trim().length).toBeGreaterThan(0)
    },
  )
})

describe('ExternalLink', () => {
  it('always sets rel="noopener noreferrer" against tabnabbing', () => {
    render(<ExternalLink href="https://example.com">Example</ExternalLink>)
    const link = screen.getByRole('link')

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('announces that it opens in a new tab', () => {
    // Sighted users get this from the icon; nobody else would get it at all.
    render(<ExternalLink href="https://example.com">Example</ExternalLink>)
    expect(screen.getByRole('link')).toHaveAccessibleName(/opens in a new tab/i)
  })
})

describe('Breadcrumbs', () => {
  const items = [
    { label: 'Topics', to: '/topics' },
    { label: 'NLP', to: '/topics/nlp' },
    { label: 'Tokenization' },
  ]

  it('marks the last crumb as the current page and does not link it', () => {
    renderWithRouter(<Breadcrumbs items={items} />)

    const current = screen.getByText('Tokenization')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Tokenization' })).not.toBeInTheDocument()
  })

  it('links the ancestors', () => {
    renderWithRouter(<Breadcrumbs items={items} />)
    expect(screen.getByRole('link', { name: 'Topics' })).toHaveAttribute('href', '/topics')
  })

  it('renders nothing at all when there are no crumbs', () => {
    const { container } = renderWithRouter(<Breadcrumbs items={[]} />)
    expect(container.querySelector('nav')).toBeNull()
  })
})

describe('EmptyState', () => {
  it('explains the cause rather than only saying it is empty', () => {
    render(
      <EmptyState
        title="No resources tagged with this topic yet"
        description="The catalogue is curated and still growing."
      />,
    )

    expect(screen.getByRole('heading', { level: 3 })).toBeVisible()
    expect(screen.getByText(/curated and still growing/i)).toBeVisible()
  })
})

describe('Skeleton', () => {
  it('is hidden from assistive tech unless it carries a label', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('announces politely when labelled', () => {
    render(<Skeleton label="Loading search index" />)
    const status = screen.getByRole('status')

    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Loading search index')
  })
})

describe('Callout', () => {
  it('uses role="note", not alert — it is present on load and is not urgent', () => {
    render(
      <Callout tone="warn" title="Check the licence">
        Body
      </Callout>,
    )
    const note = screen.getByRole('note')

    expect(note).toHaveAccessibleName('Check the licence')
  })
})

describe('Chip', () => {
  it('is a real link when navigable, so it can be focused and opened in a new tab', () => {
    renderWithRouter(<Chip to="/topics/nlp">NLP</Chip>)
    expect(screen.getByRole('link', { name: 'NLP' })).toHaveAttribute('href', '/topics/nlp')
  })

  it('is inert text when not navigable', () => {
    renderWithRouter(<Chip>NLP</Chip>)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('ThemeToggle', () => {
  it('exposes the three states as a radiogroup', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('radiogroup', { name: /colour theme/i })).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('starts on system with nothing stored', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('radio', { name: /system/i })).toBeChecked()
  })

  it('applies the chosen theme to the document', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: /dark/i }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists the choice across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: /dark/i }))
    unmount()

    render(<ThemeToggle />)
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('removes the attribute when returning to system', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: /dark/i }))
    await user.click(screen.getByRole('radio', { name: /system/i }))

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('still switches theme when storage is blocked', async () => {
    // Private windows throw on write. The preference will not persist, but the
    // toggle must still work for the current session.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: /dark/i }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    vi.restoreAllMocks()
  })

  it('has no blocking accessibility violations', async () => {
    const { container } = render(<ThemeToggle />)
    await expectNoA11yViolations(container)
  })
})

describe('ErrorBoundary', () => {
  function Boom(): ReactElement {
    throw new Error('deliberate test failure')
  }

  it('renders a useful message instead of a blank page', () => {
    // React logs the caught error; silence it so the output stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/failed to load/i)
    expect(screen.getByText('deliberate test failure')).toBeVisible()
    expect(screen.getByRole('button', { name: /reload/i })).toBeVisible()

    spy.mockRestore()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All fine</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All fine')).toBeVisible()
  })

  it('clears the error when the reset key changes, so navigation recovers', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary resetKey="/broken">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/failed to load/i)

    rerender(
      <ErrorBoundary resetKey="/other">
        <p>Recovered</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Recovered')).toBeVisible()

    spy.mockRestore()
  })
})
