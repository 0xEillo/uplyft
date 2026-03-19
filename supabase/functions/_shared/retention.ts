import {
  type CommitmentDay,
  getReminderCommitmentDays,
  getSelectedCommitmentDays,
  getWeeklyCommitmentTarget,
  isCommitmentFrequency,
} from './commitment'

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

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value))
  return new Date(Date.UTC(year, month - 1, day))
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
