import { selectNotesToParse } from '../supabase/functions/parse-workout/notes-selection'

describe('selectNotesToParse', () => {
  test('uses parserNotes when structured payload is valid', () => {
    const result = selectNotesToParse({
      notes: 'structured text + notes',
      parserNotes: 'free-form notes only',
      hasStructuredParsed: true,
    })

    expect(result).toBe('free-form notes only')
  })

  test('falls back to raw notes for backward compatibility when structured parse failed', () => {
    const result = selectNotesToParse({
      notes: 'raw combined notes',
      parserNotes: 'free-form notes only',
      hasStructuredParsed: false,
    })

    expect(result).toBe('raw combined notes')
  })

  test('falls back to raw notes when parserNotes is absent', () => {
    const result = selectNotesToParse({
      notes: 'raw notes',
      hasStructuredParsed: true,
    })

    expect(result).toBe('raw notes')
  })

  test('allows empty parserNotes string when structured payload is valid', () => {
    const result = selectNotesToParse({
      notes: 'raw notes',
      parserNotes: '',
      hasStructuredParsed: true,
    })

    expect(result).toBe('')
  })
})
