import {
  formatCommitmentSummary,
  getCommitmentMode,
  getReminderCommitmentDays,
  getWeeklyCommitmentTarget,
} from '@/lib/commitment'

describe('commitment helpers', () => {
  it('uses selected days when specific workout days are set', () => {
    const input = {
      commitment: ['monday', 'wednesday', 'friday'] as const,
      commitment_frequency: null,
    }

    expect(getCommitmentMode(input)).toBe('specific_days')
    expect(getWeeklyCommitmentTarget(input)).toBe(3)
    expect(getReminderCommitmentDays(input)).toEqual([
      'monday',
      'wednesday',
      'friday',
    ])
    expect(formatCommitmentSummary(input)).toBe('Monday, Wednesday, Friday')
  })

  it('uses frequency when the user wants a flexible weekly target', () => {
    const input = {
      commitment: null,
      commitment_frequency: '4_times' as const,
    }

    expect(getCommitmentMode(input)).toBe('frequency')
    expect(getWeeklyCommitmentTarget(input)).toBe(4)
    expect(getReminderCommitmentDays(input)).toEqual([
      'monday',
      'tuesday',
      'thursday',
      'friday',
    ])
    expect(formatCommitmentSummary(input)).toBe('Four times a week')
  })

  it('treats not sure as a valid selection with the default target', () => {
    const input = {
      commitment: ['not_sure'] as const,
      commitment_frequency: null,
    }

    expect(getWeeklyCommitmentTarget(input)).toBe(3)
    expect(getReminderCommitmentDays(input)).toEqual([])
    expect(formatCommitmentSummary(input)).toBe('Not sure')
  })
})
