import { useId } from 'react'
import { Link, useNavigate } from 'react-router'

import { Callout } from '@/components/index.ts'
import { useDocumentMeta } from '@/hooks/useDocumentMeta.ts'
import { DIFFICULTIES, type Difficulty } from '@/lib/schema/index.ts'
import { GOAL_DESCRIPTIONS, GOAL_LABELS, GOALS, type Goal } from '@/lib/storage/schema.ts'
import { useUserStore } from '@/lib/storage/store.ts'

const LEVEL_DESCRIPTIONS: Record<Difficulty, string> = {
  beginner: 'New to this. Comfortable learning the programming and maths alongside the concepts.',
  intermediate:
    'Can write code and have met the basics. Looking to go deeper or move into a new area.',
  advanced: 'Working in the field already. After depth, primary sources and production concerns.',
}

const WEEKLY_TARGETS: Array<[label: string, minutes: number | null]> = [
  ['No target', null],
  ['1 hour a week', 60],
  ['3 hours a week', 180],
  ['5 hours a week', 300],
  ['10 hours a week', 600],
]

/**
 * Tell the atlas where you are starting.
 *
 * Every answer is optional and changeable, and none of it is required to use the
 * site — the library and topic map work perfectly well without a profile. This
 * exists to make recommendations better, not to gate anything.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const levelName = useId()
  const goalName = useId()
  const targetName = useId()

  const profile = useUserStore((s) => s.profile)
  const setLevel = useUserStore((s) => s.setLevel)
  const setGoal = useUserStore((s) => s.setGoal)
  const setWeeklyTarget = useUserStore((s) => s.setWeeklyTarget)
  const storageAvailable = useUserStore((s) => s.storageAvailable)

  useDocumentMeta(
    'Set your starting point',
    'Tell AI Atlas your level and goal so it can recommend a sensible order. Stored only in your browser.',
  )

  return (
    <div className="max-w-[var(--measure)]">
      <h1 className="text-fg text-3xl font-semibold tracking-tight">Where are you starting?</h1>

      <p className="text-fg-muted mt-4 leading-relaxed">
        Two questions, both optional and both changeable later. They tune what gets recommended and
        how resources are ordered — nothing on this site is locked behind them.
      </p>

      {!storageAvailable ? (
        <Callout tone="warn" className="mt-6" title="Your browser is not saving site data">
          Your answers will apply for this visit but will be forgotten when you close the tab. This
          usually means a private window, or a setting that blocks site data.
        </Callout>
      ) : null}

      <fieldset className="mt-10">
        <legend className="text-fg text-lg font-semibold tracking-tight">
          How would you describe your level?
        </legend>

        <div className="mt-4 space-y-2">
          {DIFFICULTIES.map((level) => (
            <label
              key={level}
              className="border-border bg-surface hover:border-border-strong flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors"
            >
              <input
                type="radio"
                name={levelName}
                checked={profile.level === level}
                onChange={() => setLevel(level)}
                className="accent-accent mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-fg block text-sm font-medium capitalize">{level}</span>
                <span className="text-fg-muted mt-1 block text-sm leading-relaxed">
                  {LEVEL_DESCRIPTIONS[level]}
                </span>
              </span>
            </label>
          ))}
        </div>

        {profile.level !== null ? (
          <button
            type="button"
            onClick={() => setLevel(null)}
            className="text-accent mt-3 text-sm underline underline-offset-2"
          >
            Clear this answer
          </button>
        ) : null}
      </fieldset>

      <fieldset className="mt-10">
        <legend className="text-fg text-lg font-semibold tracking-tight">
          What are you trying to do?
        </legend>

        <div className="mt-4 space-y-2">
          {GOALS.map((goal: Goal) => (
            <label
              key={goal}
              className="border-border bg-surface hover:border-border-strong flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors"
            >
              <input
                type="radio"
                name={goalName}
                checked={profile.goal === goal}
                onChange={() => setGoal(goal)}
                className="accent-accent mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-fg block text-sm font-medium">{GOAL_LABELS[goal]}</span>
                <span className="text-fg-muted mt-1 block text-sm leading-relaxed">
                  {GOAL_DESCRIPTIONS[goal]}
                </span>
              </span>
            </label>
          ))}
        </div>

        {profile.goal !== null ? (
          <button
            type="button"
            onClick={() => setGoal(null)}
            className="text-accent mt-3 text-sm underline underline-offset-2"
          >
            Clear this answer
          </button>
        ) : null}
      </fieldset>

      <fieldset className="mt-10">
        <legend className="text-fg text-lg font-semibold tracking-tight">
          A weekly target, if you want one
        </legend>
        <p className="text-fg-muted mt-2 text-sm leading-relaxed">
          Used only to show your own progress back to you. Nothing is sent anywhere, and nothing
          nags you.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {WEEKLY_TARGETS.map(([label, minutes]) => (
            <label
              key={label}
              className="border-border bg-surface hover:border-border-strong flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
            >
              <input
                type="radio"
                name={targetName}
                checked={profile.weeklyTargetMinutes === minutes}
                onChange={() => setWeeklyTarget(minutes)}
                className="accent-accent h-4 w-4"
              />
              <span className="text-fg-muted">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void navigate('/library')}
          className="bg-accent text-accent-fg hover:bg-accent-hover rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          Browse the library
        </button>
        <Link to="/" className="text-fg-muted text-sm underline underline-offset-2">
          Back to the home page
        </Link>
      </div>

      <p className="text-fg-subtle mt-8 text-xs leading-relaxed">
        Saved in this browser only, never transmitted. You can change or delete it at any time from{' '}
        <Link to="/progress" className="underline underline-offset-2">
          your progress page
        </Link>
        .
      </p>
    </div>
  )
}
