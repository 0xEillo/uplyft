/**
 * Converting a free-form notes block into a structured exercise in the
 * workout composer ("convert to structured"): find the exercise block at the
 * cursor and resolve the typed name against the exercise catalog.
 */
import type { Exercise } from '@/types/database.types'

/** Minimum score for a non-exact match to auto-resolve. */
export const HIGH_CONFIDENCE_SCORE = 0.93
/** Minimum lead over the runner-up for a non-exact match to auto-resolve. */
export const MIN_MARGIN = 0.12

export type ExerciseResolutionCandidate = {
  name: string
  score: number
  via: 'name' | 'alias'
  matchedText: string
  equipmentHints: string[]
}

export type ExerciseResolutionResult = {
  resolvedName: string | null
  reason:
    | 'empty-query'
    | 'no-candidates'
    | 'exact-name'
    | 'exact-alias'
    | 'high-confidence'
    | 'ambiguous'
    | 'low-confidence'
  topCandidates: ExerciseResolutionCandidate[]
  margin: number
}

export const EXERCISE_EQUIPMENT_HINTS = [
  'smith machine',
  'body weight',
  'bodyweight',
  'ez bar',
  'trap bar',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
] as const

function normalizeExerciseMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeExerciseMatchText(value: string): string[] {
  return normalizeExerciseMatchText(value).split(/\s+/).filter(Boolean)
}

function extractEquipmentHints(value: string): string[] {
  const normalized = normalizeExerciseMatchText(value)
  return EXERCISE_EQUIPMENT_HINTS.filter((hint) => normalized.includes(hint))
}

/**
 * Resolve a free-typed exercise name against the exercise catalog.
 *
 * Exact name/alias matches (after normalization) always resolve. Otherwise
 * candidates are scored by token coverage/precision; a candidate only
 * resolves when it scores >= HIGH_CONFIDENCE_SCORE and beats the runner-up by
 * >= MIN_MARGIN. If the typed name mentions equipment (e.g. "dumbbell"),
 * candidates that don't share that equipment are excluded entirely.
 */
export function resolveExerciseName(
  typedName: string,
  exercises: Exercise[],
): ExerciseResolutionResult {
  const normalizedQuery = normalizeExerciseMatchText(typedName)
  if (!normalizedQuery) {
    return {
      resolvedName: null,
      reason: 'empty-query',
      topCandidates: [],
      margin: 0,
    }
  }

  const queryTokens = tokenizeExerciseMatchText(typedName)
  const queryTokenSet = new Set(queryTokens)
  const queryEquipmentHints = extractEquipmentHints(typedName)
  const candidates: ExerciseResolutionCandidate[] = []

  for (const exercise of exercises) {
    const entries: {
      raw: string
      via: 'name' | 'alias'
    }[] = [
      { raw: exercise.name, via: 'name' },
      ...((exercise.aliases ?? [])
        .filter((alias): alias is string => Boolean(alias?.trim()))
        .map((alias) => ({ raw: alias, via: 'alias' as const }))),
    ]

    let bestCandidate: ExerciseResolutionCandidate | null = null

    for (const entry of entries) {
      const normalizedCandidate = normalizeExerciseMatchText(entry.raw)
      if (!normalizedCandidate) continue

      const candidateEquipmentHints = extractEquipmentHints(
        `${entry.raw} ${exercise.equipment ?? ''} ${(exercise.equipments ?? []).join(' ')}`,
      )

      if (
        queryEquipmentHints.length > 0 &&
        !queryEquipmentHints.some((hint) => candidateEquipmentHints.includes(hint))
      ) {
        continue
      }

      if (normalizedCandidate === normalizedQuery) {
        bestCandidate = {
          name: exercise.name,
          score: 1,
          via: entry.via,
          matchedText: entry.raw,
          equipmentHints: candidateEquipmentHints,
        }
        break
      }

      const candidateTokens = tokenizeExerciseMatchText(entry.raw)
      if (candidateTokens.length === 0) continue

      const candidateTokenSet = new Set(candidateTokens)
      const commonTokenCount = queryTokens.filter((token) =>
        candidateTokenSet.has(token),
      ).length

      if (commonTokenCount === 0) continue

      const coverage = commonTokenCount / queryTokens.length
      const precision = commonTokenCount / candidateTokens.length
      const exactTokenSet =
        coverage === 1 &&
        precision === 1 &&
        candidateTokenSet.size === queryTokenSet.size

      let score = coverage * 0.65 + precision * 0.25

      if (exactTokenSet) {
        score = Math.max(score, 0.97)
      } else if (
        normalizedCandidate.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedCandidate)
      ) {
        score += 0.05
      }

      if (
        queryEquipmentHints.length > 0 &&
        queryEquipmentHints.some((hint) => candidateEquipmentHints.includes(hint))
      ) {
        score += 0.05
      }

      const candidate: ExerciseResolutionCandidate = {
        name: exercise.name,
        score: Math.min(score, 0.99),
        via: entry.via,
        matchedText: entry.raw,
        equipmentHints: candidateEquipmentHints,
      }

      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate
      }
    }

    if (bestCandidate) {
      candidates.push(bestCandidate)
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  const topCandidates = candidates.slice(0, 3)
  const best = topCandidates[0]
  const runnerUp = topCandidates[1]
  const margin = best ? best.score - (runnerUp?.score ?? 0) : 0

  if (!best) {
    return {
      resolvedName: null,
      reason: 'no-candidates',
      topCandidates,
      margin,
    }
  }

  if (best.score === 1) {
    return {
      resolvedName: best.name,
      reason: best.via === 'alias' ? 'exact-alias' : 'exact-name',
      topCandidates,
      margin,
    }
  }

  if (best.score >= HIGH_CONFIDENCE_SCORE && margin >= MIN_MARGIN) {
    return {
      resolvedName: best.name,
      reason: 'high-confidence',
      topCandidates,
      margin,
    }
  }

  return {
    resolvedName: null,
    reason: margin < MIN_MARGIN ? 'ambiguous' : 'low-confidence',
    topCandidates,
    margin,
  }
}

export type ParsedExerciseBlock = {
  exerciseName: string
  sets: { weight?: string; reps?: string }[]
  /** First line (inclusive) of the exercise block in `text.split('\n')`. */
  startLineIndex: number
  /** Last line (inclusive) of the exercise block in `text.split('\n')`. */
  endLineIndex: number
}

/**
 * Parse the exercise block at the cursor in free-form workout notes: the
 * cursor's line (or the previous line when the cursor's line is empty) is the
 * exercise name, followed by consecutive "weight x reps" set lines.
 */
export function parseExerciseBlockAtCursor(
  text: string,
  cursorPos: number,
): ParsedExerciseBlock | null {
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

    // Try to parse set: "weight x reps" or "weight x reps reps" or "135 x 8"
    // Note: Weight pattern accepts both period and comma as decimal separators (e.g., "7.5" or "7,5")
    const setMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+)/i)

    if (setMatch) {
      // Normalize decimal separator: replace comma with period (for European locales)
      const rawWeight = setMatch[1]
      const weight = rawWeight.replace(',', '.')

      sets.push({
        weight,
        reps: setMatch[2],
      })
    } else {
      // If line doesn't match set pattern, stop
      break
    }
  }

  return {
    exerciseName,
    sets: sets.length > 0 ? sets : [{ weight: '', reps: '' }], // At least one empty set
    startLineIndex: startIndex,
    endLineIndex: startIndex + sets.length,
  }
}
