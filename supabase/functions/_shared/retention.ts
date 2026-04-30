import {
  type CommitmentDay,
  getReminderCommitmentDays,
  getSelectedCommitmentDays,
  getWeeklyCommitmentTarget,
  isCommitmentFrequency,
} from './commitment.ts'

type CommitmentInput = {
  commitment?: unknown
  commitment_frequency?: unknown
  commitmentFrequency?: unknown
}

type ScheduledReminderPlanInput = CommitmentInput & {
  todayDateKey: string
  localWeekday: Exclude<CommitmentDay, 'not_sure'>
  workoutDateKeys: string[]
}

export type ScheduledReminderPlan = {
  weeklyTarget: number
  workoutsThisWeek: number
  workoutsRemainingThisWeek: number
  daysElapsedThisWeek: number
  daysRemainingThisWeek: number
  expectedWorkoutsByToday: number
  behindTargetBy: number
  isBehindWeeklyPace: boolean
  needsWorkoutTodayToHitGoal: boolean
  isPlannedWorkoutDay: boolean
  hasExplicitCommitmentTarget: boolean
  shouldSendScheduledReminderToday: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

export function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (year && month && day) {
    return `${year}-${month}-${day}`
  }

  return date.toISOString().split('T')[0]
}

export function getLocalWeekday(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  })
    .format(date)
    .toLowerCase()
}

export function getLocalHourAndMinute(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

export function parseTimeToMinutes(value: string | null | undefined): number {
  if (!value) return 0
  const [hoursRaw, minutesRaw] = value.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0
  }

  return hours * 60 + minutes
}

export function isWithinQuietHours(
  localMinutes: number,
  quietStart: string,
  quietEnd: string,
): boolean {
  const startMinutes = parseTimeToMinutes(quietStart)
  const endMinutes = parseTimeToMinutes(quietEnd)

  if (startMinutes === endMinutes) {
    return false
  }

  if (startMinutes < endMinutes) {
    return localMinutes >= startMinutes && localMinutes < endMinutes
  }

  return localMinutes >= startMinutes || localMinutes < endMinutes
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value))
  return new Date(Date.UTC(year, month - 1, day))
}

export function diffDays(dateKeyA: string, dateKeyB: string): number {
  const a = parseDateKey(dateKeyA).getTime()
  const b = parseDateKey(dateKeyB).getTime()
  return Math.floor((a - b) / DAY_MS)
}

export function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

export function toSortedUniqueDateKeys(
  workouts: { date: string }[],
  timezone: string,
): string[] {
  const keys = new Set<string>()

  for (const workout of workouts) {
    keys.add(getLocalDateKey(new Date(workout.date), timezone))
  }

  return Array.from(keys).sort((a, b) => b.localeCompare(a))
}

export function firstName(displayName: string): string {
  const trimmed = (displayName || '').trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0]
}

function getWeekKey(dateKey: string): string {
  const date = parseDateKey(dateKey)
  const day = date.getUTCDay()
  const diffToMonday = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - diffToMonday)
  return date.toISOString().split('T')[0]
}

function getCommitmentFrequency(input: CommitmentInput): string | null {
  const rawValue = input.commitment_frequency ?? input.commitmentFrequency
  return typeof rawValue === 'string' ? rawValue : null
}

function getDaysElapsedThisWeek(todayDateKey: string): number {
  const day = parseDateKey(todayDateKey).getUTCDay()
  return ((day + 6) % 7) + 1
}

export function getAdaptiveWeeklyPushLimit(
  baseLimit: number,
  input: CommitmentInput,
): number {
  const hasSpecificDays = getSelectedCommitmentDays(input.commitment).length > 0
  const frequency = getCommitmentFrequency(input)
  const hasExplicitFrequencyTarget =
    isCommitmentFrequency(frequency) && frequency !== 'not_sure'

  if (!hasSpecificDays && !hasExplicitFrequencyTarget) {
    return baseLimit
  }

  const weeklyTarget = getWeeklyCommitmentTarget(input)
  return Math.min(7, Math.max(baseLimit, weeklyTarget + 1))
}

export function getScheduledReminderPlan(
  input: ScheduledReminderPlanInput,
): ScheduledReminderPlan {
  const weeklyTarget = getWeeklyCommitmentTarget(input)
  const weekKey = getWeekKey(input.todayDateKey)
  const workoutsThisWeek = input.workoutDateKeys.filter(
    (dateKey) => getWeekKey(dateKey) === weekKey,
  ).length
  const workoutsRemainingThisWeek = Math.max(0, weeklyTarget - workoutsThisWeek)
  const daysElapsedThisWeek = getDaysElapsedThisWeek(input.todayDateKey)
  const daysRemainingThisWeek = 8 - daysElapsedThisWeek
  const expectedWorkoutsByToday = Math.min(
    weeklyTarget,
    Math.ceil((weeklyTarget * daysElapsedThisWeek) / 7),
  )
  const behindTargetBy = Math.max(0, expectedWorkoutsByToday - workoutsThisWeek)
  const isBehindWeeklyPace = behindTargetBy > 0
  const needsWorkoutTodayToHitGoal =
    workoutsRemainingThisWeek > 0 &&
    workoutsRemainingThisWeek >= daysRemainingThisWeek

  const reminderDays = getReminderCommitmentDays(input)
  const isPlannedWorkoutDay = reminderDays.includes(input.localWeekday)

  const hasSpecificDays = getSelectedCommitmentDays(input.commitment).length > 0
  const frequency = getCommitmentFrequency(input)
  const hasExplicitFrequencyTarget =
    isCommitmentFrequency(frequency) && frequency !== 'not_sure'
  const hasExplicitCommitmentTarget =
    hasSpecificDays || hasExplicitFrequencyTarget

  const shouldSendScheduledReminderToday = hasExplicitCommitmentTarget
    ? workoutsRemainingThisWeek > 0 &&
      (isPlannedWorkoutDay || isBehindWeeklyPace || needsWorkoutTodayToHitGoal)
    : workoutsRemainingThisWeek > 0

  return {
    weeklyTarget,
    workoutsThisWeek,
    workoutsRemainingThisWeek,
    daysElapsedThisWeek,
    daysRemainingThisWeek,
    expectedWorkoutsByToday,
    behindTargetBy,
    isBehindWeeklyPace,
    needsWorkoutTodayToHitGoal,
    isPlannedWorkoutDay,
    hasExplicitCommitmentTarget,
    shouldSendScheduledReminderToday,
  }
}
