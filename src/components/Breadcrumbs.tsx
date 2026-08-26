import { Link } from 'react-router'

export interface Crumb {
  label: string
  /** Omit for the current page, which is text rather than a link. */
  to?: string
}

/**
 * Trail of ancestors. The final crumb is the current page and is deliberately
 * not a link — a link to where you already are is noise for everyone and a
 * genuine confusion for screen reader users.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="text-fg-subtle text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-fg underline-offset-2 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'text-fg-muted' : ''}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-fg-subtle/60">
                  /
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
