import {
  getVisibleAssistantMessageText,
  parseAssistantMessage,
  parseExerciseSuggestions,
  parseFoodLogPayload,
  parseRepRange,
  parseRepTargets,
  parseStatsReportPayload,
} from '@/lib/ai/assistant-message'

// Reply shapes taken from supabase/functions/chat/system-prompt.ts
// ("EXERCISE SUGGESTIONS FORMAT" and "NUTRITION LOGGING").
const SUGGESTION_REPLY =
  "I'd suggest adding some tricep work to balance your push day. Here are a couple options:\n" +
  '[{"name": "Tricep Pushdown", "sets": 2, "reps": "10-12"}, {"name": "Overhead Tricep Extension", "sets": 2, "reps": "10-12"}]'

const FOOD_LOG_REPLY =
  'Nice, solid breakfast. That puts you on track for protein today.\n' +
  '<food_log>{"action":"log","summary":"Greek yogurt with berries and granola","calories":450,"protein_g":35,"carbs_g":38,"fat_g":16,"confidence":"medium","source":"text"}</food_log>'

const STATS_REPORT_REPLY =
  'Great month of training. Here is your snapshot.\n' +
  '<stats_report>{"version":1,"title":"Monthly report","period_label":"Last 30 days","highlights":[{"id":"workouts","label":"Workouts","value":"12","delta":"+2","trend":"up"}],"top_lifts":[{"exercise":"Bench Press","value":"100 kg","trend":"flat"}],"muscle_balance":[{"muscle_group":"Chest","percentage":31.6}],"focus_areas":["Hamstrings"]}</stats_report>'

describe('parseRepRange', () => {
  test.each<[string, number | null, number | null]>([
    ['8-12', 8, 12],
    ['8 - 12', 8, 12],
    ['8–12', 8, 12],
    ['8 – 12', 8, 12],
    ['6-8 reps', 6, 8],
    ['10', 10, 10],
    ['10 reps', 10, 10],
    [' 10', 10, 10],
    ['AMRAP', null, null],
    ['', null, null],
    ['AMRAP 10', null, null],
  ])('%p -> %p..%p', (input, min, max) => {
    expect(parseRepRange(input)).toEqual({
      targetRepsMin: min,
      targetRepsMax: max,
    })
  })

  test.each<[string, number | null, number | null]>([
    ['AMRAP 10', 10, 10],
    ['~12', 12, 12],
    ['8 - 12', 8, 12],
    ['to failure', null, null],
  ])("single: 'anywhere' %p -> %p..%p", (input, min, max) => {
    expect(parseRepRange(input, { single: 'anywhere' })).toEqual({
      targetRepsMin: min,
      targetRepsMax: max,
    })
  })

  test('parseRepTargets adapts to the { repsMin, repsMax } shape', () => {
    expect(parseRepTargets('10 - 12')).toEqual({ repsMin: 10, repsMax: 12 })
    expect(parseRepTargets('x')).toEqual({ repsMin: null, repsMax: null })
  })
})

describe('parseExerciseSuggestions', () => {
  test.each<[string, string, { name: string; sets: number; reps: string }[]]>([
    [
      'trailing JSON array (system-prompt format)',
      SUGGESTION_REPLY,
      [
        { name: 'Tricep Pushdown', sets: 2, reps: '10-12' },
        { name: 'Overhead Tricep Extension', sets: 2, reps: '10-12' },
      ],
    ],
    [
      'fenced JSON array',
      'Try these:\n```json\n[{"name": "Cable Fly", "sets": "3", "reps": 12}]\n```',
      [{ name: 'Cable Fly', sets: 3, reps: '12' }],
    ],
    [
      'JSON entry missing sets falls back to 3',
      '[{"name": "Leg Curl", "reps": "10-12"}]',
      [{ name: 'Leg Curl', sets: 3, reps: '10-12' }],
    ],
    // The plain-text fallbacks below pin existing (quirky) behaviour.
    [
      'plain-text bullet fallback (trailing \\s* eats the next newline)',
      'Options:\n- Barbell Row - 3 sets x 8-10\n- Face Pull: 2x15',
      [{ name: 'Barbell Row', sets: 3, reps: '8-10' }],
    ],
    [
      'plain-text bullets with text after the reps',
      '- Barbell Row - 3 sets x 8-10 reps, slow\n- Face Pull: 2x15',
      [
        { name: 'Barbell Row', sets: 3, reps: '8-10' },
        { name: 'Face Pull', sets: 2, reps: '15' },
      ],
    ],
    [
      'numbered fallback (also caught by the bullet pattern)',
      '1. Romanian Deadlift: 3x8',
      [
        { name: '1. Romanian Deadlift', sets: 3, reps: '8' },
        { name: 'Romanian Deadlift', sets: 3, reps: '8' },
      ],
    ],
    ['plain prose', 'Progressive overload means adding load over time.', []],
    [
      'truncated JSON mid-stream yields nothing',
      "Here are a couple options:\n[{\"name\": \"Tricep Pushdown\", \"sets\": 2, \"reps\": \"10-",
      [],
    ],
  ])('%s', (_label, content, expected) => {
    expect(parseExerciseSuggestions(content)).toEqual(expected)
  })
})

describe('getVisibleAssistantMessageText', () => {
  test.each<[string, string, string]>([
    [
      'strips trailing suggestion array',
      SUGGESTION_REPLY,
      "I'd suggest adding some tricep work to balance your push day. Here are a couple options:",
    ],
    [
      'hides a partially streamed suggestion array',
      'Here are a couple options:\n[{"name": "Tricep Pu',
      'Here are a couple options:',
    ],
    [
      'strips a complete food_log block',
      FOOD_LOG_REPLY,
      'Nice, solid breakfast. That puts you on track for protein today.',
    ],
    [
      'hides an unterminated food_log block',
      'Logged it.\n<food_log>{"action":"log","summary":"Oat',
      'Logged it.',
    ],
    [
      'strips a stats_report block',
      STATS_REPORT_REPLY,
      'Great month of training. Here is your snapshot.',
    ],
    [
      'hides an unterminated stats_report block',
      'Snapshot below.\n<stats_report>{"version":1,',
      'Snapshot below.',
    ],
    [
      'hides a streaming workout JSON object',
      '{"title": "Push Day", "description": "Chest focus", "exercises": [',
      '',
    ],
    [
      'hides a streaming code fence',
      'Here you go:\n```json\n{"title"',
      'Here you go:',
    ],
    ['leaves plain text untouched', '  Rest 2-3 minutes.  ', 'Rest 2-3 minutes.'],
  ])('%s', (_label, content, expected) => {
    expect(getVisibleAssistantMessageText(content)).toBe(expected)
  })
})

describe('parseFoodLogPayload', () => {
  test('parses the system-prompt example', () => {
    expect(parseFoodLogPayload(FOOD_LOG_REPLY)).toEqual({
      action: 'log',
      summary: 'Greek yogurt with berries and granola',
      calories: 450,
      protein_g: 35,
      carbs_g: 38,
      fat_g: 16,
      confidence: 'medium',
      source: 'text',
    })
  })

  test('normalizes unknown enums and unsafe numbers', () => {
    expect(
      parseFoodLogPayload(
        '<FOOD_LOG>{"action":"update_last","summary":" Cauliflower rice ","calories":"120.46","protein_g":-4,"carbs_g":null,"fat_g":"x","confidence":"sure","source":"fax"}</FOOD_LOG>',
      ),
    ).toEqual({
      action: 'update_last',
      summary: 'Cauliflower rice',
      calories: 120.5,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      confidence: 'medium',
      source: 'text',
    })
  })

  test.each([
    ['no block', 'Just text'],
    ['unterminated block', '<food_log>{"action":"log","summary":"Oat'],
    ['invalid JSON', '<food_log>{nope}</food_log>'],
    ['empty summary', '<food_log>{"summary":"  "}</food_log>'],
  ])('returns null for %s', (_label, content) => {
    expect(parseFoodLogPayload(content)).toBeNull()
  })
})

describe('parseStatsReportPayload', () => {
  test('parses and clamps a stats report', () => {
    expect(parseStatsReportPayload(STATS_REPORT_REPLY)).toEqual({
      version: 1,
      title: 'Monthly report',
      period_label: 'Last 30 days',
      summary: undefined,
      highlights: [
        {
          id: 'workouts',
          label: 'Workouts',
          value: '12',
          delta: '+2',
          trend: 'up',
        },
      ],
      top_lifts: [
        {
          exercise: 'Bench Press',
          value: '100 kg',
          delta: undefined,
          trend: 'flat',
        },
      ],
      muscle_balance: [{ muscle_group: 'Chest', percentage: 32 }],
      focus_areas: ['Hamstrings'],
    })
  })

  test('returns null when there is nothing to show', () => {
    expect(
      parseStatsReportPayload(
        '<stats_report>{"version":2,"focus_areas":["Back"]}</stats_report>',
      ),
    ).toBeNull()
  })

  test('returns null without warning for an unterminated block', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      parseStatsReportPayload('<stats_report>{"version":1,"highlights":['),
    ).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('warns and returns null on invalid JSON', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      parseStatsReportPayload('<stats_report>{oops}</stats_report>'),
    ).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('parseAssistantMessage', () => {
  test('suggestion reply', () => {
    const parsed = parseAssistantMessage(SUGGESTION_REPLY)
    expect(parsed.visibleText).toBe(
      "I'd suggest adding some tricep work to balance your push day. Here are a couple options:",
    )
    expect(parsed.exerciseSuggestions.map((s) => s.name)).toEqual([
      'Tricep Pushdown',
      'Overhead Tricep Extension',
    ])
    expect(parsed.foodLog).toBeNull()
    expect(parsed.statsReport).toBeNull()
  })

  test('food log reply', () => {
    const parsed = parseAssistantMessage(FOOD_LOG_REPLY)
    expect(parsed.visibleText).toBe(
      'Nice, solid breakfast. That puts you on track for protein today.',
    )
    expect(parsed.foodLog?.calories).toBe(450)
    expect(parsed.exerciseSuggestions).toEqual([])
  })

  test('every streamed prefix of a reply parses without throwing', () => {
    const full = `${FOOD_LOG_REPLY}\n${SUGGESTION_REPLY}`
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i <= full.length; i++) {
      const parsed = parseAssistantMessage(full.slice(0, i))
      expect(parsed.visibleText).not.toContain('<food_log>')
      expect(parsed.visibleText).not.toContain('[{')
    }
    warn.mockRestore()
  })

  test('empty reply', () => {
    expect(parseAssistantMessage('')).toEqual({
      visibleText: '',
      exerciseSuggestions: [],
      foodLog: null,
      statsReport: null,
    })
  })
})
