import * as Crypto from 'expo-crypto'
import { usePostHog } from 'posthog-react-native'
import { useCallback, useRef, useState } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { isApiError } from '@/lib/api/errors'
import { postWorkout, WorkoutResponse } from '@/lib/api/post-workout'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { uploadWorkoutImage } from '@/lib/utils/image-upload'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import {
  clearPendingArtifacts,
  createPlaceholderWorkout,
  loadPendingWorkout,
  loadPlaceholderWorkout,
  PendingWorkout,
  PlaceholderWorkout,
  saveDraft,
  savePendingWorkout,
  savePlaceholderWorkout,
} from '@/lib/utils/workout-draft'
import { WorkoutSessionWithDetails } from '@/types/database.types'

interface SubmitWorkoutArgs {
  notes: string
  title: string
  imageUri: string | null
  routineId?: string | null
  durationSeconds?: number
  description?: string
  structuredData?: StructuredExerciseDraft[]
  isStructuredMode?: boolean
}

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

export type PendingProcessStatus =
  | { status: 'none' }
  | { status: 'skipped' }
  | { status: 'offline' } // Network error - pending workout kept for retry
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

export function useSubmitWorkout() {
  const { user } = useAuth()
  const { weightUnit } = useWeightUnits()
  const [isProcessingPending, setIsProcessingPending] = useState(false)
  const isProcessingRef = useRef(false)
  const posthog = usePostHog()

  // Safe PostHog capture that won't throw on network errors
  const safeCapture = useCallback(
    (event: string, properties?: Parameters<typeof posthog.capture>[1]) => {
      try {
        posthog?.capture(event, properties)
      } catch {
        // Silently fail - analytics should never block core functionality
      }
    },
    [posthog],
  )

  const buildStructuredStats = useCallback(
    (structuredData?: StructuredExerciseDraft[]) => {
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
    },
    [],
  )

  const toErrorPayload = useCallback((error: unknown) => {
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
  }, [])

  const submitWorkout = useCallback(
    async ({
      notes,
      title,
      imageUri,
      routineId,
      durationSeconds,
      description,
      structuredData,
      isStructuredMode,
    }: SubmitWorkoutArgs) => {
      if (!user) {
        throw new Error('User must be authenticated to submit workouts')
      }

      const trimmedNotes = notes.trim()
      const trimmedTitle = title.trim()

      if (!trimmedNotes) {
        throw new Error('Workout notes are required')
      }

      let imageUrl: string | null = null
      if (imageUri) {
        try {
          imageUrl = await uploadWorkoutImage(imageUri, user.id)
        } catch (error) {
          safeCapture('Workout Image Upload Failed', {
            userId: user.id,
            notesLength: trimmedNotes.length,
            titleLength: trimmedTitle.length,
            hasImage: true,
            ...buildStructuredStats(structuredData),
            isStructuredMode: Boolean(isStructuredMode),
            routineId: routineId ?? null,
            durationSeconds:
              typeof durationSeconds === 'number' ? durationSeconds : null,
            error: toErrorPayload(error),
          })
          throw new SubmitWorkoutError('IMAGE_UPLOAD', error)
        }
      }

      // Generate idempotency key to prevent duplicate submissions
      const idempotencyKey = Crypto.randomUUID()

      // Capture local timestamp and timezone for offline support
      const now = new Date()
      const performedAt = now.toISOString()
      const timezoneOffsetMinutes = now.getTimezoneOffset()

      const pending: PendingWorkout = {
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUrl,
        weightUnit,
        userId: user.id,
        idempotencyKey,
        routineId: routineId || null,
        durationSeconds:
          typeof durationSeconds === 'number' ? durationSeconds : null,
        description,
        structuredData:
          Array.isArray(structuredData) && structuredData.length > 0
            ? structuredData
            : undefined,
        isStructuredMode:
          typeof isStructuredMode === 'boolean' ? isStructuredMode : undefined,
        performedAt,
        timezoneOffsetMinutes,
      }

      // Fetch user's profile for the placeholder (non-critical, may fail offline)
      let profileData: {
        display_name: string
        avatar_url: string | null
      } | null = null
      try {
        const profile = await database.profiles.getById(user.id)
        if (profile) {
          profileData = {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        }
      } catch {
        // Profile fetch failed (likely offline) - placeholder will work without it
      }

      const placeholder = createPlaceholderWorkout(
        trimmedTitle,
        imageUrl,
        user.id,
        profileData,
      )

      await Promise.all([
        savePendingWorkout(pending),
        savePlaceholderWorkout(placeholder),
      ])

      safeCapture('Workout Submit Queued', {
        userId: user.id,
        notesLength: trimmedNotes.length,
        titleLength: trimmedTitle.length,
        hasImage: Boolean(imageUrl),
        ...buildStructuredStats(structuredData),
        isStructuredMode: Boolean(isStructuredMode),
        routineId: routineId ?? null,
        durationSeconds:
          typeof durationSeconds === 'number' ? durationSeconds : null,
        performedAt,
        timezoneOffsetMinutes,
      })

      return { pending, placeholder }
    },
    [user, weightUnit, safeCapture, buildStructuredStats, toErrorPayload],
  )

  const processPendingWorkout = useCallback(async (): Promise<
    PendingProcessStatus
  > => {
    if (isProcessingRef.current) {
      return { status: 'skipped' }
    }

    const pending = await loadPendingWorkout()
    if (!pending) {
      return { status: 'none' }
    }

    isProcessingRef.current = true
    setIsProcessingPending(true)

    const placeholder = await loadPlaceholderWorkout()

    // Track retry attempt
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
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const accessToken = session?.access_token
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

      // Do NOT clear draft here. The component that queued the workout is responsible for clearing its own draft.
      // Clearing here causes race conditions where a *new* draft (created after the pending one was queued) gets deleted.

      return {
        status: 'success',
        placeholder,
        workout: response.createdWorkout,
        response,
      }
    } catch (error) {
      // Check if this is a network error (offline)
      const isNetworkError =
        (isApiError(error) && error.code === 'NETWORK') ||
        (error instanceof Error &&
          (error.message.includes('Network request failed') ||
            error.message.includes('network') ||
            error.message.includes('fetch')))

      if (isNetworkError) {
        // Network error - keep pending workout for retry, don't clear anything
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

      // Non-network error - save back to draft so the user doesn't lose data
      await saveDraft({
        notes: pending.notes,
        title: pending.title,
        structuredData: pending.structuredData ?? [],
        isStructuredMode: pending.isStructuredMode ?? false,
        selectedRoutineId: pending.routineId ?? null,
      })
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
    } finally {
      isProcessingRef.current = false
      setIsProcessingPending(false)
    }
  }, [safeCapture, buildStructuredStats, toErrorPayload])

  return {
    submitWorkout,
    processPendingWorkout,
    isProcessingPending,
  }
}
