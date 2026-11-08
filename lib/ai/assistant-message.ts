/**
 * Client-side parser for the coach chat server's reply format.
 *
 * The format is defined by the chat edge function's system prompt
 * (supabase/functions/chat/system-prompt.ts). An assistant reply is free text
 * that may carry machine-readable blocks:
 *
 * - a trailing JSON array of exercise suggestions,
 *   e.g. `[{"name": "Tricep Pushdown", "sets": 2, "reps": "10-12"}]`
 * - a `<food_log>{...}</food_log>` block when the user logged food
 * - a `<stats_report>{...}</stats_report>` block (legacy stats card)
 * - a whole-reply workout/program JSON object (`{"title": ...}`), which is
 *   parsed elsewhere (lib/ai/workoutParsing) and only hidden here.
 *
 * Replies arrive streamed, so every parser here must tolerate a truncated
 * reply: incomplete blocks are hidden from the visible text and yield no
 * payload rather than throwing.
 */

export interface ExerciseSuggestion {
  name: string
  sets: number
  reps: string
  notes?: string
}

export type FoodLogAction = 'log' | 'update_last'
export type FoodLogConfidence = 'low' | 'medium' | 'high'
export type FoodLogSource = 'text' | 'photo' | 'voice' | 'manual' | 'correction'
export type StatsTrend = 'up' | 'down' | 'flat'

export interface FoodLogPayload {
  action: FoodLogAction
  summary: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: FoodLogConfidence
  source: FoodLogSource
}

export interface StatsReportMetric {
  id: string
  label: string
  value: string
  delta?: string
  trend?: StatsTrend
}

export interface StatsReportLift {
  exercise: string
  value: string
  delta?: string
  trend?: StatsTrend
}

export interface StatsReportMuscle {
  muscle_group: string
  percentage: number
}

export interface StatsReportPayload {
  version: number
  title?: string
  period_label?: string
  summary?: string
  highlights: StatsReportMetric[]
  top_lifts: StatsReportLift[]
  muscle_balance: StatsReportMuscle[]
  focus_areas: string[]
}

export interface ParsedAssistantMessage {
  /** Reply text with every machine-readable block (complete or partial) removed. */
  visibleText: string
  exerciseSuggestions: ExerciseSuggestion[]
  foodLog: FoodLogPayload | null
  statsReport: StatsReportPayload | null
}

const JSON_BLOCK_REGEX = /(?:```(?:json)?\s*)?(\[\s*\{[\s\S]*?\}\s*\])(?:\s*```)?/
const FOOD_LOG_BLOCK_REGEX = /<food_log>([\s\S]*?)<\/food_log>/i
const STATS_REPORT_BLOCK_REGEX = /<stats_report>([\s\S]*?)<\/stats_report>/i

/**
 * Parse an assistant reply (complete or partially streamed) into its visible
 * text and structured payloads.
 */
export function parseAssistantMessage(
  content: string,
): ParsedAssistantMessage {
  return {
    visibleText: getVisibleAssistantMessageText(content),
    exerciseSuggestions: parseExerciseSuggestions(content),
    foodLog: parseFoodLogPayload(content),
    statsReport: parseStatsReportPayload(content),
  }
}

// ---------------------------------------------------------------------------
// Rep ranges
// ---------------------------------------------------------------------------

export type RepRange = {
  targetRepsMin: number | null
  targetRepsMax: number | null
}

export type ParseRepRangeOptions = {
  /**
   * How to read a non-range value.
   * - `'leading'` (default): `parseInt` semantics, so the value must start
   *   with a number ("10", "10 reps"); "AMRAP 10" yields nulls.
   * - `'anywhere'`: use the first number found anywhere ("AMRAP 10" → 10).
   */
  single?: 'leading' | 'anywhere'
}

const REP_RANGE_REGEX = /(\d+)\s*[-–]\s*(\d+)/

/**
 * Parse a rep target like "8-12", "8 - 12", "8–12" or "10" into min/max.
 * A single number yields min === max. Unparseable input yields nulls.
 */
export function parseRepRange(
  reps: string,
  options?: ParseRepRangeOptions,
): RepRange {
  const rangeMatch = reps.match(REP_RANGE_REGEX)
  if (rangeMatch) {
    return {
      targetRepsMin: parseInt(rangeMatch[1], 10),
      targetRepsMax: parseInt(rangeMatch[2], 10),
    }
  }

  let single = NaN
  if (options?.single === 'anywhere') {
    const singleMatch = reps.match(/(\d+)/)
    if (singleMatch) single = parseInt(singleMatch[1], 10)
  } else {
    single = parseInt(reps, 10)
  }

  if (!Number.isNaN(single)) {
    return { targetRepsMin: single, targetRepsMax: single }
  }

  return { targetRepsMin: null, targetRepsMax: null }
}

/** `parseRepRange` in the `{ repsMin, repsMax }` shape used by routine templates. */
export function parseRepTargets(reps: string): {
  repsMin: number | null
  repsMax: number | null
} {
  const { targetRepsMin, targetRepsMax } = parseRepRange(reps)
  return { repsMin: targetRepsMin, repsMax: targetRepsMax }
}

// ---------------------------------------------------------------------------
// Exercise suggestions
// ---------------------------------------------------------------------------

export function parseExerciseSuggestions(
  content: string,
): ExerciseSuggestion[] {
  const suggestions: ExerciseSuggestion[] = []

  // 1. Try to parse JSON block first (Most robust)
  // Match either code-blocked JSON or raw JSON array in text
  const jsonMatch = content.match(JSON_BLOCK_REGEX)

  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item.name && (item.sets || item.reps)) {
            suggestions.push({
              name: item.name,
              sets:
                typeof item.sets === 'number'
                  ? item.sets
                  : parseInt(item.sets || '3'),
              reps: item.reps?.toString() || '10',
            })
          }
        })

        // If we successfully parsed JSON, return immediately
        if (suggestions.length > 0) return suggestions
      }
    } catch {
      // Incomplete JSON during streaming is expected
    }
  }

  // 2. Fallback to Regex patterns for plain text responses
  const patterns = [
    // Bullet/Plain/Bold style: Name - Sets x Reps
    /(?:^|\n)[\s⋅•·\.-]*\**([^*\n]+?)\**\s*[-–:]\s*(\d+)\s*(?:sets?\s*[x×]\s*|x\s*)(\d+(?:-\d+)?)\s*(?:reps?)?/gi,

    // Numbered Loop style: 1. Name: 3x10
    /^\d+\.\s*([^:\n]+):\s*(\d+)\s*[x×]\s*(\d+(?:-\d+)?)/gim,

    // Narrative style: "Add Bench Press - 3 sets x 10"
    /(?:Add|Try|Include)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*[-–]\s*(\d+)\s*sets?\s*[x×]\s*(\d+(?:-\d+)?)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim()
      const sets = parseInt(match[2], 10)
      const reps = match[3]

      // Avoid duplicates
      if (
        !suggestions.some((s) => s.name.toLowerCase() === name.toLowerCase())
      ) {
        suggestions.push({ name, sets, reps })
      }
    }
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Visible text
// ---------------------------------------------------------------------------

export const stripFoodLogBlock = (content: string): string =>
  content
    .replace(/<food_log>[\s\S]*?<\/food_log>/gi, '')
    .replace(/<food_log>[\s\S]*$/i, '')
    .trim()

export const stripStatsReportBlock = (content: string): string =>
  content
    .replace(/<stats_report>[\s\S]*?<\/stats_report>/gi, '')
    .replace(/<stats_report>[\s\S]*$/i, '')
    .trim()

/**
 * The text to show in the chat bubble: strips food-log / stats-report blocks,
 * the exercise-suggestion JSON array, and anything from the start of a
 * (possibly still streaming) code fence, JSON array or workout/program JSON
 * object to the end of the reply.
 */
export const getVisibleAssistantMessageText = (content: string): string =>
  stripStatsReportBlock(stripFoodLogBlock(content))
    .replace(JSON_BLOCK_REGEX, '')
    .replace(/```(?:json|).*/gs, '')
    .replace(/\[\s*\{.*/gs, '')
    .replace(/\{\s*"exercises".*/gs, '')
    .replace(/\{\s*"title".*/gs, '')
    .trim()

// ---------------------------------------------------------------------------
// <stats_report>
// ---------------------------------------------------------------------------

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toStatsTrend = (value: unknown): StatsTrend | undefined => {
  if (value === 'up' || value === 'down' || value === 'flat') return value
  return undefined
}

export const parseStatsReportPayload = (
  content: string,
): StatsReportPayload | null => {
  const match = content.match(STATS_REPORT_BLOCK_REGEX)
  if (!match?.[1]) return null

  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.reduce<StatsReportMetric[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const row = item as Record<string, unknown>
          const label = toNonEmptyString(row.label)
          const value = toNonEmptyString(row.value)
          if (!label || !value) return acc
          acc.push({
            id: toNonEmptyString(row.id) || label.toLowerCase(),
            label,
            value,
            delta: toNonEmptyString(row.delta) || undefined,
            trend: toStatsTrend(row.trend),
          })
          return acc
        }, [])
      : []

    const topLifts = Array.isArray(parsed.top_lifts)
      ? parsed.top_lifts.reduce<StatsReportLift[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const row = item as Record<string, unknown>
          const exercise = toNonEmptyString(row.exercise)
          const value = toNonEmptyString(row.value)
          if (!exercise || !value) return acc
          acc.push({
            exercise,
            value,
            delta: toNonEmptyString(row.delta) || undefined,
            trend: toStatsTrend(row.trend),
          })
          return acc
        }, [])
      : []

    const muscleBalance = Array.isArray(parsed.muscle_balance)
      ? parsed.muscle_balance.reduce<StatsReportMuscle[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const row = item as Record<string, unknown>
          const muscleGroup = toNonEmptyString(row.muscle_group)
          const percentageRaw = Number(row.percentage)
          if (!muscleGroup || !Number.isFinite(percentageRaw)) return acc
          acc.push({
            muscle_group: muscleGroup,
            percentage: Math.max(0, Math.min(100, Math.round(percentageRaw))),
          })
          return acc
        }, [])
      : []

    const focusAreas = Array.isArray(parsed.focus_areas)
      ? parsed.focus_areas
          .map((item) => toNonEmptyString(item))
          .filter((item): item is string => Boolean(item))
      : []

    if (
      highlights.length === 0 &&
      topLifts.length === 0 &&
      muscleBalance.length === 0
    ) {
      return null
    }

    return {
      version:
        typeof parsed.version === 'number' && Number.isFinite(parsed.version)
          ? parsed.version
          : 1,
      title: toNonEmptyString(parsed.title) || undefined,
      period_label: toNonEmptyString(parsed.period_label) || undefined,
      summary: toNonEmptyString(parsed.summary) || undefined,
      highlights: highlights.slice(0, 4),
      top_lifts: topLifts.slice(0, 3),
      muscle_balance: muscleBalance.slice(0, 6),
      focus_areas: focusAreas.slice(0, 4),
    }
  } catch {
    console.warn('[WorkoutChat] Failed to parse <stats_report> payload block')
    return null
  }
}

// ---------------------------------------------------------------------------
// <food_log>
// ---------------------------------------------------------------------------

export const parseFoodLogPayload = (content: string): FoodLogPayload | null => {
  const match = content.match(FOOD_LOG_BLOCK_REGEX)
  if (!match?.[1]) return null

  try {
    const parsed = JSON.parse(match[1])
    const action: FoodLogAction =
      parsed?.action === 'update_last' ? 'update_last' : 'log'
    const confidence: FoodLogConfidence =
      parsed?.confidence === 'low' || parsed?.confidence === 'high'
        ? parsed.confidence
        : 'medium'
    const source: FoodLogSource =
      parsed?.source === 'photo' ||
      parsed?.source === 'voice' ||
      parsed?.source === 'manual' ||
      parsed?.source === 'correction'
        ? parsed.source
        : 'text'

    const summary = (parsed?.summary || '').toString().trim()
    if (!summary) return null

    const toSafe = (value: unknown) => {
      const num = Number(value)
      if (!Number.isFinite(num)) return 0
      return Math.max(0, Number(num.toFixed(1)))
    }

    return {
      action,
      summary,
      calories: toSafe(parsed?.calories),
      protein_g: toSafe(parsed?.protein_g),
      carbs_g: toSafe(parsed?.carbs_g),
      fat_g: toSafe(parsed?.fat_g),
      confidence,
      source,
    }
  } catch {
    return null
  }
}
