import { useEffect, useId, useRef, useState } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  /** Milliseconds to wait after typing stops before committing to the URL. */
  debounceMs?: number
}

/**
 * The library's text search.
 *
 * Typing updates local state immediately so the field never lags, but the
 * committed value is debounced — every keystroke otherwise pushes a history
 * entry, which would make the back button useless.
 */
export function SearchInput({ value, onChange, debounceMs = 250 }: SearchInputProps) {
  const inputId = useId()
  const [draft, setDraft] = useState(value)
  const committed = useRef(value)

  // Accept changes that come from outside (back button, a cleared filter),
  // without clobbering what the user is mid-way through typing.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setDraft(value)
    }
  }, [value])

  useEffect(() => {
    if (draft === committed.current) return

    const timer = setTimeout(() => {
      committed.current = draft
      onChange(draft)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [draft, debounceMs, onChange])

  return (
    <div className="relative">
      <label htmlFor={inputId} className="text-fg mb-1.5 block text-sm font-medium">
        Search resources
      </label>

      <input
        id={inputId}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Try “tokenization”, “transformers”, “MLOps”"
        // border-interactive, not border: this boundary identifies a control and
        // so has to clear 3:1. See src/lib/contrast.test.ts.
        className="border-border-interactive bg-surface text-fg placeholder:text-fg-subtle w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  )
}
