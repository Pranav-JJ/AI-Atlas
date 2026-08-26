interface SkeletonProps {
  /** Tailwind sizing classes. Should match the real content's dimensions. */
  className?: string
  /** Describes what is loading, for screen readers. Set on ONE skeleton only. */
  label?: string
}

/**
 * A loading placeholder.
 *
 * Sized by the caller to match the real content, because a skeleton of the wrong
 * height causes exactly the layout shift it exists to prevent.
 *
 * The shimmer is a CSS animation, which global.css disables wholesale under
 * prefers-reduced-motion.
 */
export function Skeleton({ className = '', label }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-subtle animate-pulse rounded ${className}`}
      role={label ? 'status' : undefined}
      aria-live={label ? 'polite' : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  )
}
