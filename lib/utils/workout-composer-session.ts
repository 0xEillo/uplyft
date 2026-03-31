import type {
  PendingWorkout,
  StructuredExerciseDraft,
  WorkoutDraft,
} from '@/lib/utils/workout-draft'
import {
  getDefaultWorkoutTitle,
  structuredWorkoutHasLoggedSets,
} from '@/lib/utils/workout-composer-format'
import type { WorkoutSong } from '@/types/music'

export type WorkoutComposerStage =
  | 'idle'
  | 'editing'
  | 'reviewing'
  | 'enqueueing'
  | 'error'

export type WorkoutComposerRoutineSource =
  | 'selection'
  | 'route'
  | 'draft'
  | null

export type WorkoutComposerHydrationSource =
  | 'none'
  | 'composer_snapshot'
  | 'legacy_draft'
  | 'restored_pending'

export type WorkoutComposerTimerStatus = 'idle' | 'running' | 'frozen'

export interface WorkoutComposerDraftState {
  notes: string
  title: string
  structuredData: StructuredExerciseDraft[]
  isStructuredMode: boolean
  selectedRoutineId: string | null
  routineSource: WorkoutComposerRoutineSource
  song: WorkoutSong | null
}

export interface WorkoutComposerReviewState {
  title: string
  description: string
  imageUri: string | null
  performedAt: string | null
  song: WorkoutSong | null
}

export interface WorkoutComposerTimerState {
  status: WorkoutComposerTimerStatus
  startedAt: string | null
  elapsedBaseSeconds: number
  frozenElapsedSeconds: number
}

export interface WorkoutComposerMetaState {
  updatedAt: number
  hydratedFrom: WorkoutComposerHydrationSource
  sessionId: string | null
}

export interface WorkoutComposerSession {
  stage: WorkoutComposerStage
  draft: WorkoutComposerDraftState
  review: WorkoutComposerReviewState
  timer: WorkoutComposerTimerState
  meta: WorkoutComposerMetaState
}

export type WorkoutComposerDraftPatch = Partial<WorkoutComposerDraftState>
export type WorkoutComposerReviewPatch = Partial<WorkoutComposerReviewState>

export type WorkoutComposerAction =
  | { type: 'hydrate'; session: WorkoutComposerSession }
  | {
      type: 'update_draft'
      patch: WorkoutComposerDraftPatch
      now: number
      nowIso: string
    }
  | {
      type: 'update_review'
      patch: WorkoutComposerReviewPatch
      now: number
    }
  | {
      type: 'seed_routine'
      title: string
      structuredData: StructuredExerciseDraft[]
      selectedRoutineId: string | null
      routineSource: WorkoutComposerRoutineSource
      song?: WorkoutSong | null
      now: number
      nowIso: string
    }
  | {
      type: 'enter_review'
      now: number
      nowIso: string
      defaultTitle: string
    }
  | { type: 'return_to_editing'; now: number }
  | { type: 'set_enqueueing'; now: number }
  | { type: 'mark_enqueue_failed'; now: number }
  | { type: 'discard' }

function createSessionId(now: number): string {
  return `workout-${now}-${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyWorkoutComposerSession(): WorkoutComposerSession {
  return {
    stage: 'idle',
    draft: {
      notes: '',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
      routineSource: null,
      song: null,
    },
    review: {
      title: '',
      description: '',
      imageUri: null,
      performedAt: null,
      song: null,
    },
    timer: {
      status: 'idle',
      startedAt: null,
      elapsedBaseSeconds: 0,
      frozenElapsedSeconds: 0,
    },
    meta: {
      updatedAt: 0,
      hydratedFrom: 'none',
      sessionId: null,
    },
  }
}

function sanitizeStructuredData(
  structuredData: unknown,
): StructuredExerciseDraft[] {
  return Array.isArray(structuredData)
    ? (structuredData as StructuredExerciseDraft[])
    : []
}

function sanitizeSong(song: unknown): WorkoutSong | null {
  return song ? (song as WorkoutSong) : null
}

function sanitizeStage(stage: unknown): WorkoutComposerStage {
  switch (stage) {
    case 'editing':
    case 'reviewing':
    case 'enqueueing':
    case 'error':
      return stage
    default:
      return 'idle'
  }
}

function sanitizeRoutineSource(
  routineSource: unknown,
): WorkoutComposerRoutineSource {
  switch (routineSource) {
    case 'selection':
    case 'route':
    case 'draft':
      return routineSource
    default:
      return null
  }
}

function sanitizeHydrationSource(
  hydratedFrom: unknown,
): WorkoutComposerHydrationSource {
  switch (hydratedFrom) {
    case 'composer_snapshot':
    case 'legacy_draft':
    case 'restored_pending':
      return hydratedFrom
    default:
      return 'none'
  }
}

function sanitizeTimerStatus(status: unknown): WorkoutComposerTimerStatus {
  switch (status) {
    case 'running':
    case 'frozen':
      return status
    default:
      return 'idle'
  }
}

function sessionHasTimerProgress(session: WorkoutComposerSession): boolean {
  return (
    session.timer.status === 'running' ||
    session.timer.frozenElapsedSeconds > 0 ||
    session.timer.elapsedBaseSeconds > 0
  )
}

export function draftHasMeaningfulContent(
  draft: WorkoutComposerDraftState,
): boolean {
  return (
    Boolean(draft.notes.trim()) ||
    Boolean(draft.title.trim()) ||
    Boolean(draft.song) ||
    Boolean(draft.selectedRoutineId) ||
    draft.structuredData.length > 0
  )
}

export function canReviewWorkoutComposerSession(
  session: WorkoutComposerSession,
): boolean {
  return (
    Boolean(session.draft.notes.trim()) ||
    structuredWorkoutHasLoggedSets(session.draft.structuredData)
  )
}

export function hasActiveWorkoutComposerSession(
  session: WorkoutComposerSession,
): boolean {
  if (session.stage === 'idle') {
    return false
  }

  return (
    draftHasMeaningfulContent(session.draft) ||
    Boolean(session.review.description.trim()) ||
    Boolean(session.review.imageUri) ||
    sessionHasTimerProgress(session)
  )
}

export function getWorkoutComposerElapsedSeconds(
  session: WorkoutComposerSession,
  nowMs: number = Date.now(),
): number {
  if (session.timer.status === 'running' && session.timer.startedAt) {
    const startedAtMs = Date.parse(session.timer.startedAt)
    if (!Number.isNaN(startedAtMs)) {
      const deltaSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
      return Math.max(0, session.timer.elapsedBaseSeconds + deltaSeconds)
    }
  }

  if (session.timer.status === 'frozen') {
    return Math.max(0, session.timer.frozenElapsedSeconds)
  }

  return Math.max(0, session.timer.elapsedBaseSeconds)
}

function withUpdatedMeta(
  session: WorkoutComposerSession,
  now: number,
): WorkoutComposerSession {
  return {
    ...session,
    meta: {
      ...session.meta,
      updatedAt: now,
      sessionId: session.meta.sessionId ?? createSessionId(now),
    },
  }
}

function createEditingSession(
  now: number,
  nowIso: string,
): WorkoutComposerSession {
  const session = createEmptyWorkoutComposerSession()

  return {
    ...session,
    stage: 'editing',
    timer: {
      status: 'idle',
      startedAt: null,
      elapsedBaseSeconds: 0,
      frozenElapsedSeconds: 0,
    },
    meta: {
      updatedAt: now,
      hydratedFrom: 'none',
      sessionId: createSessionId(now),
    },
    review: {
      ...session.review,
      performedAt: nowIso,
    },
  }
}

function normalizeSessionShape(
  input: Partial<WorkoutComposerSession> | null | undefined,
): WorkoutComposerSession {
  const empty = createEmptyWorkoutComposerSession()

  if (!input) {
    return empty
  }

  const draftInput: Partial<WorkoutComposerDraftState> = input.draft ?? {}
  const reviewInput: Partial<WorkoutComposerReviewState> = input.review ?? {}
  const timerInput: Partial<WorkoutComposerTimerState> = input.timer ?? {}
  const metaInput: Partial<WorkoutComposerMetaState> = input.meta ?? {}

  const session: WorkoutComposerSession = {
    stage: sanitizeStage(input.stage),
    draft: {
      notes: typeof draftInput.notes === 'string' ? draftInput.notes : '',
      title: typeof draftInput.title === 'string' ? draftInput.title : '',
      structuredData: sanitizeStructuredData(draftInput.structuredData),
      isStructuredMode: Boolean(draftInput.isStructuredMode),
      selectedRoutineId:
        typeof draftInput.selectedRoutineId === 'string'
          ? draftInput.selectedRoutineId
          : null,
      routineSource: sanitizeRoutineSource(draftInput.routineSource),
      song: sanitizeSong(draftInput.song),
    },
    review: {
      title: typeof reviewInput.title === 'string' ? reviewInput.title : '',
      description:
        typeof reviewInput.description === 'string'
          ? reviewInput.description
          : '',
      imageUri:
        typeof reviewInput.imageUri === 'string' ? reviewInput.imageUri : null,
      performedAt:
        typeof reviewInput.performedAt === 'string'
          ? reviewInput.performedAt
          : null,
      song: sanitizeSong(reviewInput.song),
    },
    timer: {
      status: sanitizeTimerStatus(timerInput.status),
      startedAt:
        typeof timerInput.startedAt === 'string' ? timerInput.startedAt : null,
      elapsedBaseSeconds:
        typeof timerInput.elapsedBaseSeconds === 'number'
          ? Math.max(0, Math.floor(timerInput.elapsedBaseSeconds))
          : 0,
      frozenElapsedSeconds:
        typeof timerInput.frozenElapsedSeconds === 'number'
          ? Math.max(0, Math.floor(timerInput.frozenElapsedSeconds))
          : 0,
    },
    meta: {
      updatedAt:
        typeof metaInput.updatedAt === 'number' ? metaInput.updatedAt : 0,
      hydratedFrom: sanitizeHydrationSource(metaInput.hydratedFrom),
      sessionId:
        typeof metaInput.sessionId === 'string' ? metaInput.sessionId : null,
    },
  }

  if (!hasActiveWorkoutComposerSession(session)) {
    return empty
  }

  if (session.stage === 'idle') {
    return {
      ...session,
      stage: 'editing',
    }
  }

  return session
}

export function normalizePersistedWorkoutComposerSession(
  input: Partial<WorkoutComposerSession> | null | undefined,
): WorkoutComposerSession {
  const session = normalizeSessionShape(input)

  if (session.stage === 'enqueueing') {
    return {
      ...session,
      stage: 'reviewing',
    }
  }

  if (session.stage === 'error') {
    return {
      ...session,
      stage: 'editing',
    }
  }

  return session
}

function maybeStartTimerFromDraft(
  previousSession: WorkoutComposerSession,
  nextSession: WorkoutComposerSession,
  nowIso: string,
): WorkoutComposerSession {
  const hadContent = draftHasMeaningfulContent(previousSession.draft)
  const hasContent = draftHasMeaningfulContent(nextSession.draft)

  if (
    !hadContent &&
    hasContent &&
    previousSession.timer.status === 'idle' &&
    nextSession.stage === 'editing'
  ) {
    return {
      ...nextSession,
      timer: {
        status: 'running',
        startedAt: nowIso,
        elapsedBaseSeconds: 0,
        frozenElapsedSeconds: 0,
      },
      review: {
        ...nextSession.review,
        performedAt: nextSession.review.performedAt ?? nowIso,
      },
    }
  }

  return nextSession
}

export function createWorkoutComposerSessionFromLegacyDraft(
  draft: WorkoutDraft | null,
): WorkoutComposerSession {
  if (!draft) {
    return createEmptyWorkoutComposerSession()
  }

  const hasTimerStarted =
    typeof draft.timerStartedAt === 'string' &&
    draft.timerStartedAt.trim().length > 0
  const elapsedSeconds =
    typeof draft.timerElapsedSeconds === 'number'
      ? Math.max(0, Math.floor(draft.timerElapsedSeconds))
      : 0

  const session = normalizePersistedWorkoutComposerSession({
    stage: 'editing',
    draft: {
      notes: draft.notes ?? '',
      title: draft.title ?? '',
      structuredData: Array.isArray(draft.structuredData)
        ? draft.structuredData
        : [],
      isStructuredMode: Boolean(draft.isStructuredMode),
      selectedRoutineId:
        typeof draft.selectedRoutineId === 'string'
          ? draft.selectedRoutineId
          : null,
      routineSource:
        typeof draft.selectedRoutineId === 'string' ? 'draft' : null,
      song: draft.song ?? null,
    },
    review: {
      title: draft.title ?? '',
      description: '',
      imageUri: null,
      performedAt: null,
      song: draft.song ?? null,
    },
    timer: {
      status: hasTimerStarted
        ? 'running'
        : elapsedSeconds > 0
        ? 'frozen'
        : 'idle',
      startedAt: hasTimerStarted ? draft.timerStartedAt ?? null : null,
      elapsedBaseSeconds: elapsedSeconds,
      frozenElapsedSeconds: hasTimerStarted ? 0 : elapsedSeconds,
    },
    meta: {
      updatedAt:
        typeof draft.updatedAt === 'number' ? draft.updatedAt : Date.now(),
      hydratedFrom: 'legacy_draft',
      sessionId:
        typeof draft.updatedAt === 'number'
          ? createSessionId(draft.updatedAt)
          : createSessionId(Date.now()),
    },
  })

  return session
}

export function createWorkoutComposerSessionFromPendingWorkout(
  pending: PendingWorkout,
): WorkoutComposerSession {
  const durationSeconds =
    typeof pending.durationSeconds === 'number'
      ? Math.max(0, Math.floor(pending.durationSeconds))
      : 0
  const title =
    typeof pending.title === 'string' ? pending.title.trim() : ''
  const notes =
    typeof pending.parserNotes === 'string' ? pending.parserNotes : pending.notes
  const reviewDate =
    typeof pending.performedAt === 'string' ? pending.performedAt : null

  return normalizePersistedWorkoutComposerSession({
    stage: 'editing',
    draft: {
      notes,
      title,
      structuredData: Array.isArray(pending.structuredData)
        ? pending.structuredData
        : [],
      isStructuredMode: Boolean(pending.isStructuredMode),
      selectedRoutineId:
        typeof pending.routineId === 'string' ? pending.routineId : null,
      routineSource:
        typeof pending.routineId === 'string' ? 'draft' : null,
      song: pending.song ?? null,
    },
    review: {
      title,
      description: pending.description ?? '',
      imageUri: pending.imageUrl ?? null,
      performedAt: reviewDate,
      song: pending.song ?? null,
    },
    timer: {
      status: durationSeconds > 0 ? 'frozen' : 'idle',
      startedAt: null,
      elapsedBaseSeconds: durationSeconds,
      frozenElapsedSeconds: durationSeconds,
    },
    meta: {
      updatedAt: Date.now(),
      hydratedFrom: 'restored_pending',
      sessionId: createSessionId(Date.now()),
    },
  })
}

export function getWorkoutComposerReviewTitle(
  session: WorkoutComposerSession,
): string {
  if (session.review.title.trim()) {
    return session.review.title
  }

  if (session.draft.title.trim()) {
    return session.draft.title
  }

  const fallbackDate = session.review.performedAt
    ? new Date(session.review.performedAt)
    : new Date()

  return getDefaultWorkoutTitle(fallbackDate)
}

export function workoutComposerReducer(
  state: WorkoutComposerSession,
  action: WorkoutComposerAction,
): WorkoutComposerSession {
  switch (action.type) {
    case 'hydrate':
      return normalizePersistedWorkoutComposerSession(action.session)
    case 'update_draft': {
      const baseSession =
        state.stage === 'idle'
          ? createEditingSession(action.now, action.nowIso)
          : state

      const nextDraft: WorkoutComposerDraftState = {
        ...baseSession.draft,
        ...action.patch,
        notes:
          typeof action.patch.notes === 'string'
            ? action.patch.notes
            : baseSession.draft.notes,
        title:
          typeof action.patch.title === 'string'
            ? action.patch.title
            : baseSession.draft.title,
        structuredData:
          Array.isArray(action.patch.structuredData)
            ? action.patch.structuredData
            : baseSession.draft.structuredData,
        isStructuredMode:
          typeof action.patch.isStructuredMode === 'boolean'
            ? action.patch.isStructuredMode
            : baseSession.draft.isStructuredMode,
        selectedRoutineId:
          action.patch.selectedRoutineId === null ||
          typeof action.patch.selectedRoutineId === 'string'
            ? action.patch.selectedRoutineId ?? null
            : baseSession.draft.selectedRoutineId,
        routineSource:
          'routineSource' in action.patch
            ? sanitizeRoutineSource(action.patch.routineSource)
            : baseSession.draft.routineSource,
        song:
          'song' in action.patch
            ? sanitizeSong(action.patch.song)
            : baseSession.draft.song,
      }

      let nextSession: WorkoutComposerSession = withUpdatedMeta(
        {
          ...baseSession,
          stage: baseSession.stage === 'reviewing' ? 'editing' : 'editing',
          draft: nextDraft,
        },
        action.now,
      )

      nextSession = maybeStartTimerFromDraft(state, nextSession, action.nowIso)

      if (!draftHasMeaningfulContent(nextSession.draft)) {
        return createEmptyWorkoutComposerSession()
      }

      return nextSession
    }
    case 'update_review': {
      if (!hasActiveWorkoutComposerSession(state)) {
        return state
      }

      return withUpdatedMeta(
        {
          ...state,
          review: {
            ...state.review,
            ...action.patch,
            title:
              typeof action.patch.title === 'string'
                ? action.patch.title
                : state.review.title,
            description:
              typeof action.patch.description === 'string'
                ? action.patch.description
                : state.review.description,
            imageUri:
              action.patch.imageUri === null ||
              typeof action.patch.imageUri === 'string'
                ? action.patch.imageUri ?? null
                : state.review.imageUri,
            performedAt:
              action.patch.performedAt === null ||
              typeof action.patch.performedAt === 'string'
                ? action.patch.performedAt ?? null
                : state.review.performedAt,
            song:
              'song' in action.patch
                ? sanitizeSong(action.patch.song)
                : state.review.song,
          },
        },
        action.now,
      )
    }
    case 'seed_routine':
      return {
        stage: 'editing',
        draft: {
          notes: '',
          title: action.title,
          structuredData: action.structuredData,
          isStructuredMode: true,
          selectedRoutineId: action.selectedRoutineId,
          routineSource: action.routineSource,
          song: action.song ?? null,
        },
        review: {
          title: action.title,
          description: '',
          imageUri: null,
          performedAt: action.nowIso,
          song: action.song ?? null,
        },
        timer: {
          status: 'running',
          startedAt: action.nowIso,
          elapsedBaseSeconds: 0,
          frozenElapsedSeconds: 0,
        },
        meta: {
          updatedAt: action.now,
          hydratedFrom: 'none',
          sessionId: createSessionId(action.now),
        },
      }
    case 'enter_review': {
      if (!canReviewWorkoutComposerSession(state)) {
        return state
      }

      const frozenElapsedSeconds = getWorkoutComposerElapsedSeconds(
        state,
        action.now,
      )

      return withUpdatedMeta(
        {
          ...state,
          stage: 'reviewing',
          review: {
            ...state.review,
            title:
              state.review.title.trim() ||
              state.draft.title.trim() ||
              action.defaultTitle,
            performedAt: state.review.performedAt ?? action.nowIso,
            song: state.review.song ?? state.draft.song ?? null,
          },
          timer: {
            status: 'frozen',
            startedAt: null,
            elapsedBaseSeconds: frozenElapsedSeconds,
            frozenElapsedSeconds,
          },
        },
        action.now,
      )
    }
    case 'return_to_editing':
      if (!hasActiveWorkoutComposerSession(state)) {
        return createEmptyWorkoutComposerSession()
      }

      return withUpdatedMeta(
        {
          ...state,
          stage: 'editing',
        },
        action.now,
      )
    case 'set_enqueueing':
      if (!hasActiveWorkoutComposerSession(state)) {
        return state
      }

      return withUpdatedMeta(
        {
          ...state,
          stage: 'enqueueing',
        },
        action.now,
      )
    case 'mark_enqueue_failed':
      if (!hasActiveWorkoutComposerSession(state)) {
        return state
      }

      return withUpdatedMeta(
        {
          ...state,
          stage: 'reviewing',
        },
        action.now,
      )
    case 'discard':
      return createEmptyWorkoutComposerSession()
    default:
      return state
  }
}
