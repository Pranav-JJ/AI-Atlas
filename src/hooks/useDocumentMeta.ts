import { useEffect } from 'react'

const SITE_NAME = 'AI Atlas'

/**
 * Sets the document title and meta description for a route.
 *
 * This is a client-rendered SPA, so per-page metadata is applied at runtime.
 * Search crawlers execute JavaScript and will see it; a plain HTTP client will
 * not. That trade-off was made deliberately when choosing the architecture, and
 * Phase 13 revisits pre-rendering if measurement shows it matters.
 */
export function useDocumentMeta(title: string, description?: string): void {
  useEffect(() => {
    // The home page is already the site name; repeating it reads badly in tabs.
    document.title = title === SITE_NAME ? SITE_NAME : `${title} — ${SITE_NAME}`

    if (description === undefined) return

    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')

    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.appendChild(tag)
    }

    tag.content = description
  }, [title, description])
}
