import {
  formatDurationClock,
  formatDurationDigits,
  formatDurationHoursMinutes,
  formatSetDuration,
  isTimedExerciseName,
  parseDurationDigits,
  parseDurationInput,
  resolveLoggingMode,
  secondsToDurationDigits,
  setsLookTimed,
} from '../lib/exercise-logging-mode'

describe('isTimedExerciseName', () => {
  it.each([
    'Plank',
    'Side Plank',
    'Wall Sit',
    'Dead Hang',
    'L-Sit',
    'LSit',
    'Treadmill Run',
    "Farmer's Walk",
    'Farmers Carry',
    'Jump Rope',
    'Ski Erg',
    'Ski Ergometer',
    'Swimming',
  ])('treats %s as timed', (name) => {
    expect(isTimedExerciseName(name)).toBe(true)
  })

  it.each([
    'T-Bar Row',
    'Hang Clean',
    'Walking Lunge',
    'Pause Hold Squat',
    'Bench Press',
    'Running',
    'SkiErg',
    'Custom Exercise',
  ])('treats %s as not timed', (name) => {
    expect(isTimedExerciseName(name)).toBe(false)
  })

  it('handles null/undefined/empty', () => {
    expect(isTimedExerciseName(null)).toBe(false)
    expect(isTimedExerciseName(undefined)).toBe(false)
    expect(isTimedExerciseName('')).toBe(false)
  })

  it('is stateless across repeated calls', () => {
    expect(isTimedExerciseName('Plank')).toBe(true)
    expect(isTimedExerciseName('Plank')).toBe(true)
  })
})

describe('setsLookTimed', () => {
  it('requires at least one set with a positive duration', () => {
    expect(setsLookTimed([], 'truthy')).toBe(false)
    expect(setsLookTimed([], 'positive')).toBe(false)
    expect(setsLookTimed([{ duration_seconds: 0 }], 'positive')).toBe(false)
    expect(setsLookTimed([{ duration_seconds: null }], 'truthy')).toBe(false)
  })

  it('is timed when every set has a duration or no strength data', () => {
    const sets = [
      { duration_seconds: 60, reps: null, weight: null },
      { duration_seconds: null, reps: null, weight: null },
      { duration_seconds: null, reps: 0, weight: 0 },
    ]
    expect(setsLookTimed(sets, 'truthy')).toBe(true)
    expect(setsLookTimed(sets, 'positive')).toBe(true)
  })

  it('is not timed when any non-duration set has positive reps or weight', () => {
    const withReps = [{ duration_seconds: 60 }, { reps: 8, weight: null }]
    const withWeight = [{ duration_seconds: 60 }, { reps: null, weight: 20 }]
    for (const rule of ['truthy', 'positive'] as const) {
      expect(setsLookTimed(withReps, rule)).toBe(false)
      expect(setsLookTimed(withWeight, rule)).toBe(false)
    }
  })

  it('a set with both duration and strength data still counts as timed', () => {
    expect(
      setsLookTimed([{ duration_seconds: 30, reps: 10, weight: 50 }], 'truthy'),
    ).toBe(true)
  })

  it('differs on negative values: truthy counts them as strength data, positive does not', () => {
    const negativeWeight = [{ duration_seconds: 60 }, { reps: null, weight: -5 }]
    const negativeReps = [{ duration_seconds: 60 }, { reps: -1, weight: null }]
    expect(setsLookTimed(negativeWeight, 'truthy')).toBe(false)
    expect(setsLookTimed(negativeWeight, 'positive')).toBe(true)
    expect(setsLookTimed(negativeReps, 'truthy')).toBe(false)
    expect(setsLookTimed(negativeReps, 'positive')).toBe(true)
  })

  it('treats NaN as no strength data under both rules', () => {
    const sets = [{ duration_seconds: 60 }, { reps: NaN, weight: NaN }]
    expect(setsLookTimed(sets, 'truthy')).toBe(true)
    expect(setsLookTimed(sets, 'positive')).toBe(true)
  })
})

describe('resolveLoggingMode', () => {
  it('explicit mode wins over name and sets', () => {
    expect(resolveLoggingMode({ name: 'Plank', explicitMode: 'reps' })).toBe('reps')
    expect(
      resolveLoggingMode({ name: 'Bench Press', explicitMode: 'duration' }),
    ).toBe('duration')
  })

  it('falls back to the name pattern', () => {
    expect(resolveLoggingMode({ name: 'Plank' })).toBe('duration')
    expect(resolveLoggingMode({ name: 'Bench Press' })).toBe('reps')
    expect(resolveLoggingMode({ name: 'Plank', explicitMode: undefined })).toBe(
      'duration',
    )
  })

  it('without sets, ignores logged durations (structured input behaviour)', () => {
    expect(resolveLoggingMode({ name: 'Mystery Move' })).toBe('reps')
  })

  it('infers from sets when provided', () => {
    const sets = [{ duration_seconds: 45 }]
    expect(
      resolveLoggingMode({ name: 'Mystery Move', sets, strengthDataRule: 'truthy' }),
    ).toBe('duration')
    expect(
      resolveLoggingMode({ name: 'Mystery Move', sets, strengthDataRule: 'positive' }),
    ).toBe('duration')
    expect(
      resolveLoggingMode({
        name: 'Mystery Move',
        sets: [{ duration_seconds: 45 }, { reps: 5 }],
        strengthDataRule: 'positive',
      }),
    ).toBe('reps')
  })

  it('applies the chosen strength-data rule', () => {
    const sets = [{ duration_seconds: 45 }, { weight: -10 }]
    expect(
      resolveLoggingMode({ name: 'X', sets, strengthDataRule: 'truthy' }),
    ).toBe('reps')
    expect(
      resolveLoggingMode({ name: 'X', sets, strengthDataRule: 'positive' }),
    ).toBe('duration')
  })

  it('name match short-circuits set inference', () => {
    expect(
      resolveLoggingMode({
        name: 'Plank',
        sets: [{ reps: 10, weight: 20 }],
        strengthDataRule: 'truthy',
      }),
    ).toBe('duration')
  })
})

describe('parseDurationDigits', () => {
  it.each([
    ['', null],
    [null, null],
    [undefined, null],
    ['abc', null],
    ['0', 0],
    ['000', 0],
    ['9', 9],
    ['45', 45],
    ['130', 90],
    ['199', 159],
    ['1:30', 90],
    ['1000', 600],
  ])('%p -> %p', (input, expected) => {
    expect(parseDurationDigits(input as string | null | undefined)).toBe(expected)
  })
})

describe('parseDurationInput (edit-workout set duration)', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['1:30', 90],
    [' 1:30 ', 90],
    ['0:45', 45],
    [':45', 45],
    ['2:', 120],
    ['1:90', 150],
    ['1:30:15', 90],
    ['0:00', null],
    ['a:30', null],
    ['1:b', null],
    ['130', 90],
    ['45', 45],
    ['199', 159],
    ['0', null],
    ['abc', null],
    ['1m30s', 90],
  ])('%p -> %p', (input, expected) => {
    expect(parseDurationInput(input)).toBe(expected)
  })
})

describe('formatSetDuration', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    [0, ''],
    [-5, ''],
    [NaN, ''],
    [Infinity, ''],
    [5, '0:05'],
    [90, '1:30'],
    [3600, '60:00'],
    [90.7, '1:30'],
    [0.5, '0:00'],
  ])('%p -> %p', (input, expected) => {
    expect(formatSetDuration(input as number | null | undefined)).toBe(expected)
  })
})

describe('formatDurationDigits (structured input / composer text)', () => {
  it.each([
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['0', '0:00'],
    ['000', '0:00'],
    ['5', '0:05'],
    ['130', '1:30'],
    ['199', '2:39'],
    ['6000', '60:00'],
  ])('%p -> %p', (input, expected) => {
    expect(formatDurationDigits(input as string | null | undefined)).toBe(expected)
  })
})

describe('secondsToDurationDigits', () => {
  it.each([
    [null, null],
    [undefined, null],
    [0, null],
    [-1, null],
    [NaN, null],
    [5, '005'],
    [90, '130'],
    [3600, '6000'],
  ])('%p -> %p', (input, expected) => {
    expect(secondsToDurationDigits(input as number | null | undefined)).toBe(expected)
  })

  it('round-trips through formatDurationDigits', () => {
    expect(formatDurationDigits(secondsToDurationDigits(95))).toBe('1:35')
  })
})

describe('formatDurationClock (feed card / stats grid)', () => {
  it.each([
    [0, '0:00'],
    [-10, '0:00'],
    [59.9, '0:59'],
    [65, '1:05'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('%p -> %p', (input, expected) => {
    expect(formatDurationClock(input)).toBe(expected)
  })
})

describe('formatDurationHoursMinutes (edit-workout header)', () => {
  it.each([
    [0, '0min'],
    [-10, '0min'],
    [59, '0min'],
    [65, '1min'],
    [3599, '59min'],
    [3600, '1h 0m'],
    [3725, '1h 2m'],
  ])('%p -> %p', (input, expected) => {
    expect(formatDurationHoursMinutes(input)).toBe(expected)
  })
})
