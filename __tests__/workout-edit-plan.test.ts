import {
  buildSessionUpdate,
  buildSetUpdate,
  buildWorkoutEditPlan,
  computeTotalDurationSeconds,
  type WorkoutEditOriginal,
  type WorkoutEditState,
} from '../lib/workout-edit-plan'

const LB_TO_KG = 0.45359237
const lbToKg = (value: number | null | undefined) =>
  value == null ? null : value * LB_TO_KG
const identityKg = (value: number | null | undefined) => value ?? null

function makeOriginal(
  overrides: Partial<WorkoutEditOriginal> = {},
): WorkoutEditOriginal {
  return {
    id: 'w1',
    userId: 'u1',
    image_url: null,
    workout_exercises: [{ id: 'we1' }, { id: 'we2' }, { id: 'we3' }],
    ...overrides,
  }
}

function makeEdits(overrides: Partial<WorkoutEditState> = {}): WorkoutEditState {
  return {
    title: 'Push Day',
    notes: '',
    imageDeleted: false,
    editedImageUrl: null,
    date: null,
    durationHours: '',
    durationMinutes: '',
    durationSeconds: '',
    deletedExerciseIds: new Set(),
    deletedSetIds: new Set(),
    editedExercises: {},
    editedSets: {},
    ...overrides,
  }
}

describe('computeTotalDurationSeconds', () => {
  it.each([
    ['', '', '', null],
    ['0', '0', '0', null],
    ['1', '0', '0', 3600],
    ['', '45', '30', 2730],
    ['1', '2', '3', 3723],
    ['abc', '5', '', 300],
    ['1.9', '0', '0', 3600],
    ['', '90', '', 5400],
    ['', '0', '-30', null],
    ['', '1', '-30', 30],
  ])('%p h %p m %p s -> %p', (h, m, s, expected) => {
    expect(computeTotalDurationSeconds(h, m, s)).toBe(expected)
  })
})

describe('buildSessionUpdate', () => {
  it('always sets trimmed title and notes, nulling blanks', () => {
    expect(
      buildSessionUpdate(
        { image_url: null },
        makeEdits({ title: '  Legs  ', notes: '   ' }),
      ),
    ).toEqual({ type: 'Legs', notes: null, duration: null })

    const update = buildSessionUpdate(
      { image_url: null },
      makeEdits({ title: '', notes: ' felt good ' }),
    )
    expect(update.type).toBeNull()
    expect(update.notes).toBe('felt good')
  })

  it('preserves key order type, notes, image_url, date, duration', () => {
    const update = buildSessionUpdate(
      { image_url: 'old' },
      makeEdits({
        editedImageUrl: 'new',
        date: new Date('2026-01-02T03:04:05.000Z'),
        durationMinutes: '30',
      }),
    )
    expect(Object.keys(update)).toEqual([
      'type',
      'notes',
      'image_url',
      'date',
      'duration',
    ])
    expect(update.date).toBe('2026-01-02T03:04:05.000Z')
    expect(update.duration).toBe(1800)
  })

  it('omits image_url when untouched', () => {
    expect(
      buildSessionUpdate({ image_url: 'old' }, makeEdits()),
    ).not.toHaveProperty('image_url')
  })

  it('nulls image_url when deleted, even if a new url is set', () => {
    expect(
      buildSessionUpdate(
        { image_url: 'old' },
        makeEdits({ imageDeleted: true, editedImageUrl: 'new' }),
      ).image_url,
    ).toBeNull()
  })

  it('writes duration null when the h/m/s total is zero', () => {
    const update = buildSessionUpdate(
      { image_url: null },
      makeEdits({ durationHours: '0', durationMinutes: '0', durationSeconds: '0' }),
    )
    expect(update).toHaveProperty('duration', null)
  })
})

describe('buildSetUpdate', () => {
  it('returns null when nothing was edited', () => {
    expect(buildSetUpdate({}, identityKg)).toBeNull()
  })

  it('parses reps with trimming and decimals', () => {
    expect(buildSetUpdate({ reps: ' 8 ' }, identityKg)).toEqual({ reps: 8 })
    expect(buildSetUpdate({ reps: '7.5' }, identityKg)).toEqual({ reps: 7.5 })
    expect(buildSetUpdate({ reps: '10abc' }, identityKg)).toEqual({ reps: 10 })
  })

  it('ignores unparseable reps', () => {
    expect(buildSetUpdate({ reps: 'abc' }, identityKg)).toBeNull()
  })

  it('blank reps produce reps: undefined (known bug: cannot clear reps)', () => {
    const update = buildSetUpdate({ reps: '  ' }, identityKg)
    expect(update).not.toBeNull()
    expect(Object.keys(update!)).toEqual(['reps'])
    expect(update!.reps).toBeUndefined()
  })

  it('converts weight to kg via toKg', () => {
    const update = buildSetUpdate({ weight: '100' }, lbToKg)
    expect(update!.weight).toBeCloseTo(45.359237)
  })

  it('does not call toKg for cleared weight', () => {
    const toKg = jest.fn(identityKg)
    expect(buildSetUpdate({ weight: '' }, toKg)).toEqual({ weight: null })
    expect(toKg).not.toHaveBeenCalled()
  })

  it('ignores unparseable weight (including whitespace, which is not trimmed)', () => {
    expect(buildSetUpdate({ weight: 'heavy' }, identityKg)).toBeNull()
    expect(buildSetUpdate({ weight: '  ' }, identityKg)).toBeNull()
  })

  it('combines reps and weight', () => {
    expect(buildSetUpdate({ reps: '5', weight: '60' }, identityKg)).toEqual({
      reps: 5,
      weight: 60,
    })
  })

  it('a positive duration nulls reps and weight', () => {
    expect(
      buildSetUpdate({ reps: '5', weight: '60', duration_seconds: '1:30' }, identityKg),
    ).toEqual({ reps: null, weight: null, duration_seconds: 90 })
    expect(buildSetUpdate({ duration_seconds: '130' }, identityKg)).toEqual({
      duration_seconds: 90,
      reps: null,
      weight: null,
    })
  })

  it('a blank or zero duration writes duration null and leaves reps/weight alone', () => {
    expect(buildSetUpdate({ duration_seconds: '' }, identityKg)).toEqual({
      duration_seconds: null,
    })
    expect(
      buildSetUpdate({ reps: '5', duration_seconds: '0:00' }, identityKg),
    ).toEqual({ reps: 5, duration_seconds: null })
  })
})

describe('buildWorkoutEditPlan', () => {
  it('carries ids and a session update', () => {
    const plan = buildWorkoutEditPlan(makeOriginal(), makeEdits(), {
      toKg: identityKg,
    })
    expect(plan.workoutId).toBe('w1')
    expect(plan.userId).toBe('u1')
    expect(plan.sessionUpdate).toEqual({
      type: 'Push Day',
      notes: null,
      duration: null,
    })
    expect(plan.deleteImageUrl).toBeNull()
    expect(plan.deleteExerciseIds).toEqual([])
    expect(plan.deleteSetIds).toEqual([])
    expect(plan.exerciseSwaps).toEqual([])
    expect(plan.setUpdates).toEqual([])
  })

  describe('deleteImageUrl', () => {
    it('is the old url when the image was deleted', () => {
      const plan = buildWorkoutEditPlan(
        makeOriginal({ image_url: 'old' }),
        makeEdits({ imageDeleted: true }),
        { toKg: identityKg },
      )
      expect(plan.deleteImageUrl).toBe('old')
    })

    it('is the old url when replaced with a different one', () => {
      const plan = buildWorkoutEditPlan(
        makeOriginal({ image_url: 'old' }),
        makeEdits({ editedImageUrl: 'new' }),
        { toKg: identityKg },
      )
      expect(plan.deleteImageUrl).toBe('old')
    })

    it('is null when the same url is re-set, untouched, or there was no old image', () => {
      expect(
        buildWorkoutEditPlan(
          makeOriginal({ image_url: 'old' }),
          makeEdits({ editedImageUrl: 'old' }),
          { toKg: identityKg },
        ).deleteImageUrl,
      ).toBeNull()
      expect(
        buildWorkoutEditPlan(makeOriginal({ image_url: 'old' }), makeEdits(), {
          toKg: identityKg,
        }).deleteImageUrl,
      ).toBeNull()
      expect(
        buildWorkoutEditPlan(
          makeOriginal({ image_url: null }),
          makeEdits({ imageDeleted: true }),
          { toKg: identityKg },
        ).deleteImageUrl,
      ).toBeNull()
    })
  })

  it('lists deletes in insertion order', () => {
    const plan = buildWorkoutEditPlan(
      makeOriginal(),
      makeEdits({
        deletedExerciseIds: new Set(['we3', 'we1']),
        deletedSetIds: new Set(['s2', 's1']),
      }),
      { toKg: identityKg },
    )
    expect(plan.deleteExerciseIds).toEqual(['we3', 'we1'])
    expect(plan.deleteSetIds).toEqual(['s2', 's1'])
  })

  it('reindexes order across remaining exercises in their current order', () => {
    const plan = buildWorkoutEditPlan(
      makeOriginal({
        workout_exercises: [{ id: 'we3' }, { id: 'we1' }, { id: 'we2' }, { id: 'we4' }],
      }),
      makeEdits({ deletedExerciseIds: new Set(['we1']) }),
      { toKg: identityKg },
    )
    expect(plan.order).toEqual([
      { workoutExerciseId: 'we3', orderIndex: 0 },
      { workoutExerciseId: 'we2', orderIndex: 1 },
      { workoutExerciseId: 'we4', orderIndex: 2 },
    ])
  })

  it('has an empty order when the workout has no exercises list', () => {
    const plan = buildWorkoutEditPlan(
      makeOriginal({ workout_exercises: undefined }),
      makeEdits(),
      { toKg: identityKg },
    )
    expect(plan.order).toEqual([])
  })

  it('skips swaps for deleted exercises', () => {
    const plan = buildWorkoutEditPlan(
      makeOriginal(),
      makeEdits({
        editedExercises: { we1: 'ex-a', we2: 'ex-b' },
        deletedExerciseIds: new Set(['we2']),
      }),
      { toKg: identityKg },
    )
    expect(plan.exerciseSwaps).toEqual([
      { workoutExerciseId: 'we1', exerciseId: 'ex-a' },
    ])
  })

  it('builds set updates, skipping deleted sets and no-op edits', () => {
    const plan = buildWorkoutEditPlan(
      makeOriginal(),
      makeEdits({
        editedSets: {
          s1: { weight: '225', reps: '5' },
          s2: { reps: '10' },
          s3: { reps: 'x' },
          s4: { duration_seconds: '45' },
        },
        deletedSetIds: new Set(['s2']),
      }),
      { toKg: lbToKg },
    )
    expect(plan.setUpdates.map((u) => u.setId)).toEqual(['s1', 's4'])
    expect(plan.setUpdates[0].updates.reps).toBe(5)
    expect(plan.setUpdates[0].updates.weight).toBeCloseTo(225 * LB_TO_KG)
    expect(plan.setUpdates[1].updates).toEqual({
      duration_seconds: 45,
      reps: null,
      weight: null,
    })
  })

  it('still updates edited sets that belong to a deleted exercise (existing behaviour)', () => {
    const plan = buildWorkoutEditPlan(
      makeOriginal(),
      makeEdits({
        deletedExerciseIds: new Set(['we1']),
        editedSets: { 'set-of-we1': { reps: '3' } },
      }),
      { toKg: identityKg },
    )
    expect(plan.setUpdates).toEqual([
      { setId: 'set-of-we1', updates: { reps: 3 } },
    ])
  })
})
