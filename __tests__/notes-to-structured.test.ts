import {
  HIGH_CONFIDENCE_SCORE,
  MIN_MARGIN,
  parseExerciseBlockAtCursor,
  resolveExerciseName,
} from '@/lib/utils/notes-to-structured'
import type { Exercise } from '@/types/database.types'

const exercise = (
  name: string,
  overrides: Partial<Exercise> = {},
): Exercise =>
  ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    muscle_group: null,
    type: null,
    equipment: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    aliases: null,
    ...overrides,
  }) as Exercise

describe('resolveExerciseName', () => {
  test('pins the thresholds', () => {
    expect(HIGH_CONFIDENCE_SCORE).toBe(0.93)
    expect(MIN_MARGIN).toBe(0.12)
  })

  test.each<[string, string, Exercise[], string | null, string]>([
    ['empty query', '  ()  ', [exercise('Bench Press')], null, 'empty-query'],
    ['no overlap', 'squat', [exercise('Bench Press')], null, 'no-candidates'],
    [
      'exact name after normalization',
      'bench-press',
      [exercise('Bench Press'), exercise('Bench Press (Close Grip)')],
      'Bench Press',
      'exact-name',
    ],
    [
      'exact alias',
      'bp',
      [exercise('Bench Press', { aliases: ['BP', ' '] })],
      'Bench Press',
      'exact-alias',
    ],
    [
      'same tokens, different order scores 0.97',
      'press bench',
      [exercise('Bench Press')],
      'Bench Press',
      'high-confidence',
    ],
    [
      // coverage 1, precision 2/3, substring bonus -> 0.8667, alone so margin is large
      'partial match below 0.93 is low-confidence',
      'bench press',
      [exercise('Barbell Bench Press Wide')],
      null,
      'low-confidence',
    ],
  ])('%s', (_label, typed, catalog, resolvedName, reason) => {
    const result = resolveExerciseName(typed, catalog)
    expect(result.resolvedName).toBe(resolvedName)
    expect(result.reason).toBe(reason)
  })

  describe('score threshold (0.93)', () => {
    // coverage 1, precision 0.75, substring +0.05 -> 0.8875
    test('0.8875 does not resolve', () => {
      const result = resolveExerciseName('bicep curl hammer', [
        exercise('Bicep Curl Hammer Standing'),
      ])
      expect(result.topCandidates[0].score).toBeCloseTo(0.8875)
      expect(result.resolvedName).toBeNull()
      expect(result.reason).toBe('low-confidence')
    })

    // same shape plus +0.05 for a shared equipment hint -> 0.9375
    test('0.9375 resolves', () => {
      const result = resolveExerciseName('dumbbell curl hammer', [
        exercise('Dumbbell Curl Hammer Standing'),
      ])
      expect(result.topCandidates[0].score).toBeCloseTo(0.9375)
      expect(result.resolvedName).toBe('Dumbbell Curl Hammer Standing')
      expect(result.reason).toBe('high-confidence')
    })
  })

  describe('margin threshold (0.12)', () => {
    test('margin ~0.103 is ambiguous', () => {
      // best: same token set (0.97); runner-up: 2/3 precision + substring (0.8667)
      const result = resolveExerciseName('press bench', [
        exercise('Bench Press'),
        exercise('Press Bench Seated'),
      ])
      expect(result.margin).toBeCloseTo(0.97 - 0.8667, 3)
      expect(result.resolvedName).toBeNull()
      expect(result.reason).toBe('ambiguous')
    })

    test('margin ~0.145 resolves', () => {
      // runner-up: 1/2 precision + substring (0.825)
      const result = resolveExerciseName('press bench', [
        exercise('Bench Press'),
        exercise('Press Bench Seated Slow'),
      ])
      expect(result.margin).toBeCloseTo(0.97 - 0.825, 3)
      expect(result.resolvedName).toBe('Bench Press')
      expect(result.reason).toBe('high-confidence')
    })

    test('two equally good candidates are ambiguous', () => {
      const result = resolveExerciseName('press bench', [
        exercise('Bench Press'),
        exercise('Bench-Press'),
      ])
      expect(result.margin).toBe(0)
      expect(result.reason).toBe('ambiguous')
      // ties sort by name
      expect(result.topCandidates.map((c) => c.name)).toEqual([
        'Bench Press',
        'Bench-Press',
      ])
    })
  })

  describe('equipment hints', () => {
    test('a typed equipment hint excludes candidates without that equipment', () => {
      const result = resolveExerciseName('dumbbell bench press', [
        exercise('Barbell Bench Press', { equipment: 'barbell' }),
        exercise('Bench Press', { equipment: 'barbell' }),
      ])
      expect(result.reason).toBe('no-candidates')
      expect(result.topCandidates).toEqual([])
    })

    test("the hint can come from the catalog's equipment field", () => {
      const result = resolveExerciseName('dumbbell bench press', [
        exercise('Barbell Bench Press', { equipment: 'barbell' }),
        exercise('Bench Press', { equipment: 'dumbbell' }),
      ])
      expect(result.topCandidates.map((c) => c.name)).toEqual(['Bench Press'])
      expect(result.topCandidates[0].equipmentHints).toEqual(['dumbbell'])
      // coverage 2/3, precision 1, substring +0.05, equipment +0.05 -> 0.7833
      expect(result.topCandidates[0].score).toBeCloseTo(0.7833, 3)
      expect(result.resolvedName).toBeNull()
    })

    test('the hint can come from the equipments array', () => {
      const result = resolveExerciseName('cable fly', [
        exercise('Chest Fly', {
          equipment: null,
          equipments: ['cable', 'machine'],
        } as Partial<Exercise>),
        exercise('Dumbbell Fly', { equipment: 'dumbbell' }),
      ])
      expect(result.topCandidates.map((c) => c.name)).toEqual(['Chest Fly'])
    })

    test('without a typed hint, equipment does not filter', () => {
      const result = resolveExerciseName('bench press', [
        exercise('Barbell Bench Press', { equipment: 'barbell' }),
        exercise('Dumbbell Bench Press', { equipment: 'dumbbell' }),
      ])
      expect(result.topCandidates).toHaveLength(2)
      expect(result.reason).toBe('ambiguous')
    })

    test('abbreviations like "db" are not equipment hints', () => {
      const result = resolveExerciseName('db press', [
        exercise('Dumbbell Shoulder Press', {
          aliases: ['DB Press'],
          equipment: 'dumbbell',
        }),
      ])
      expect(result.resolvedName).toBe('Dumbbell Shoulder Press')
      expect(result.reason).toBe('exact-alias')
    })
  })

  test('returns at most three candidates', () => {
    const result = resolveExerciseName('curl', [
      exercise('Curl A'),
      exercise('Curl B'),
      exercise('Curl C'),
      exercise('Curl D'),
    ])
    expect(result.topCandidates).toHaveLength(3)
  })
})

describe('parseExerciseBlockAtCursor', () => {
  test.each<
    [
      string,
      string,
      number,
      ReturnType<typeof parseExerciseBlockAtCursor>,
    ]
  >([
    [
      'name on cursor line with set lines below',
      'Bench Press\n100 x 5\n102,5x3\n\nSquat',
      5,
      {
        exerciseName: 'Bench Press',
        sets: [
          { weight: '100', reps: '5' },
          { weight: '102.5', reps: '3' },
        ],
        startLineIndex: 0,
        endLineIndex: 2,
      },
    ],
    [
      'falls back to the previous line when the cursor line is empty',
      'warmup done\nSquat\n',
      18,
      {
        exerciseName: 'Squat',
        sets: [{ weight: '', reps: '' }],
        startLineIndex: 1,
        endLineIndex: 1,
      },
    ],
    [
      'stops at the first non-set line',
      'Row\n60×10\nfelt good\n60 x 8',
      0,
      {
        exerciseName: 'Row',
        sets: [{ weight: '60', reps: '10' }],
        startLineIndex: 0,
        endLineIndex: 1,
      },
    ],
    ['empty text', '', 0, null],
    ['two empty lines', 'Squat\n\n', 7, null],
  ])('%s', (_label, text, cursor, expected) => {
    expect(parseExerciseBlockAtCursor(text, cursor)).toEqual(expected)
  })
})
