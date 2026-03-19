export type CommitmentDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'not_sure'

export type CommitmentFrequency =
  | '1_time'
  | '2_times'
  | '3_times'
  | '4_times'
  | '5_plus'
  | 'not_sure'

type CommitmentInput = {
  commitment?: unknown
  commitment_frequency?: unknown
  commitmentFrequency?: unknown
}

const COMMITMENT_DAYS: CommitmentDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'not_sure',
]

const COMMITMENT_FREQUENCIES: CommitmentFrequency[] = [
  '1_time',
  '2_times',
  '3_times',
  '4_times',
  '5_plus',
  'not_sure',
]

const FREQUENCY_TO_TARGET: Record<CommitmentFrequency, number> = {
  '1_time': 1,
  '2_times': 2,
  '3_times': 3,
  '4_times': 4,
  '5_plus': 5,
  not_sure: 3,
}

const FREQUENCY_TO_REMINDER_DAYS: Record<
  Exclude<CommitmentFrequency, 'not_sure'>,
  Exclude<CommitmentDay, 'not_sure'>[]
> = {
  '1_time': ['wednesday'],
  '2_times': ['monday', 'thursday'],
  '3_times': ['monday', 'wednesday', 'friday'],
  '4_times': ['monday', 'tuesday', 'thursday', 'friday'],
  '5_plus': ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
}

const COMMITMENT_FREQUENCY_LABELS: Record<CommitmentFrequency, string> = {
  '1_time': 'Once a week',
  '2_times': 'Twice a week',
  '3_times': 'Three times a week',
  '4_times': 'Four times a week',
  '5_plus': 'Five or more times a week',
  not_sure: 'Not sure',
}

const COMMITMENT_DAY_LABELS: Record<CommitmentDay, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  not_sure: 'Not sure',
}

export function isCommitmentDay(value: unknown): value is CommitmentDay {
  return (
    typeof value === 'string' &&
    COMMITMENT_DAYS.includes(value as CommitmentDay)
  )
}

export function isCommitmentFrequency(
  value: unknown,
): value is CommitmentFrequency {
  return (
    typeof value === 'string' &&
    COMMITMENT_FREQUENCIES.includes(value as CommitmentFrequency)
  )
}

function resolveCommitmentFrequency(
  input: CommitmentInput,
): CommitmentFrequency | null {
  if (isCommitmentFrequency(input.commitment_frequency)) {
    return input.commitment_frequency
  }

  if (isCommitmentFrequency(input.commitmentFrequency)) {
    return input.commitmentFrequency
  }

  if (Array.isArray(input.commitment) && isCommitmentFrequency(input.commitment[0])) {
    return input.commitment[0]
  }

  return null
}

export function parseCommitmentDays(commitment: unknown): CommitmentDay[] {
  if (!Array.isArray(commitment)) return []

  return commitment
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(isCommitmentDay)
}

export function getSelectedCommitmentDays(
  commitment: unknown,
): Exclude<CommitmentDay, 'not_sure'>[] {
  return parseCommitmentDays(commitment).filter(
    (day): day is Exclude<CommitmentDay, 'not_sure'> => day !== 'not_sure',
  )
}

export function getWeeklyCommitmentTarget(input: CommitmentInput): number {
  const selectedDays = getSelectedCommitmentDays(input.commitment)
  if (selectedDays.length > 0) return selectedDays.length

  const frequency = resolveCommitmentFrequency(input)
  return frequency ? FREQUENCY_TO_TARGET[frequency] : 3
}

export function getReminderCommitmentDays(
  input: CommitmentInput,
): Exclude<CommitmentDay, 'not_sure'>[] {
  const selectedDays = getSelectedCommitmentDays(input.commitment)
  if (selectedDays.length > 0) return selectedDays

  const frequency = resolveCommitmentFrequency(input)
  if (!frequency || frequency === 'not_sure') return []

  return FREQUENCY_TO_REMINDER_DAYS[frequency]
}

export function formatCommitmentSummary(input: CommitmentInput): string | null {
  const normalizedDays = parseCommitmentDays(input.commitment)
  const selectedDays = getSelectedCommitmentDays(input.commitment)

  if (selectedDays.length > 0) {
    return selectedDays.map((day) => COMMITMENT_DAY_LABELS[day]).join(', ')
  }

  if (normalizedDays.includes('not_sure')) {
    return COMMITMENT_DAY_LABELS.not_sure
  }

  const frequency = resolveCommitmentFrequency(input)
  return frequency ? COMMITMENT_FREQUENCY_LABELS[frequency] : null
}
