import { useMemo } from 'react'

import { Exercise } from '@/types/database.types'

export interface ExerciseSuggestion {
  name: string
  inputLength: number
}

/**
 * Detect if current line looks like an exercise name.
 * Used to determine if the "Convert to Structured" button should be shown.
 */
export function detectExerciseName(text: string, cursorPos: number): boolean {
  if (!text) return false

  const textBeforeCursor = text.substring(0, cursorPos)
  const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
  const currentLine = textBeforeCursor.substring(lastNewlineIndex + 1).trim()

  if (!currentLine) return false

  // Check if line looks like a set (has numbers, x, lbs/kg, etc)
  const setPattern = /(\d+|\d+\.\d+)\s*(x|×|lbs?|kg|reps?)/i
  if (setPattern.test(currentLine)) return false

  // Check if it's a reasonable length for an exercise name (2-50 chars)
  if (currentLine.length < 2 || currentLine.length > 50) return false

  // Check if previous line is empty or doesn't exist (exercise names are usually on their own line)
  if (lastNewlineIndex > 0) {
    const textBeforeCurrentLine = text.substring(0, lastNewlineIndex)
    const prevLineLastNewline = textBeforeCurrentLine.lastIndexOf('\n')
    const prevLine = textBeforeCurrentLine.substring(prevLineLastNewline + 1).trim()
    if (prevLine && !prevLine.match(setPattern)) return false
  }

  return true
}

/**
 * Get an exercise suggestion based on current input.
 * Returns null if no valid suggestion is available.
 */
export function getExerciseSuggestion(
  text: string,
  cursorPos: number,
  exercises: Exercise[],
): ExerciseSuggestion | null {
  if (!text || !exercises.length) return null

  // Find start of current line
  const textBeforeCursor = text.substring(0, cursorPos)
  const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
  const currentLineStart = lastNewlineIndex + 1

  // Get text from start of line to cursor
  const currentLinePrefix = textBeforeCursor.substring(currentLineStart)
  const trimmedPrefix = currentLinePrefix.trimStart()

  // Check text AFTER cursor on the current line
  const textAfterCursor = text.substring(cursorPos)
  const nextNewlineIndex = textAfterCursor.indexOf('\n')
  const currentLineSuffix =
    nextNewlineIndex === -1
      ? textAfterCursor
      : textAfterCursor.substring(0, nextNewlineIndex)

  // Only suggest if the cursor is at the end of the line or followed by whitespace
  if (currentLineSuffix.trim().length > 0) return null

  // Only suggest if at least 2 chars typed and prefix doesn't look like a set/numbers
  if (trimmedPrefix.length < 2) return null
  if (/^[\d\sxX.]+$/.test(trimmedPrefix)) return null
  if (/(\d+(?:\.\d+)?)\s*(?:x|×|lbs?|kg)/i.test(trimmedPrefix)) return null

  const normalizedInput = trimmedPrefix.toLowerCase()

  // Find best match - exact start match
  const match = exercises.find((ex) =>
    ex.name.toLowerCase().startsWith(normalizedInput),
  )

  // Only return if it's a strictly longer match
  if (match && match.name.toLowerCase() !== normalizedInput) {
    return { name: match.name, inputLength: trimmedPrefix.length }
  }

  return null
}

/**
 * Parse text around cursor to extract exercise name and sets.
 * Used for converting free-form text to structured workout format.
 */
export function parseExerciseFromText(
  text: string,
  cursorPos: number,
): {
  exerciseName: string
  sets: { weight?: string; reps?: string }[]
  startLineIndex: number
  endLineIndex: number
} | null {
  const lines = text.split('\n')
  const textBeforeCursor = text.substring(0, cursorPos)
  const linesBefore = textBeforeCursor.split('\n')
  const currentLineIndex = linesBefore.length - 1

  // Get exercise name (current line or previous line if current is empty)
  let exerciseName = lines[currentLineIndex]?.trim() || ''
  let startIndex = currentLineIndex

  // If current line is empty, look at previous line
  if (!exerciseName && currentLineIndex > 0) {
    exerciseName = lines[currentLineIndex - 1]?.trim() || ''
    startIndex = currentLineIndex - 1
  }

  if (!exerciseName) return null

  // Extract sets from following lines (until empty line or end)
  const sets: { weight?: string; reps?: string }[] = []
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) break // Stop at empty line

    // Try to parse set: "weight x reps"
    const setMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+)/i)
    if (setMatch) {
      sets.push({
        weight: setMatch[1],
        reps: setMatch[2],
      })
    } else {
      // If line doesn't match set pattern, stop
      break
    }
  }

  return {
    exerciseName,
    sets: sets.length > 0 ? sets : [{ weight: '', reps: '' }],
    startLineIndex: startIndex,
    endLineIndex: startIndex + sets.length,
  }
}

/**
 * Parse rep range from string like "10-12" or "10".
 */
export function parseRepRange(
  reps: string,
): { targetRepsMin: number | null; targetRepsMax: number | null } {
  const rangeMatch = reps.match(/(\d+)[-–](\d+)/)
  if (rangeMatch) {
    return {
      targetRepsMin: parseInt(rangeMatch[1], 10),
      targetRepsMax: parseInt(rangeMatch[2], 10),
    }
  }
  const singleRep = parseInt(reps, 10)
  if (!isNaN(singleRep)) {
    return { targetRepsMin: singleRep, targetRepsMax: singleRep }
  }
  return { targetRepsMin: null, targetRepsMax: null }
}

interface UseExerciseAutocompleteOptions {
  text: string
  cursorPosition: number
  exercises: Exercise[]
  isInputFocused: boolean
}

/**
 * Hook for exercise autocomplete functionality.
 * Returns the current suggestion based on input state.
 */
export function useExerciseAutocomplete({
  text,
  cursorPosition,
  exercises,
  isInputFocused,
}: UseExerciseAutocompleteOptions): ExerciseSuggestion | null {
  return useMemo(() => {
    if (!isInputFocused) return null
    return getExerciseSuggestion(text, cursorPosition, exercises)
  }, [text, cursorPosition, exercises, isInputFocused])
}

/**
 * Hook for detecting if current line is a potential exercise name.
 */
export function useShowConvertButton(
  text: string,
  cursorPosition: number,
  isInputFocused: boolean,
): boolean {
  return useMemo(() => {
    return isInputFocused && detectExerciseName(text, cursorPosition)
  }, [text, cursorPosition, isInputFocused])
}
