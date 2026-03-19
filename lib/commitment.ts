import type {
  CommitmentDay,
  CommitmentFrequency,
  CommitmentMode,
  Profile,
} from '@/types/database.types'

type CommitmentInput = {
  commitment?: readonly string[] | null
  commitment_frequency?: string | null
  commitmentFrequency?: string | null
}

export const COMMITMENT_DAY_VALUES: CommitmentDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'not_sure',
]

export const WEEKDAY_COMMITMENT_DAY_VALUES: Exclude<CommitmentDay, 'not_sure'>[] =
  COMMITMENT_DAY_VALUES.filter(
    (day): day is Exclude<CommitmentDay, 'not_sure'> => day !== 'not_sure',
  )

export const COMMITMENT_FREQUENCY_VALUES: CommitmentFrequency[] = [
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
    COMMITMENT_DAY_VALUES.includes(value as CommitmentDay)
  )
}

export function isCommitmentFrequency(
  value: unknown,
): value is CommitmentFrequency {
  return (
    typeof value === 'string' &&
    COMMITMENT_FREQUENCY_VALUES.includes(value as CommitmentFrequency)
  )
}

export function normalizeCommitmentDays(
  commitment: readonly string[] | null | undefined,
): CommitmentDay[] {
  if (!Array.isArray(commitment)) return []
  return commitment.filter(isCommitmentDay)
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

  const legacyValue = Array.isArray(input.commitment) ? input.commitment[0] : null
  return isCommitmentFrequency(legacyValue) ? legacyValue : null
}

export function getSelectedCommitmentDays(
  commitment: readonly string[] | null | undefined,
): Exclude<CommitmentDay, 'not_sure'>[] {
  return normalizeCommitmentDays(commitment).filter(
    (day): day is Exclude<CommitmentDay, 'not_sure'> => day !== 'not_sure',
  )
}

export function getCommitmentMode(
  input: Pick<Profile, 'commitment' | 'commitment_frequency'> | CommitmentInput,
): CommitmentMode {
  return resolveCommitmentFrequency(input) ? 'frequency' : 'specific_days'
}

export function hasCommitmentSelection(
  input: Pick<Profile, 'commitment' | 'commitment_frequency'> | CommitmentInput,
): boolean {
  return (
    normalizeCommitmentDays(input.commitment).length > 0 ||
    resolveCommitmentFrequency(input) !== null
  )
}

export function getWeeklyCommitmentTarget(
  input: Pick<Profile, 'commitment' | 'commitment_frequency'> | CommitmentInput,
): number {
  const selectedDays = getSelectedCommitmentDays(input.commitment)
  if (selectedDays.length > 0) return selectedDays.length

  const frequency = resolveCommitmentFrequency(input)
  return frequency ? FREQUENCY_TO_TARGET[frequency] : 3
}

export function getReminderCommitmentDays(
  input: Pick<Profile, 'commitment' | 'commitment_frequency'> | CommitmentInput,
): Exclude<CommitmentDay, 'not_sure'>[] {
  const selectedDays = getSelectedCommitmentDays(input.commitment)
  if (selectedDays.length > 0) return selectedDays

  const frequency = resolveCommitmentFrequency(input)
  if (!frequency || frequency === 'not_sure') return []

  return FREQUENCY_TO_REMINDER_DAYS[frequency]
}

export function getCommitmentFrequencyLabel(
  frequency: CommitmentFrequency,
): string {
  return COMMITMENT_FREQUENCY_LABELS[frequency]
}

export function getCommitmentDayLabel(day: CommitmentDay): string {
  return COMMITMENT_DAY_LABELS[day]
}

export function formatCommitmentSummary(
  input: Pick<Profile, 'commitment' | 'commitment_frequency'> | CommitmentInput,
): string | null {
  const normalizedDays = normalizeCommitmentDays(input.commitment)
  const selectedDays = getSelectedCommitmentDays(input.commitment)

  if (selectedDays.length > 0) {
    return selectedDays.map(getCommitmentDayLabel).join(', ')
  }

  if (normalizedDays.includes('not_sure')) {
    return getCommitmentDayLabel('not_sure')
  }

  const frequency = resolveCommitmentFrequency(input)
  return frequency ? getCommitmentFrequencyLabel(frequency) : null
}
