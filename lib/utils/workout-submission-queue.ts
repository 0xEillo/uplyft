import { mixpanel } from '@/lib/mixpanel'
import * as Crypto from 'expo-crypto'

import { isApiError } from '@/lib/api/errors'
import { postWorkout, type WorkoutResponse } from '@/lib/api/post-workout'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { uploadWorkoutImage } from '@/lib/utils/image-upload'
import {
  emitWorkoutComposerSessionRestored,
} from '@/lib/utils/workout-composer-events'
import {
  convertStructuredDataToText,
  getDefaultWorkoutTitle,
} from '@/lib/utils/workout-composer-format'
import {
  createWorkoutComposerSessionFromPendingWorkout,
  getWorkoutComposerElapsedSeconds,
  getWorkoutComposerReviewTitle,
  type WorkoutComposerSession,
} from '@/lib/utils/workout-composer-session'
import {
  saveStoredWorkoutComposerSession,
} from '@/lib/utils/workout-composer-storage'
import type {
  PendingWorkout,
  PlaceholderWorkout,
  StructuredExerciseDraft,
  WeightUnit,
} from '@/lib/utils/workout-draft'
import {
  clearPendingArtifacts,
  createPlaceholderWorkout,
  loadPendingWorkout,
  loadPlaceholderWorkout,
  savePendingWorkout,
  savePlaceholderWorkout,
} from '@/lib/utils/workout-draft'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import type { WorkoutSong } from '@/types/music'

export type SubmitWorkoutErrorCode = 'IMAGE_UPLOAD'

export class SubmitWorkoutError extends Error {
  readonly code: SubmitWorkoutErrorCode
  readonly originalError?: unknown

  constructor(code: SubmitWorkoutErrorCode, originalError?: unknown) {
    super(
      code === 'IMAGE_UPLOAD'
        ? 'Failed to upload workout image'
        : 'Failed to submit workout',
    )
    this.name = 'SubmitWorkoutError'
    this.code = code
    this.originalError = originalError
  }
}

export interface EnqueueWorkoutSubmissionArgs {
  session: WorkoutComposerSession
  userId: string
  weightUnit: WeightUnit
}

export type PendingProcessStatus =
  | { status: 'none' }
  | { status: 'skipped' }
  | { status: 'offline' }
  | {
      status: 'success'
      placeholder: PlaceholderWorkout | null
      workout: WorkoutSessionWithDetails
      response?: WorkoutResponse
    }
  | {
      status: 'error'
      placeholder: PlaceholderWorkout | null
      error: unknown
    }

function safeCapture(event: string, properties?: Record<string, unknown>) {
  try {
    mixpanel.track(event, properties)
  } catch {
    // Analytics should never block workout posting.
  }
}

function buildStructuredStats(structuredData?: StructuredExerciseDraft[]) {
  const exercises = Array.isArray(structuredData) ? structuredData : []
  let sets = 0
  let setsWithData = 0

  exercises.forEach((exercise) => {
    ;(exercise.sets ?? []).forEach((set) => {
      sets += 1
      if (set.weight?.trim() || set.reps?.trim()) {
        setsWithData += 1
      }
    })
  })

  return {
    structuredExercisesCount: exercises.length,
    structuredSetsCount: sets,
    structuredSetsWithDataCount: setsWithData,
  }
}

function toErrorPayload(error: unknown) {
  if (isApiError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      correlationId: error.correlationId ?? null,
      httpStatus: error.httpStatus ?? null,
    }
  }

  if (error instanceof SubmitWorkoutError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      correlationId: null,
      httpStatus: null,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: null,
      correlationId: null,
      httpStatus: null,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
    code: null,
    correlationId: null,
    httpStatus: null,
  }
}

function resolveSessionSong(session: WorkoutComposerSession): WorkoutSong | null {
  return session.review.song ?? session.draft.song ?? null
}

function resolveSubmissionImageUri(session: WorkoutComposerSession): string | null {
  return session.review.imageUri ?? null
}

function resolveSubmissionTitle(session: WorkoutComposerSession): string {
  const reviewTitle = getWorkoutComposerReviewTitle(session).trim()
  if (reviewTitle) {
    return reviewTitle
  }

  return getDefaultWorkoutTitle()
}

function buildSubmissionNotes(
  session: WorkoutComposerSession,
  weightUnit: WeightUnit,
): { notes: string; parserNotes: string } {
  const freeformNotes = session.draft.notes.trim()

  if (
    session.draft.isStructuredMode &&
    Array.isArray(session.draft.structuredData) &&
    session.draft.structuredData.length > 0
  ) {
    const unitDisplay = weightUnit === 'kg' ? 'kg' : 'lbs'
    const structuredText = convertStructuredDataToText(
      session.draft.structuredData,
      unitDisplay,
    )
    const combined = structuredText + (freeformNotes ? `\n\n${freeformNotes}` : '')
    return {
      notes: combined.trim(),
      parserNotes: freeformNotes,
    }
  }

  return {
    notes: freeformNotes,
    parserNotes: freeformNotes,
  }
}

async function resolveImageUrl(
  imageUri: string | null,
  userId: string,
): Promise<string | null> {
  if (!imageUri) {
    return null
  }

  if (/^https?:\/\//i.test(imageUri)) {
    return imageUri
  }

  try {
    return await uploadWorkoutImage(imageUri, userId)
  } catch (error) {
    throw new SubmitWorkoutError('IMAGE_UPLOAD', error)
  }
}

export async function enqueueWorkoutSubmission({
  session,
  userId,
  weightUnit,
}: EnqueueWorkoutSubmissionArgs): Promise<{
  pending: PendingWorkout
  placeholder: PlaceholderWorkout
}> {
  const submissionTitle = resolveSubmissionTitle(session)
  const { notes, parserNotes } = buildSubmissionNotes(session, weightUnit)

  if (!notes.trim()) {
    throw new Error('Workout notes are required')
  }

  const imageUri = resolveSubmissionImageUri(session)
  const imageUrl = await resolveImageUrl(imageUri, userId)
  const idempotencyKey = Crypto.randomUUID()
  const performedAt =
    session.review.performedAt ?? new Date().toISOString()
  const performedDate = new Date(performedAt)
  const timezoneOffsetMinutes = performedDate.getTimezoneOffset()
  const song = resolveSessionSong(session)

  const pending: PendingWorkout = {
    notes,
    title: submissionTitle,
    imageUrl,
    weightUnit,
    userId,
    idempotencyKey,
    routineId: session.draft.selectedRoutineId,
    durationSeconds: getWorkoutComposerElapsedSeconds(session),
    description: session.review.description.trim() || undefined,
    parserNotes,
    song,
    structuredData:
      session.draft.isStructuredMode && session.draft.structuredData.length > 0
        ? session.draft.structuredData
        : undefined,
    isStructuredMode: session.draft.isStructuredMode,
    performedAt,
    timezoneOffsetMinutes,
  }

  let profileData: {
    display_name: string
    avatar_url: string | null
  } | null = null
  try {
    const profile = await database.profiles.getById(userId)
    if (profile) {
      profileData = {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      }
    }
  } catch {
    // Offline/lookup failures should not block queueing.
  }

  const placeholder = createPlaceholderWorkout(
    submissionTitle,
    imageUrl,
    userId,
    profileData,
    song,
  )

  await Promise.all([
    savePendingWorkout(pending),
    savePlaceholderWorkout(placeholder),
  ])

  safeCapture('Workout Submit Queued', {
    userId,
    notesLength: notes.length,
    titleLength: submissionTitle.length,
    hasImage: Boolean(imageUrl),
    ...buildStructuredStats(session.draft.structuredData),
    isStructuredMode: Boolean(session.draft.isStructuredMode),
    routineId: session.draft.selectedRoutineId ?? null,
    durationSeconds: pending.durationSeconds ?? null,
    performedAt,
    timezoneOffsetMinutes,
  })

  return { pending, placeholder }
}

async function restoreComposerSessionFromPendingWorkout(
  pending: PendingWorkout,
): Promise<void> {
  const restoredSession = createWorkoutComposerSessionFromPendingWorkout(pending)
  await saveStoredWorkoutComposerSession(restoredSession)
  emitWorkoutComposerSessionRestored(restoredSession)
}

export async function peekPendingWorkoutPlaceholder(): Promise<PlaceholderWorkout | null> {
  return loadPlaceholderWorkout()
}

export async function processPendingWorkoutSubmission(
  accessToken: string,
): Promise<PendingProcessStatus> {
  const pending = await loadPendingWorkout()
  if (!pending) {
    return { status: 'none' }
  }

  const placeholder = await loadPlaceholderWorkout()

  safeCapture('Workout Pending Processing', {
    userId: pending.userId,
    notesLength: pending.notes.length,
    titleLength: pending.title.length,
    hasImage: Boolean(pending.imageUrl),
    ...buildStructuredStats(pending.structuredData),
    isStructuredMode: Boolean(pending.isStructuredMode),
    routineId: pending.routineId ?? null,
    durationSeconds: pending.durationSeconds ?? null,
    performedAt: pending.performedAt ?? null,
    timezoneOffsetMinutes: pending.timezoneOffsetMinutes ?? null,
  })

  try {
    const response = await postWorkout(
      {
        notes: pending.notes,
        weightUnit: pending.weightUnit,
        createWorkout: true,
        userId: pending.userId,
        workoutTitle: pending.title,
        imageUrl: pending.imageUrl,
        idempotencyKey: pending.idempotencyKey,
        routineId: pending.routineId,
        durationSeconds: pending.durationSeconds ?? undefined,
        description: pending.description,
        parserNotes: pending.parserNotes ?? undefined,
        includeCreatedWorkoutDetails: false,
        song: pending.song ?? undefined,
        structuredData: pending.structuredData,
        isStructuredMode: pending.isStructuredMode,
        performedAt: pending.performedAt,
        timezoneOffsetMinutes: pending.timezoneOffsetMinutes,
      },
      accessToken,
    )

    if (!response.createdWorkout) {
      throw new Error('Workout created without session payload')
    }

    await clearPendingArtifacts()

    safeCapture('Workout Pending Processed', {
      userId: pending.userId,
      notesLength: pending.notes.length,
      titleLength: pending.title.length,
      hasImage: Boolean(pending.imageUrl),
      ...buildStructuredStats(pending.structuredData),
      isStructuredMode: Boolean(pending.isStructuredMode),
      routineId: pending.routineId ?? null,
      durationSeconds: pending.durationSeconds ?? null,
      correlationId: response.correlationId ?? null,
      metrics: response._metrics
        ? {
            totalExercises: response._metrics.totalExercises,
            matchedExercises: response._metrics.matchedExercises,
            createdExercises: response._metrics.createdExercises,
            totalSets: response._metrics.totalSets,
          }
        : null,
    })

    return {
      status: 'success',
      placeholder,
      workout: response.createdWorkout,
      response,
    }
  } catch (error) {
    const isNetworkError =
      (isApiError(error) && error.code === 'NETWORK') ||
      (error instanceof Error &&
        (error.message.includes('Network request failed') ||
          error.message.includes('network') ||
          error.message.includes('fetch')))

    if (isNetworkError) {
      safeCapture('Workout Pending Offline', {
        userId: pending.userId,
        notesLength: pending.notes.length,
        titleLength: pending.title.length,
        hasImage: Boolean(pending.imageUrl),
        ...buildStructuredStats(pending.structuredData),
        isStructuredMode: Boolean(pending.isStructuredMode),
        routineId: pending.routineId ?? null,
        durationSeconds: pending.durationSeconds ?? null,
      })

      return { status: 'offline' }
    }

    await restoreComposerSessionFromPendingWorkout(pending)
    await clearPendingArtifacts()

    safeCapture('Workout Pending Failed', {
      userId: pending.userId,
      notesLength: pending.notes.length,
      titleLength: pending.title.length,
      hasImage: Boolean(pending.imageUrl),
      ...buildStructuredStats(pending.structuredData),
      isStructuredMode: Boolean(pending.isStructuredMode),
      routineId: pending.routineId ?? null,
      durationSeconds: pending.durationSeconds ?? null,
      error: toErrorPayload(error),
    })

    return {
      status: 'error',
      placeholder,
      error,
    }
  }
}
