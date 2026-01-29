import { MMKV } from 'react-native-mmkv'

export const PENDING_POST_KEY = '@pending_workout_post'
export const PLACEHOLDER_WORKOUT_KEY = '@placeholder_workout'
const WORKOUT_DRAFT_SNAPSHOT_KEY = '@workout_draft_snapshot'
const WORKOUT_DRAFT_OPS_KEY = '@workout_draft_ops'

const storage = new MMKV({ id: 'workout-draft' })

export type WeightUnit = 'kg' | 'lb'

export interface StructuredSetDraft {
  weight: string
  reps: string
  isWarmup?: boolean
  lastWorkoutWeight?: string | null
  lastWorkoutReps?: string | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
  targetRestSeconds?: number | null
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
  timerStartedAt?: string | null
  timerElapsedSeconds?: number
  updatedAt?: number
}

export type DraftPatch = Partial<WorkoutDraft> & {
  updatedAt?: number
}

type DraftOp = {
  ts: number
  patch: DraftPatch
}

function readJson<T>(key: string): T | null {
  const raw = storage.getString(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value))
}

function removeKey(key: string): void {
  storage.delete(key)
}

function applyPatch(base: WorkoutDraft, patch: DraftPatch): WorkoutDraft {
  return {
    ...base,
    ...patch,
    notes: patch.notes ?? base.notes ?? '',
    title: patch.title ?? base.title ?? '',
    structuredData: Array.isArray(patch.structuredData)
      ? patch.structuredData
      : base.structuredData ?? [],
    isStructuredMode:
      typeof patch.isStructuredMode === 'boolean'
        ? patch.isStructuredMode
        : base.isStructuredMode ?? false,
    selectedRoutineId:
      typeof patch.selectedRoutineId === 'string' || patch.selectedRoutineId === null
        ? patch.selectedRoutineId ?? null
        : base.selectedRoutineId ?? null,
    timerStartedAt:
      typeof patch.timerStartedAt === 'string' || patch.timerStartedAt === null
        ? patch.timerStartedAt ?? null
        : base.timerStartedAt ?? null,
    timerElapsedSeconds:
      typeof patch.timerElapsedSeconds === 'number'
        ? patch.timerElapsedSeconds
        : base.timerElapsedSeconds ?? 0,
    updatedAt:
      typeof patch.updatedAt === 'number'
        ? patch.updatedAt
        : base.updatedAt ?? 0,
  }
}

export interface PendingWorkout {
  notes: string
  title: string
  imageUrl: string | null
  weightUnit: WeightUnit
  userId: string
  idempotencyKey?: string
  routineId?: string | null
  durationSeconds?: number | null
  description?: string
  structuredData?: StructuredExerciseDraft[]
  isStructuredMode?: boolean
  /** ISO timestamp when the workout was logged locally (for offline support) */
  performedAt: string
  /** Local timezone offset in minutes (e.g., -300 for EST) */
  timezoneOffsetMinutes: number
}

export interface PlaceholderWorkout {
  id: string
  title: string
  imageUrl: string | null
  created_at: string
  isPending: boolean
  user_id: string
  profile: {
    display_name: string
    avatar_url: string | null
  } | null
}

export function draftHasContent(draft?: WorkoutDraft | null): boolean {
  if (!draft) return false

  const notesLength = draft.notes?.trim().length ?? 0
  const titleLength = draft.title?.trim().length ?? 0

  // Consider a routine/template selection as content so we don't drop it on navigation
  const hasRoutineSelection =
    typeof draft.selectedRoutineId === 'string' &&
    draft.selectedRoutineId.trim().length > 0

  // Consider structured template rows as content, even if sets are still empty
  // This is CRITICAL: exercises added manually (not from a routine) must be preserved
  // even before the user fills in weight/reps data
  const hasStructuredSkeleton =
    Array.isArray(draft.structuredData) && draft.structuredData.length > 0

  // Stronger signal: user started entering set data
  const hasStructuredContent =
    hasStructuredSkeleton &&
    (draft.structuredData?.some((exercise) =>
      exercise.sets.some((set) => set.weight.trim() || set.reps.trim()),
    ) ??
      false)

  // Count as "draft" if there's:
  // - Text input (notes or title)
  // - A routine selected
  // - Exercises in the structured data (even with empty sets - user has actively added them)
  // Note: hasStructuredSkeleton ensures we preserve exercises added manually before user
  // fills in any weight/reps. This prevents data loss on page refresh or app backgrounding.
  return (
    notesLength > 0 ||
    titleLength > 0 ||
    hasStructuredSkeleton ||
    hasRoutineSelection
  )
}

export async function hasStoredDraft(): Promise<boolean> {
  const draft = await loadDraft()
  return draftHasContent(draft)
}

export async function loadDraft(): Promise<WorkoutDraft | null> {
  const snapshot = readJson<WorkoutDraft>(WORKOUT_DRAFT_SNAPSHOT_KEY)
  const ops = readJson<DraftOp[]>(WORKOUT_DRAFT_OPS_KEY) ?? []

  let merged: WorkoutDraft = {
    notes: snapshot?.notes ?? '',
    title: snapshot?.title ?? '',
    structuredData: Array.isArray(snapshot?.structuredData)
      ? snapshot?.structuredData
      : [],
    isStructuredMode: Boolean(snapshot?.isStructuredMode),
    selectedRoutineId:
      typeof snapshot?.selectedRoutineId === 'string'
        ? snapshot?.selectedRoutineId
        : null,
    timerStartedAt:
      typeof snapshot?.timerStartedAt === 'string'
        ? snapshot?.timerStartedAt
        : null,
    timerElapsedSeconds:
      typeof snapshot?.timerElapsedSeconds === 'number'
        ? snapshot?.timerElapsedSeconds
        : 0,
    updatedAt: typeof snapshot?.updatedAt === 'number' ? snapshot?.updatedAt : 0,
  }

  if (Array.isArray(ops)) {
    ops.forEach((op) => {
      if (op?.patch) {
        merged = applyPatch(merged, op.patch)
      }
    })
  }

  if (draftHasContent(merged)) {
    return merged
  }

  return null
}

export async function saveDraft(draft: WorkoutDraft): Promise<void> {
  const {
    notes,
    title,
    structuredData = [],
    isStructuredMode = false,
    selectedRoutineId = null,
    timerStartedAt = null,
    timerElapsedSeconds = 0,
    updatedAt,
  } = draft

  const normalized: WorkoutDraft = {
    notes: notes ?? '',
    title: title ?? '',
    structuredData: Array.isArray(structuredData) ? structuredData : [],
    isStructuredMode,
    selectedRoutineId,
    timerStartedAt: typeof timerStartedAt === 'string' ? timerStartedAt : null,
    timerElapsedSeconds:
      typeof timerElapsedSeconds === 'number' ? timerElapsedSeconds : 0,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
  }

  if (!draftHasContent(normalized)) {
    await clearDraft()
    return
  }

  writeJson(WORKOUT_DRAFT_SNAPSHOT_KEY, normalized)
  removeKey(WORKOUT_DRAFT_OPS_KEY)
}

export async function saveDraftPatch(patch: DraftPatch): Promise<void> {
  const ops = readJson<DraftOp[]>(WORKOUT_DRAFT_OPS_KEY) ?? []
  const op: DraftOp = {
    ts: typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now(),
    patch: {
      ...patch,
      updatedAt:
        typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now(),
    },
  }

  ops.push(op)
  writeJson(WORKOUT_DRAFT_OPS_KEY, ops)

  if (ops.length >= 50) {
    await compactDraft()
  }
}

export async function compactDraft(draft?: WorkoutDraft): Promise<void> {
  const hydrated = draft ?? (await loadDraft())
  if (!hydrated || !draftHasContent(hydrated)) {
    await clearDraft()
    return
  }

  await saveDraft(hydrated)
}

export async function clearDraft(): Promise<void> {
  removeKey(WORKOUT_DRAFT_SNAPSHOT_KEY)
  removeKey(WORKOUT_DRAFT_OPS_KEY)
}

export async function loadPendingWorkout(): Promise<PendingWorkout | null> {
  const data = storage.getString(PENDING_POST_KEY)
  if (!data) return null

  try {
    return JSON.parse(data) as PendingWorkout
  } catch (error) {
    console.error('Failed to parse pending workout payload', error)
    removeKey(PENDING_POST_KEY)
    return null
  }
}

export async function savePendingWorkout(
  pending: PendingWorkout,
): Promise<void> {
  storage.set(PENDING_POST_KEY, JSON.stringify(pending))
}

export async function clearPendingWorkout(): Promise<void> {
  removeKey(PENDING_POST_KEY)
}

export async function loadPlaceholderWorkout(): Promise<PlaceholderWorkout | null> {
  const data = storage.getString(PLACEHOLDER_WORKOUT_KEY)
  if (!data) return null

  try {
    return JSON.parse(data) as PlaceholderWorkout
  } catch (error) {
    console.error('Failed to parse placeholder workout payload', error)
    removeKey(PLACEHOLDER_WORKOUT_KEY)
    return null
  }
}

export async function savePlaceholderWorkout(
  placeholder: PlaceholderWorkout,
): Promise<void> {
  storage.set(PLACEHOLDER_WORKOUT_KEY, JSON.stringify(placeholder))
}

export async function clearPlaceholderWorkout(): Promise<void> {
  removeKey(PLACEHOLDER_WORKOUT_KEY)
}

export async function clearPendingArtifacts(): Promise<void> {
  await Promise.all([clearPendingWorkout(), clearPlaceholderWorkout()])
}

export function createPlaceholderWorkout(
  title: string,
  imageUrl: string | null,
  userId: string,
  profile: { display_name: string; avatar_url: string | null } | null,
): PlaceholderWorkout {
  return {
    id: `temp-${Date.now()}`,
    title,
    imageUrl,
    created_at: new Date().toISOString(),
    isPending: true,
    user_id: userId,
    profile,
  }
}

