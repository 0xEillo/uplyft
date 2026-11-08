/**
 * Shared rules for deciding whether an exercise is logged by reps/weight or by
 * time, plus the duration parse/format helpers used by the workout editors and
 * workout displays.
 *
 * Some call sites historically used slightly different variants of these rules.
 * Those variants are kept as explicit options/functions so every caller keeps
 * its existing behaviour.
 */

export type ExerciseLoggingMode = 'reps' | 'duration'

// Note: keep tokens specific. Ambiguous substrings like "row", "hang", "walk",
// "hold" leak into rep-based lifts (T-bar Row, Hang Clean, Walking Lunge, Pause Hold).
// Match concrete cardio / static-hold names instead.
export const TIMED_EXERCISE_NAME_PATTERN =
  /\b(plank|wall sit|dead hang|l-?sit|sprint|run|jog|skip(?:ping)?|cycling|rowing machine|rower|stairmaster|stair climber|elliptical|treadmill|swim(?:ming)?|battle rope|jump rope|ski erg(?:ometer)?|assault bike|air bike|exercise bike|spin bike|farmer'?s? walk|farmer'?s? carry|suitcase carry|overhead carry|waiter walk|waiter carry|isometric hold|bear crawl|crab walk)\b/i

export function isTimedExerciseName(name: string | null | undefined): boolean {
  return TIMED_EXERCISE_NAME_PATTERN.test(name ?? '')
}

export interface LoggingModeSet {
  reps?: number | null
  weight?: number | null
  duration_seconds?: number | null
}

/**
 * How a set without a positive duration is judged to carry strength data.
 *
 * - `'truthy'` (edit-workout screen): strength data when `reps || weight` is
 *   truthy, so negative values also count as strength data.
 * - `'positive'` (workout detail card): strength data only when `weight > 0`
 *   or `reps > 0`.
 */
export type StrengthDataRule = 'truthy' | 'positive'

function hasPositiveDuration(set: LoggingModeSet): boolean {
  return typeof set.duration_seconds === 'number' && set.duration_seconds > 0
}

function hasStrengthData(set: LoggingModeSet, rule: StrengthDataRule): boolean {
  if (rule === 'truthy') {
    return Boolean(set.reps) || Boolean(set.weight)
  }
  return (
    (typeof set.weight === 'number' && set.weight > 0) ||
    (typeof set.reps === 'number' && set.reps > 0)
  )
}

/**
 * True when at least one set has a positive duration and every set either has a
 * positive duration or carries no strength data.
 */
export function setsLookTimed(
  sets: readonly LoggingModeSet[],
  strengthDataRule: StrengthDataRule,
): boolean {
  return (
    sets.some(hasPositiveDuration) &&
    sets.every(
      (set) => hasPositiveDuration(set) || !hasStrengthData(set, strengthDataRule),
    )
  )
}

export interface ResolveLoggingModeInput {
  name: string | null | undefined
  /** An explicit mode wins over every heuristic. */
  explicitMode?: ExerciseLoggingMode | null
  /**
   * Logged sets to infer from when the name is not a known timed exercise.
   * Omit to rely on the name alone.
   */
  sets?: readonly LoggingModeSet[] | null
  /** Required when `sets` is provided. Defaults to `'positive'`. */
  strengthDataRule?: StrengthDataRule
}

export function resolveLoggingMode({
  name,
  explicitMode,
  sets,
  strengthDataRule = 'positive',
}: ResolveLoggingModeInput): ExerciseLoggingMode {
  if (explicitMode === 'duration') return 'duration'
  if (explicitMode === 'reps') return 'reps'
  if (isTimedExerciseName(name)) return 'duration'
  if (sets && setsLookTimed(sets, strengthDataRule)) return 'duration'
  return 'reps'
}

// ---------------------------------------------------------------------------
// Duration parsing
// ---------------------------------------------------------------------------

/**
 * Parse "digit-style" duration input where the last two digits are seconds and
 * the rest are minutes ("130" -> 90s, "9" -> 9s, "199" -> 159s). Non-digits are
 * ignored. Returns null when there are no digits; may return 0.
 */
export function parseDurationDigits(value: string | null | undefined): number | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return null
  const seconds = Number.parseInt(digits.slice(-2), 10) || 0
  const minutes = Number.parseInt(digits.slice(0, -2) || '0', 10) || 0
  return minutes * 60 + seconds
}

/**
 * Parse a duration typed as "m:ss" (anything after a second colon is ignored)
 * or as digit-style input (see parseDurationDigits). Returns positive seconds,
 * or null for blank, unparseable or zero input.
 */
export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.includes(':')) {
    const [minutesText, secondsText = '0'] = trimmed.split(':')
    const minutes = Number.parseInt(minutesText || '0', 10)
    const seconds = Number.parseInt(secondsText || '0', 10)
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
    const total = minutes * 60 + seconds
    return total > 0 ? total : null
  }

  const total = parseDurationDigits(trimmed)
  return total !== null && total > 0 ? total : null
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatMinutesSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Set duration as "m:ss" (minutes are not rolled into hours). Returns '' for
 * null, non-finite or non-positive values.
 */
export function formatSetDuration(seconds: number | null | undefined): string {
  if (!isPositiveFiniteNumber(seconds)) return ''
  return formatMinutesSeconds(seconds)
}

/**
 * Digit-style input ("130") rendered as "m:ss" ("1:30"), normalising overflowing
 * seconds ("199" -> "2:39"). Returns '' when there are no digits; all-zero
 * digits render as "0:00".
 */
export function formatDurationDigits(value: string | null | undefined): string {
  const total = parseDurationDigits(value)
  if (total === null) return ''
  return formatMinutesSeconds(total)
}

/**
 * Seconds to digit-style input ("90" -> "130"). Returns null for null,
 * non-finite or non-positive values.
 */
export function secondsToDurationDigits(seconds?: number | null): string | null {
  if (!isPositiveFiniteNumber(seconds)) return null
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}${secs.toString().padStart(2, '0')}`
}

/**
 * Workout duration as a clock: "h:mm:ss" from one hour, else "m:ss".
 * Used by the feed card and workout detail stats grid.
 */
export function formatDurationClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Workout duration in words, seconds dropped: "1h 5m" from one hour, else
 * "5min". Used by the edit-workout screen.
 */
export function formatDurationHoursMinutes(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}min`
}
