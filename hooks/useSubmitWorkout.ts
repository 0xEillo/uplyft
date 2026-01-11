import * as Crypto from 'expo-crypto'
import { useCallback, useRef, useState } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { postWorkout, WorkoutResponse } from '@/lib/api/post-workout'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { preferredToKg, type WeightUnit } from '@/contexts/unit-context'
import { uploadWorkoutImage } from '@/lib/utils/image-upload'
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
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'

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
          throw new SubmitWorkoutError('IMAGE_UPLOAD', error)
        }
      }

      // Generate idempotency key to prevent duplicate submissions
      const idempotencyKey = Crypto.randomUUID()

      const pending: PendingWorkout = {
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUrl,
        weightUnit,
        userId: user.id,
        idempotencyKey,
        routineId: routineId || null,
        durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : null,
        description,
        structuredData:
          Array.isArray(structuredData) && structuredData.length > 0
            ? structuredData
            : undefined,
        isStructuredMode:
          typeof isStructuredMode === 'boolean' ? isStructuredMode : undefined,
      }

      // Fetch user's profile for the placeholder
      const profile = await database.profiles.getById(user.id)
      const placeholder = createPlaceholderWorkout(
        trimmedTitle,
        imageUrl,
        user.id,
        profile
          ? {
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
            }
          : null,
      )

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

      if (!session) {
        throw new Error('Not authenticated')
      }

      const accessToken = session?.access_token
      const hasStructuredPayload =
        Array.isArray(pending.structuredData) && pending.structuredData.length > 0

      if (hasStructuredPayload) {
        const parseNumeric = (value: string | null | undefined): number | null => {
          if (typeof value !== 'string') return null
          const trimmed = value.trim()
          if (!trimmed) return null
          const parsed = Number.parseFloat(trimmed)
          return Number.isFinite(parsed) ? parsed : null
        }

        const parseReps = (value: string | null | undefined): number | null => {
          const parsed = parseNumeric(value)
          if (parsed === null) return null
          const reps = Math.round(parsed)
          return reps > 0 ? reps : null
        }

        const toKg = (value: number | null, unit: WeightUnit): number | null => {
          if (value === null) return null
          return preferredToKg(value, unit)
        }

        const normalizedExercises = (pending.structuredData ?? [])
          .map((exercise, exerciseIndex) => {
            const name = exercise.name?.trim() ?? ''
            const unit = pending.weightUnit

            const sets = (exercise.sets ?? [])
              .map((set) => {
                const reps = parseReps(set.reps)
                const weightInput = parseNumeric(set.weight)
                const weightKg = toKg(weightInput, unit)
                const isWarmup = set.isWarmup === true

                if (reps === null && weightKg === null) {
                  return null
                }

                return {
                  reps,
                  weightKg,
                  isWarmup,
                }
              })
              .filter((s): s is NonNullable<typeof s> => s !== null)
              .map((set, setIndex) => ({
                set_number: setIndex + 1,
                reps: set.reps,
                weight: set.weightKg,
                is_warmup: set.isWarmup,
              }))

            return {
              name,
              order_index: exerciseIndex,
              sets,
            }
          })
          .filter((exercise) => exercise.name.length > 0 && exercise.sets.length > 0)

        if (normalizedExercises.length === 0) {
          throw new Error('No structured sets to save')
        }

        // 1) Create workout session
        const { data: createdSession, error: sessionError } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: pending.userId,
            raw_text: pending.notes,
            notes: pending.description ?? null,
            type: pending.title,
            image_url: pending.imageUrl ?? null,
            routine_id: pending.routineId ?? null,
            duration:
              typeof pending.durationSeconds === 'number'
                ? pending.durationSeconds
                : null,
          })
          .select()
          .single()

        if (sessionError) throw sessionError

        // 2) Resolve exercises + insert workout_exercises
        const exerciseMap = new Map<string, { id: string }>()
        for (const ex of normalizedExercises) {
          const resolved = await database.exercises.getOrCreate(ex.name, pending.userId)
          exerciseMap.set(ex.name.toLowerCase(), { id: resolved.id })
        }

        const workoutExercisesToInsert = normalizedExercises.map((ex) => {
          const resolved = exerciseMap.get(ex.name.toLowerCase())
          if (!resolved) {
            throw new Error(`Exercise not found: ${ex.name}`)
          }
          return {
            session_id: createdSession.id,
            exercise_id: resolved.id,
            order_index: ex.order_index,
            notes: null,
          }
        })

        const { data: workoutExercises, error: workoutExerciseError } = await supabase
          .from('workout_exercises')
          .insert(workoutExercisesToInsert)
          .select()

        if (workoutExerciseError) throw workoutExerciseError

        // 3) Insert sets (with warmup flag)
        const allSetsToInsert = normalizedExercises.flatMap((ex, index) => {
          const workoutExercise = workoutExercises?.[index]
          if (!workoutExercise) return []

          return ex.sets.map((set) => ({
            workout_exercise_id: workoutExercise.id,
            set_number: set.set_number,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            rpe: null,
            notes: null,
            is_warmup: set.is_warmup,
          }))
        })

        if (allSetsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('sets')
            .insert(allSetsToInsert)
          if (setsError) throw setsError
        }

        // 4) Fetch full hydrated session (like parse-workout does)
        const { data: hydratedWorkout, error: fetchError } = await supabase
          .from('workout_sessions')
          .select(
            `
            *,
            routine:workout_routines (id, name),
            workout_exercises (
              *,
              exercise:exercises (*),
              sets (*)
            )
          `,
          )
          .eq('id', createdSession.id)
          .single()

        if (fetchError) throw fetchError

        await clearPendingArtifacts()

        return {
          status: 'success',
          placeholder,
          workout: hydratedWorkout as WorkoutSessionWithDetails,
        }
      }

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
        },
        accessToken,
      )

      if (!response.createdWorkout) {
        throw new Error('Workout created without session payload')
      }

      await clearPendingArtifacts()

      // Do NOT clear draft here. The component that queued the workout is responsible for clearing its own draft.
      // Clearing here causes race conditions where a *new* draft (created after the pending one was queued) gets deleted.

      return {
        status: 'success',
        placeholder,
        workout: response.createdWorkout,
        response,
      }
    } catch (error) {
      // Save back to draft so the user doesn't lose data
      await saveDraft({
        notes: pending.notes,
        title: pending.title,
        structuredData: pending.structuredData ?? [],
        isStructuredMode: pending.isStructuredMode ?? false,
        selectedRoutineId: pending.routineId ?? null,
      })
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
