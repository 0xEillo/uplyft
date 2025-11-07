import AsyncStorage from '@react-native-async-storage/async-storage'

export const DRAFT_KEY = '@workout_draft'
export const TITLE_DRAFT_KEY = '@workout_title_draft'
export const PENDING_POST_KEY = '@pending_workout_post'
export const PLACEHOLDER_WORKOUT_KEY = '@placeholder_workout'

export type WeightUnit = 'kg' | 'lb'

export interface WorkoutDraft {
  notes: string
  title: string
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

export async function loadDraft(): Promise<WorkoutDraft | null> {
  const [notes, title] = await Promise.all([
    AsyncStorage.getItem(DRAFT_KEY),
    AsyncStorage.getItem(TITLE_DRAFT_KEY),
  ])

  if (!notes && !title) {
    return null
  }

  return {
    notes: notes ?? '',
    title: title ?? '',
  }
}

export async function saveDraft(draft: WorkoutDraft): Promise<void> {
  const { notes, title } = draft

  if (notes.trim()) {
    await AsyncStorage.setItem(DRAFT_KEY, notes)
  } else {
    await AsyncStorage.removeItem(DRAFT_KEY)
  }

  if (title.trim()) {
    await AsyncStorage.setItem(TITLE_DRAFT_KEY, title)
  } else {
    await AsyncStorage.removeItem(TITLE_DRAFT_KEY)
  }
}

export async function clearDraft(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(DRAFT_KEY),
    AsyncStorage.removeItem(TITLE_DRAFT_KEY),
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
