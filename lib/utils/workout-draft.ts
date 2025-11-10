import AsyncStorage from '@react-native-async-storage/async-storage'

export const DRAFT_KEY = '@workout_draft'
export const TITLE_DRAFT_KEY = '@workout_title_draft'
export const STRUCTURED_DRAFT_KEY = '@workout_structured_draft'
const WORKOUT_DRAFT_V2_KEY = '@workout_draft_v2'
export const PENDING_POST_KEY = '@pending_workout_post'
export const PLACEHOLDER_WORKOUT_KEY = '@placeholder_workout'

export type WeightUnit = 'kg' | 'lb'

export interface StructuredSetDraft {
  weight: string
  reps: string
  lastWorkoutWeight?: string | null
  lastWorkoutReps?: string | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
}

export interface StructuredExerciseDraft {
  id: string
  name: string
  sets: StructuredSetDraft[]
}

export interface WorkoutDraft {
  notes: string
  title: string
  structuredData?: StructuredExerciseDraft[]
  isStructuredMode?: boolean
  selectedRoutineId?: string | null
}

export interface PendingWorkout {
  notes: string
  title: string
  imageUrl: string | null
  weightUnit: WeightUnit
  userId: string
  idempotencyKey?: string
  routineId?: string | null
}

export interface PlaceholderWorkout {
  id: string
  title: string
  imageUrl: string | null
  created_at: string
  isPending: boolean
}

export function draftHasContent(draft?: WorkoutDraft | null): boolean {
  if (!draft) return false

  const notesLength = draft.notes?.trim().length ?? 0
  const titleLength = draft.title?.trim().length ?? 0
  const structuredLength = Array.isArray(draft.structuredData)
    ? draft.structuredData.length
    : 0

  // Only consider isStructuredMode as content if there's actual structured data
  // Only consider selectedRoutineId as content if there's actual structured data or a routine is selected
  return (
    notesLength > 0 ||
    titleLength > 0 ||
    structuredLength > 0 ||
    Boolean(draft.selectedRoutineId)
  )
}

export async function hasStoredDraft(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(WORKOUT_DRAFT_V2_KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as WorkoutDraft
      const hasContent = draftHasContent(parsed)
      if (hasContent) {
        return true
      }
    } catch {
      await AsyncStorage.removeItem(WORKOUT_DRAFT_V2_KEY)
    }
  }

  const [notes, title, structuredPayload] = await Promise.all([
    AsyncStorage.getItem(DRAFT_KEY),
    AsyncStorage.getItem(TITLE_DRAFT_KEY),
    AsyncStorage.getItem(STRUCTURED_DRAFT_KEY),
  ])

  if (
    (notes && notes.trim().length > 0) ||
    (title && title.trim().length > 0)
  ) {
    return true
  }

  if (structuredPayload) {
    try {
      const parsed = JSON.parse(structuredPayload) as {
        structuredData?: StructuredExerciseDraft[]
        isStructuredMode?: boolean
        selectedRoutineId?: string | null
      }

      const combinedDraft: WorkoutDraft = {
        notes: notes ?? '',
        title: title ?? '',
        structuredData: parsed.structuredData ?? [],
        isStructuredMode: parsed.isStructuredMode,
        selectedRoutineId: parsed.selectedRoutineId,
      }
      return draftHasContent(combinedDraft)
    } catch {
      await AsyncStorage.removeItem(STRUCTURED_DRAFT_KEY)
    }
  }

  return false
}

export async function loadDraft(): Promise<WorkoutDraft | null> {
  const stored = await AsyncStorage.getItem(WORKOUT_DRAFT_V2_KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as WorkoutDraft
      const normalized: WorkoutDraft = {
        notes: parsed.notes ?? '',
        title: parsed.title ?? '',
        structuredData: Array.isArray(parsed.structuredData)
          ? parsed.structuredData
          : [],
        isStructuredMode: Boolean(parsed.isStructuredMode),
        selectedRoutineId:
          typeof parsed.selectedRoutineId === 'string'
            ? parsed.selectedRoutineId
            : null,
      }

      return draftHasContent(normalized) ? normalized : null
    } catch {
      await AsyncStorage.removeItem(WORKOUT_DRAFT_V2_KEY)
    }
  }

  const [notes, title, structuredPayload] = await Promise.all([
    AsyncStorage.getItem(DRAFT_KEY),
    AsyncStorage.getItem(TITLE_DRAFT_KEY),
    AsyncStorage.getItem(STRUCTURED_DRAFT_KEY),
  ])

  if (!notes && !title && !structuredPayload) {
    return null
  }

  let structuredData: StructuredExerciseDraft[] = []
  let isStructuredMode = false
  let selectedRoutineId: string | null = null

  if (structuredPayload) {
    try {
      const parsed = JSON.parse(structuredPayload) as {
        structuredData?: StructuredExerciseDraft[]
        isStructuredMode?: boolean
        selectedRoutineId?: string | null
      }

      if (Array.isArray(parsed.structuredData)) {
        structuredData = parsed.structuredData
      }

      if (typeof parsed.isStructuredMode === 'boolean') {
        isStructuredMode = parsed.isStructuredMode
      }

      if (
        typeof parsed.selectedRoutineId === 'string' ||
        parsed.selectedRoutineId === null
      ) {
        selectedRoutineId = parsed.selectedRoutineId ?? null
      }
    } catch {
      await AsyncStorage.removeItem(STRUCTURED_DRAFT_KEY)
    }
  }

  const fallbackDraft: WorkoutDraft = {
    notes: notes ?? '',
    title: title ?? '',
    structuredData,
    isStructuredMode,
    selectedRoutineId,
  }

  if (!draftHasContent(fallbackDraft)) {
    await clearDraft()
    return null
  }

  await saveDraft(fallbackDraft)
  return fallbackDraft
}

export async function saveDraft(draft: WorkoutDraft): Promise<void> {
  const {
    notes,
    title,
    structuredData = [],
    isStructuredMode = false,
    selectedRoutineId = null,
  } = draft

  const normalized: WorkoutDraft = {
    notes: notes ?? '',
    title: title ?? '',
    structuredData: Array.isArray(structuredData) ? structuredData : [],
    isStructuredMode,
    selectedRoutineId,
  }

  if (!draftHasContent(normalized)) {
    await clearDraft()
    return
  }

  await AsyncStorage.setItem(WORKOUT_DRAFT_V2_KEY, JSON.stringify(normalized))

  await Promise.all([
    AsyncStorage.removeItem(DRAFT_KEY),
    AsyncStorage.removeItem(TITLE_DRAFT_KEY),
    AsyncStorage.removeItem(STRUCTURED_DRAFT_KEY),
  ])
}

export async function clearDraft(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(WORKOUT_DRAFT_V2_KEY),
    AsyncStorage.removeItem(DRAFT_KEY),
    AsyncStorage.removeItem(TITLE_DRAFT_KEY),
    AsyncStorage.removeItem(STRUCTURED_DRAFT_KEY),
  ])
}

export async function loadPendingWorkout(): Promise<PendingWorkout | null> {
  const data = await AsyncStorage.getItem(PENDING_POST_KEY)
  if (!data) return null

  try {
    return JSON.parse(data) as PendingWorkout
  } catch (error) {
    console.error('Failed to parse pending workout payload', error)
    await AsyncStorage.removeItem(PENDING_POST_KEY)
    return null
  }
}

export async function savePendingWorkout(
  pending: PendingWorkout,
): Promise<void> {
  await AsyncStorage.setItem(PENDING_POST_KEY, JSON.stringify(pending))
}

export async function clearPendingWorkout(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_POST_KEY)
}

export async function loadPlaceholderWorkout(): Promise<PlaceholderWorkout | null> {
  const data = await AsyncStorage.getItem(PLACEHOLDER_WORKOUT_KEY)
  if (!data) return null

  try {
    return JSON.parse(data) as PlaceholderWorkout
  } catch (error) {
    console.error('Failed to parse placeholder workout payload', error)
    await AsyncStorage.removeItem(PLACEHOLDER_WORKOUT_KEY)
    return null
  }
}

export async function savePlaceholderWorkout(
  placeholder: PlaceholderWorkout,
): Promise<void> {
  await AsyncStorage.setItem(
    PLACEHOLDER_WORKOUT_KEY,
    JSON.stringify(placeholder),
  )
}

export async function clearPlaceholderWorkout(): Promise<void> {
  await AsyncStorage.removeItem(PLACEHOLDER_WORKOUT_KEY)
}

export async function clearPendingArtifacts(): Promise<void> {
  await Promise.all([clearPendingWorkout(), clearPlaceholderWorkout()])
}

export function createPlaceholderWorkout(
  title: string,
  imageUrl: string | null,
): PlaceholderWorkout {
  return {
    id: `temp-${Date.now()}`,
    title,
    imageUrl,
    created_at: new Date().toISOString(),
    isPending: true,
  }
}
