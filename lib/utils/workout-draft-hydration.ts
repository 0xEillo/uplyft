import type {
  PendingWorkout,
  StructuredExerciseDraft,
  WorkoutDraft,
} from '@/lib/utils/workout-draft'
import type { WorkoutSong } from '@/types/music'

export type RoutineSource = 'route' | 'draft' | null

export interface HydrationInput {
  draft: WorkoutDraft | null
  pending?: PendingWorkout | null
  selectedRoutineId?: string | null
  refresh?: string | null
  lastRouteRoutineToken?: string | null
  hasHydrated: boolean
  lastLocalEditAt: number
}

export interface HydrationPlan {
  shouldSkip: boolean
  shouldResetToEmpty: boolean
  hasNewRouteRoutine: boolean
  routeRoutineToken: string | null
  draftUpdatedAt: number
  effectiveRoutineId: string | null
  routineSource: RoutineSource
  shouldApplyHydration: boolean
  notes?: string
  title?: string
  song?: WorkoutSong | null
  structuredData?: StructuredExerciseDraft[]
  isStructuredMode?: boolean
  shouldHydrateTimer: boolean
  timerStartedAt: string | null
  timerElapsedSeconds: number
}

export function buildHydrationPlan({
  draft,
  pending,
  selectedRoutineId,
  refresh,
  lastRouteRoutineToken,
  hasHydrated,
  lastLocalEditAt,
}: HydrationInput): HydrationPlan {
  const draftUpdatedAt = draft?.updatedAt ?? 0
  const hasLocalEdits = hasHydrated && lastLocalEditAt > draftUpdatedAt

  const routeRoutineToken = selectedRoutineId
    ? `${selectedRoutineId}:${refresh ?? ''}`
    : null
  const hasNewRouteRoutine =
    Boolean(selectedRoutineId) && routeRoutineToken !== lastRouteRoutineToken
  const hasStoredState = Boolean(draft) || Boolean(pending)
  const shouldResetToEmpty =
    hasHydrated && !hasStoredState && !hasNewRouteRoutine

  const routineIdFromDraft = draft?.selectedRoutineId ?? pending?.routineId ?? null
  const routineIdFromRoute = hasNewRouteRoutine ? selectedRoutineId ?? null : null
  const effectiveRoutineId = routineIdFromRoute || routineIdFromDraft || null
  const routineSource: RoutineSource = effectiveRoutineId
    ? routineIdFromRoute
      ? 'route'
      : 'draft'
    : null

  const hasStructuredData =
    Array.isArray(draft?.structuredData) && draft.structuredData.length > 0
  const shouldApplyHydration =
    Boolean(draft?.notes?.trim()) ||
    Boolean(pending?.notes) ||
    Boolean(draft?.title?.trim()) ||
    Boolean(pending?.title) ||
    Boolean(draft?.song) ||
    Boolean(pending?.song) ||
    hasStructuredData ||
    typeof draft?.isStructuredMode === 'boolean' ||
    Boolean(effectiveRoutineId) ||
    Boolean(
      draft &&
        (draft.timerStartedAt ||
          typeof draft.timerElapsedSeconds === 'number'),
    )

  let notes: string | undefined
  if (draft?.notes?.trim()) {
    notes = draft.notes
  } else if (pending?.notes) {
    notes = pending.notes
  }

  let title: string | undefined
  if (draft?.title?.trim()) {
    title = draft.title
  } else if (pending?.title) {
    title = pending.title
  }

  let song: WorkoutSong | null | undefined
  if (draft?.song) {
    song = draft.song
  } else if (pending?.song) {
    song = pending.song
  } else if (draft?.song === null) {
    song = null
  }

  let structuredData: StructuredExerciseDraft[] | undefined
  let isStructuredMode: boolean | undefined

  if (hasStructuredData) {
    structuredData = draft?.structuredData ?? []
    isStructuredMode =
      typeof draft?.isStructuredMode === 'boolean'
        ? draft.isStructuredMode
        : true
  } else if (typeof draft?.isStructuredMode === 'boolean') {
    isStructuredMode = draft.isStructuredMode
  }

  const timerStartedAt =
    typeof draft?.timerStartedAt === 'string' ? draft.timerStartedAt : null
  const timerElapsedSeconds =
    typeof draft?.timerElapsedSeconds === 'number' ? draft.timerElapsedSeconds : 0
  const shouldHydrateTimer = Boolean(
    draft &&
      (timerStartedAt || typeof draft?.timerElapsedSeconds === 'number'),
  )

  return {
    shouldSkip: hasLocalEdits && !hasNewRouteRoutine && !shouldResetToEmpty,
    shouldResetToEmpty,
    hasNewRouteRoutine,
    routeRoutineToken,
    draftUpdatedAt,
    effectiveRoutineId,
    routineSource,
    shouldApplyHydration,
    notes,
    title,
    song,
    structuredData,
    isStructuredMode,
    shouldHydrateTimer,
    timerStartedAt,
    timerElapsedSeconds,
  }
}
