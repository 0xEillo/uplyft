import { useMemo } from 'react'

import { fuzzySearchExercises } from '@/lib/utils/fuzzy-search'

import { Exercise } from '@/types/database.types'

export interface ExerciseSuggestion {
  name: string
  inputLength: number
}

export interface ExerciseVariationSuggestion {
  name: string
  label: string
}

export interface ExerciseAutocompleteGroup {
  input: string
  primary: ExerciseSuggestion | null
  baseName: string | null
  variations: ExerciseVariationSuggestion[]
}

function getExerciseNameParts(name: string): {
  baseName: string
  variation: string | null
} {
  const match = name.match(/^(.*?)(?:\s*\(([^)]+)\))\s*$/)
  if (match) {
    return {
      baseName: match[1].trim(),
      variation: match[2].trim(),
    }
  }
  return { baseName: name.trim(), variation: null }
}

function tokenizeExerciseName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function getVariationRank(variation: string | null): number {
  if (!variation) return 3

  const normalized = variation.toLowerCase()

  if (normalized.includes('barbell')) return 0
  if (normalized.includes('dumbbell')) return 1
  if (normalized.includes('bodyweight') || normalized.includes('body weight')) {
    return 2
  }
  if (normalized.includes('smith')) return 4
  if (normalized.includes('machine')) return 5
  if (normalized.includes('cable')) return 6
  return 7
}

function rankAutocompleteMatches(
  matches: Exercise[],
  normalizedInput: string,
  exercises: Exercise[],
): Exercise[] {
  if (matches.length <= 1) return matches

  const baseNameFrequency = new Map<string, number>()
  exercises.forEach((exercise) => {
    const key = getExerciseNameParts(exercise.name).baseName.toLowerCase()
    baseNameFrequency.set(key, (baseNameFrequency.get(key) ?? 0) + 1)
  })

  type Ranked = {
    exercise: Exercise
    originalIndex: number
    startsWithInput: boolean
    tokenStartsWithInput: boolean
    baseFrequency: number
    variationRank: number
    nameLength: number
  }

  const ranked: Ranked[] = matches.map((exercise, originalIndex) => {
    const nameLower = exercise.name.toLowerCase()
    const tokens = tokenizeExerciseName(exercise.name)
    const parts = getExerciseNameParts(exercise.name)
    const baseKey = parts.baseName.toLowerCase()

    return {
      exercise,
      originalIndex,
      startsWithInput: nameLower.startsWith(normalizedInput),
      tokenStartsWithInput: tokens.some((token) =>
        token.startsWith(normalizedInput),
      ),
      baseFrequency: baseNameFrequency.get(baseKey) ?? 1,
      variationRank: getVariationRank(parts.variation),
      nameLength: exercise.name.length,
    }
  })

  ranked.sort((a, b) => {
    if (a.startsWithInput !== b.startsWithInput) {
      return a.startsWithInput ? -1 : 1
    }
    if (a.tokenStartsWithInput !== b.tokenStartsWithInput) {
      return a.tokenStartsWithInput ? -1 : 1
    }
    if (a.baseFrequency !== b.baseFrequency) {
      return b.baseFrequency - a.baseFrequency
    }
    if (a.variationRank !== b.variationRank) {
      return a.variationRank - b.variationRank
    }
    if (a.originalIndex !== b.originalIndex) {
      return a.originalIndex - b.originalIndex
    }
    if (a.nameLength !== b.nameLength) {
      return a.nameLength - b.nameLength
    }
    return a.exercise.name.localeCompare(b.exercise.name)
  })

  return ranked.map((item) => item.exercise)
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
 * Get exercise suggestions and related variations based on current input.
 * Returns null if no valid suggestions are available.
 */
export function getExerciseAutocompleteGroup(
  text: string,
  cursorPos: number,
  exercises: Exercise[],
): ExerciseAutocompleteGroup | null {
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

  // Use fuzzy search to find matches
  // This allows for typos and non-prefix matches
  const fuzzyMatches = fuzzySearchExercises(exercises, trimmedPrefix, {
    preferRecent: true,
  })
  const matches = rankAutocompleteMatches(
    fuzzyMatches,
    normalizedInput,
    exercises,
  )

  if (!matches.length) return null

  const firstMatch = matches[0]
  
  // Only show inline primary suggestion if it's a prefix match
  // Otherwise the ghost text overlay won't align with what the user typed (e.g. typos)
  const isPrefixMatch = firstMatch.name.toLowerCase().startsWith(normalizedInput)
  
  const primary =
    isPrefixMatch && firstMatch.name.toLowerCase() !== normalizedInput
      ? { name: firstMatch.name, inputLength: trimmedPrefix.length }
      : null

  const firstParts = getExerciseNameParts(firstMatch.name)
  const baseName = firstParts.baseName || null
  const baseKey = baseName ? baseName.toLowerCase() : null

  // We use all fuzzy matches found
  const groupedMatches = matches

  const seen = new Set<string>()
  const variations = groupedMatches.reduce<ExerciseVariationSuggestion[]>(
    (acc, ex) => {
      if (seen.has(ex.name)) return acc
      seen.add(ex.name)

      const parts = getExerciseNameParts(ex.name)
      const isSameBase = parts.baseName.toLowerCase() === baseKey
      
      let label: string

      if (isSameBase) {
        // If it shares the same base name as the primary match, 
        // we can use the short variation name (e.g. "Dumbbell")
        label = parts.variation || (groupedMatches.length > 1 ? 'Standard' : parts.baseName)
      } else {
        // If it has a different base name (e.g. "Bench Dip" vs "Bench Press"), 
        // we should show the full name to avoid confusion
        label = ex.name
      }

      acc.push({ name: ex.name, label })
      return acc
    },
    [],
  )

  return {
    input: trimmedPrefix,
    primary,
    baseName,
    variations,
  }
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
  const group = getExerciseAutocompleteGroup(text, cursorPos, exercises)
  return group?.primary ?? null
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
 * Hook for exercise autocomplete groups (primary suggestion + variations).
 */
export function useExerciseAutocompleteGroup({
  text,
  cursorPosition,
  exercises,
  isInputFocused,
}: UseExerciseAutocompleteOptions): ExerciseAutocompleteGroup | null {
  return useMemo(() => {
    if (!isInputFocused) return null
    return getExerciseAutocompleteGroup(text, cursorPosition, exercises)
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
