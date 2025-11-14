import { useCallback, useRef, useState } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { postWorkout, WorkoutResponse } from '@/lib/api/post-workout'
import { supabase } from '@/lib/supabase'
import { uploadWorkoutImage } from '@/lib/utils/image-upload'
import {
  clearDraft,
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
  | {
      status: 'success'
      placeholder: PlaceholderWorkout | null
      workout: WorkoutSessionWithDetails
      response: WorkoutResponse
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

  const submitWorkout = useCallback(
    async ({ notes, title, imageUri, routineId, durationSeconds }: SubmitWorkoutArgs) => {
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
          throw new SubmitWorkoutError('IMAGE_UPLOAD', error)
        }
      }

      const pending: PendingWorkout = {
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUrl,
        weightUnit,
        userId: user.id,
        routineId: routineId || null,
        durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : null,
      }

      const placeholder = createPlaceholderWorkout(trimmedTitle, imageUrl)

      await Promise.all([
        savePendingWorkout(pending),
        savePlaceholderWorkout(placeholder),
      ])

      return { pending, placeholder }
    },
    [user, weightUnit],
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

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const accessToken = session?.access_token

      const response = await postWorkout(
        {
          notes: pending.notes,
          weightUnit: pending.weightUnit,
          createWorkout: true,
          userId: pending.userId,
          workoutTitle: pending.title,
          imageUrl: pending.imageUrl,
          routineId: pending.routineId,
          durationSeconds: pending.durationSeconds ?? undefined,
        },
        accessToken,
      )

      if (!response.createdWorkout) {
        throw new Error('Workout created without session payload')
      }

      await clearPendingArtifacts()
      await clearDraft()

      return {
        status: 'success',
        placeholder,
        workout: response.createdWorkout,
        response,
      }
    } catch (error) {
      await saveDraft({ notes: pending.notes, title: pending.title })
      await clearPendingArtifacts()

      return {
        status: 'error',
        placeholder,
        error,
      }
    } finally {
      isProcessingRef.current = false
      setIsProcessingPending(false)
    }
  }, [])

  return {
    submitWorkout,
    processPendingWorkout,
    isProcessingPending,
  }
}
