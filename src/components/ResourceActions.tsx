import { useUserStore } from '@/lib/storage/store.ts'

interface ResourceActionsProps {
  resourceId: string
  /** `compact` sits on a card; `full` sits on the detail page. */
  variant?: 'compact' | 'full'
  /** Accessible context, so a screen reader hears WHICH resource is affected. */
  title: string
}

const BOOKMARK_PATH = 'M6 3h12v18l-6-4.5L6 21z'
const CHECK_PATH = 'M4.5 12.5 10 18l9.5-11'

/**
 * Bookmark and completion toggles.
 *
 * Both write only to the browser, and both are explicit: completion is never
 * inferred from opening a link or scrolling. That is the rule the progress
 * calculation depends on, so it is enforced here at the only place completion
 * can be set.
 */
export function ResourceActions({ resourceId, variant = 'compact', title }: ResourceActionsProps) {
  // Subscribed individually so a change to one resource does not re-render
  // every card on the page.
  const bookmarked = useUserStore((s) => s.bookmarks[resourceId] !== undefined)
  const completed = useUserStore((s) => s.completions[resourceId] !== undefined)
  const toggleBookmark = useUserStore((s) => s.toggleBookmark)
  const toggleCompletion = useUserStore((s) => s.toggleCompletion)

  const compact = variant === 'compact'

  const buttonClass = (active: boolean, activeClasses: string) =>
    [
      'inline-flex items-center gap-1.5 rounded border transition-colors',
      compact ? 'p-1.5' : 'px-3 py-1.5 text-sm',
      active
        ? activeClasses
        : 'border-border text-fg-subtle hover:border-border-strong hover:text-fg-muted',
    ].join(' ')

  return (
    // z-10 lifts these above the card's stretched link, which would otherwise
    // swallow the clicks.
    <div className="relative z-10 flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggleBookmark(resourceId)}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? `Remove bookmark from ${title}` : `Bookmark ${title}`}
        className={buttonClass(bookmarked, 'border-accent bg-accent-subtle text-accent')}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={bookmarked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d={BOOKMARK_PATH} />
        </svg>
        {!compact ? <span>{bookmarked ? 'Saved' : 'Save'}</span> : null}
      </button>

      <button
        type="button"
        onClick={() => toggleCompletion(resourceId)}
        aria-pressed={completed}
        aria-label={completed ? `Mark ${title} as not done` : `Mark ${title} as done`}
        className={buttonClass(completed, 'border-ok bg-ok-subtle text-ok')}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={CHECK_PATH} />
        </svg>
        {!compact ? <span>{completed ? 'Done' : 'Mark done'}</span> : null}
      </button>
    </div>
  )
}
