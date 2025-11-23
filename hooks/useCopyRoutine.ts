import { supabase } from '@/lib/supabase'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { useState } from 'react'

export function useCopyRoutine() {
  const [isCopying, setIsCopying] = useState(false)

  const copyRoutine = async (routine: WorkoutRoutineWithDetails, userId: string) => {
    setIsCopying(true)
    try {
      // 1. Extract exercise names
      const exerciseNames = routine.workout_routine_exercises
        .map(e => e.exercise.name)
        .filter(Boolean)

      // 2. Resolve exercises using the edge function
      const { data: resolutionData, error: resolutionError } = await supabase.functions.invoke('resolve-exercises', {
        body: { exerciseNames, userId }
      })

      if (resolutionError) throw resolutionError
      const resolutions = resolutionData.resolutions || {}

      // 3. Create new routine
      const { data: newRoutine, error: routineError } = await supabase
        .from('workout_routines')
        .insert({
          user_id: userId,
          name: routine.name, 
          notes: routine.notes,
        })
        .select()
        .single()

      if (routineError) throw routineError

      // 4. Prepare exercises
      const newExercises = []
      
      for (const oldEx of routine.workout_routine_exercises) {
        const resolved = resolutions[oldEx.exercise.name]
        
        // If resolution failed, we might want to fallback or skip. 
        // For now, we skip if no ID is returned.
        if (!resolved?.id) {
            console.warn(`Could not resolve exercise: ${oldEx.exercise.name}`)
            continue
        }

        newExercises.push({
          routine_id: newRoutine.id,
          exercise_id: resolved.id,
          order_index: oldEx.order_index,
          notes: oldEx.notes,
        })
      }

      if (newExercises.length === 0) {
          return newRoutine
      }

      const { error: exInsertError } = await supabase
        .from('workout_routine_exercises')
        .insert(newExercises)

      if (exInsertError) throw exInsertError

      // 5. Fetch back to get new IDs for sets
      const { data: insertedExercises, error: fetchError } = await supabase
        .from('workout_routine_exercises')
        .select('id, order_index')
        .eq('routine_id', newRoutine.id)

      if (fetchError) throw fetchError

      const exerciseIdMap = new Map(insertedExercises.map(e => [e.order_index, e.id]))

      // 6. Prepare sets
      const newSets = []
      for (const oldEx of routine.workout_routine_exercises) {
        const newExId = exerciseIdMap.get(oldEx.order_index)
        if (!newExId) continue

        if (oldEx.sets && oldEx.sets.length > 0) {
            for (const set of oldEx.sets) {
              newSets.push({
                routine_exercise_id: newExId,
                set_number: set.set_number,
                reps_min: set.reps_min,
                reps_max: set.reps_max,
                rest_seconds: set.rest_seconds,
              })
            }
        }
      }

      if (newSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_routine_sets')
          .insert(newSets)

        if (setsError) throw setsError
      }

      return newRoutine
    } catch (error) {
      console.error('Error copying routine:', error)
      throw error
    } finally {
      setIsCopying(false)
    }
  }

  return { copyRoutine, isCopying }
}
