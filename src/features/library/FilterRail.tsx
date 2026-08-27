import { useId } from 'react'

import { COST_LABELS, humanizeId, RESOURCE_TYPE_LABELS } from '@/lib/format.ts'
import type { FilterCriteria } from '@/lib/selectors/filterResources.ts'
import type { Provider, Topic } from '@/lib/schema/index.ts'
import {
  COST_TYPES,
  DIFFICULTIES,
  RESOURCE_TYPES,
  STATUSES,
  THEORY_VS_PRACTICE,
} from '@/lib/schema/index.ts'

export interface FilterOptions {
  topics: readonly Topic[]
  providers: readonly Provider[]
  languages: readonly string[]
  /** Facet value -> how many resources currently carry it. */
  counts: {
    topics: ReadonlyMap<string, number>
    types: ReadonlyMap<string, number>
  }
}

interface FilterRailProps {
  criteria: FilterCriteria
  options: FilterOptions
  onChange: (next: Partial<FilterCriteria>) => void
  onClear: () => void
  activeCount: number
}

/** A labelled group of checkboxes for one facet. */
function CheckboxGroup<T extends string>({
  legend,
  values,
  selected,
  onToggle,
  labelFor,
  countFor,
}: {
  legend: string
  values: readonly T[]
  selected: readonly T[]
  onToggle: (value: T) => void
  labelFor?: (value: T) => string
  countFor?: (value: T) => number | undefined
}) {
  return (
    <fieldset className="border-border border-t pt-4">
      <legend className="text-fg pr-2 text-sm font-medium">{legend}</legend>
      <div className="mt-2 space-y-1.5">
        {values.map((value) => {
          const count = countFor?.(value)

          return (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
                className="accent-accent h-4 w-4 shrink-0"
              />
              <span className="text-fg-muted">
                {labelFor ? labelFor(value) : humanizeId(value)}
              </span>
              {count !== undefined ? (
                <span className="text-fg-subtle ml-auto text-xs tabular-nums">{count}</span>
              ) : null}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** A three-state control: no preference / yes / no. */
function TriStateGroup({
  legend,
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  legend: string
  value: boolean | null
  onChange: (next: boolean | null) => void
  yesLabel: string
  noLabel: string
}) {
  const name = useId()

  const options: Array<[string, boolean | null]> = [
    ['Any', null],
    [yesLabel, true],
    [noLabel, false],
  ]

  return (
    <fieldset className="border-border border-t pt-4">
      <legend className="text-fg pr-2 text-sm font-medium">{legend}</legend>
      <div className="mt-2 space-y-1.5">
        {options.map(([label, optionValue]) => (
          <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
              className="accent-accent h-4 w-4 shrink-0"
            />
            <span className="text-fg-muted">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const DURATION_LIMITS: Array<[label: string, minutes: number | null]> = [
  ['Any length', null],
  ['Under 30 min', 30],
  ['Under 1 hour', 60],
  ['Under 3 hours', 180],
  ['Under 10 hours', 600],
]

export function FilterRail({ criteria, options, onChange, onClear, activeCount }: FilterRailProps) {
  const durationName = useId()

  /** Adds or removes one value from a multi-select facet. */
  function toggle<K extends keyof FilterCriteria>(key: K, value: string) {
    const current = criteria[key] as string[]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]

    onChange({ [key]: next } as Partial<FilterCriteria>)
  }

  // Only offer topics that something is actually tagged with — a filter that
  // can only ever return nothing is noise.
  const topicsWithResources = options.topics.filter(
    (topic) => (options.counts.topics.get(topic.id) ?? 0) > 0,
  )
  const typesWithResources = RESOURCE_TYPES.filter(
    (type) => (options.counts.types.get(type) ?? 0) > 0,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-fg text-sm font-semibold">
          Filters
          {activeCount > 0 ? (
            <span className="text-fg-subtle ml-1.5 font-normal">({activeCount} active)</span>
          ) : null}
        </h2>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="text-accent text-sm underline underline-offset-2"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <CheckboxGroup
        legend="Topic"
        values={topicsWithResources.map((t) => t.id)}
        selected={criteria.topics}
        onToggle={(value) => toggle('topics', value)}
        labelFor={(id) => topicsWithResources.find((t) => t.id === id)?.name ?? humanizeId(id)}
        countFor={(id) => options.counts.topics.get(id)}
      />

      <CheckboxGroup
        legend="Type"
        values={typesWithResources}
        selected={criteria.types}
        onToggle={(value) => toggle('types', value)}
        labelFor={(type) => RESOURCE_TYPE_LABELS[type]}
        countFor={(type) => options.counts.types.get(type)}
      />

      <CheckboxGroup
        legend="Difficulty"
        values={DIFFICULTIES}
        selected={criteria.difficulties}
        onToggle={(value) => toggle('difficulties', value)}
      />

      <CheckboxGroup
        legend="Cost"
        values={COST_TYPES}
        selected={criteria.costs}
        onToggle={(value) => toggle('costs', value)}
        labelFor={(cost) => COST_LABELS[cost]}
      />

      <CheckboxGroup
        legend="Theory vs practice"
        values={THEORY_VS_PRACTICE}
        selected={criteria.theoryVsPractice}
        onToggle={(value) => toggle('theoryVsPractice', value)}
      />

      <TriStateGroup
        legend="Beginner-friendly"
        value={criteria.beginnerFriendly}
        onChange={(next) => onChange({ beginnerFriendly: next })}
        yesLabel="Beginner-friendly only"
        noLabel="Exclude beginner material"
      />

      <TriStateGroup
        legend="Project-based"
        value={criteria.projectBased}
        onChange={(next) => onChange({ projectBased: next })}
        yesLabel="Project-based only"
        noLabel="Exclude project-based"
      />

      <fieldset className="border-border border-t pt-4">
        <legend className="text-fg pr-2 text-sm font-medium">Duration</legend>
        <div className="mt-2 space-y-1.5">
          {DURATION_LIMITS.map(([label, minutes]) => (
            <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={durationName}
                checked={criteria.maxDurationMinutes === minutes}
                onChange={() => onChange({ maxDurationMinutes: minutes })}
                className="accent-accent h-4 w-4 shrink-0"
              />
              <span className="text-fg-muted">{label}</span>
            </label>
          ))}
        </div>
        {criteria.maxDurationMinutes !== null ? (
          <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
            Resources with no recorded length are hidden while a limit is set — we cannot claim they
            fit.
          </p>
        ) : null}
      </fieldset>

      <CheckboxGroup
        legend="Verification"
        values={STATUSES}
        selected={criteria.statuses}
        onToggle={(value) => toggle('statuses', value)}
      />

      {options.languages.length > 1 ? (
        <CheckboxGroup
          legend="Language"
          values={options.languages}
          selected={criteria.languages}
          onToggle={(value) => toggle('languages', value)}
        />
      ) : null}

      {options.providers.length > 0 ? (
        <CheckboxGroup
          legend="Provider"
          values={options.providers.map((p) => p.id)}
          selected={criteria.providers}
          onToggle={(value) => toggle('providers', value)}
          labelFor={(id) => options.providers.find((p) => p.id === id)?.name ?? humanizeId(id)}
        />
      ) : null}
    </div>
  )
}
