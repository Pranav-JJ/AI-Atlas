import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Changing this resets the boundary — used to clear the error on navigation. */
  resetKey?: string
}

interface State {
  error: Error | null
  previousResetKey: string | undefined
}

/**
 * Route-level error boundary.
 *
 * A crash must never produce a blank page: the user cannot tell that from a slow
 * load, a broken deployment, or their own connection. This says what failed,
 * what still works, and offers a way out.
 *
 * Still a class component because React provides no hook equivalent of
 * componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, previousResetKey: undefined }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  /** Clears a previous error when the route changes, so navigation recovers. */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.previousResetKey !== props.resetKey) {
      return { error: null, previousResetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No error-reporting service: this is a static site with no backend and no
    // analytics, so the console is the only place a report can go.
    console.error('Unhandled error in route:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-[var(--measure)] px-6 py-16">
        <h1 className="text-fg text-2xl font-semibold tracking-tight">This page failed to load</h1>

        <p className="text-fg-muted mt-4 leading-relaxed">
          Something went wrong while rendering this page. The rest of the site is unaffected — the
          navigation above still works.
        </p>

        <p className="text-fg-subtle mt-4 text-sm">
          If it keeps happening, please report it with the message below.
        </p>

        <pre className="border-border bg-surface-subtle text-fg-muted mt-4 overflow-x-auto rounded border p-3 font-mono text-xs">
          {error.message}
        </pre>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-accent text-accent-fg hover:bg-accent-hover mt-6 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          Reload the page
        </button>
      </div>
    )
  }
}
