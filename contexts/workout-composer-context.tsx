import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import { useAuth } from '@/contexts/auth-context'
import { useLiveActivity } from '@/contexts/live-activity-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getDefaultWorkoutTitle } from '@/lib/utils/workout-composer-format'
import {
  subscribeToWorkoutComposerSessionRestored,
} from '@/lib/utils/workout-composer-events'
import {
  canReviewWorkoutComposerSession,
  createEmptyWorkoutComposerSession,
  getWorkoutComposerElapsedSeconds,
  hasActiveWorkoutComposerSession,
  type WorkoutComposerDraftPatch,
  type WorkoutComposerDraftState,
  type WorkoutComposerReviewPatch,
  type WorkoutComposerReviewState,
  type WorkoutComposerRoutineSource,
  type WorkoutComposerSession,
  workoutComposerReducer,
} from '@/lib/utils/workout-composer-session'
import {
  clearStoredWorkoutComposerSession,
  loadWorkoutComposerSessionWithMigration,
  saveStoredWorkoutComposerSession,
} from '@/lib/utils/workout-composer-storage'
import { beginSingleFlight, endSingleFlight } from '@/lib/utils/single-flight'
import {
  enqueueWorkoutSubmission,
} from '@/lib/utils/workout-submission-queue'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import type { WorkoutSong } from '@/types/music'

interface SeedRoutineInput {
  title: string
  structuredData: StructuredExerciseDraft[]
  selectedRoutineId: string | null
  routineSource: WorkoutComposerRoutineSource
  song?: WorkoutSong | null
}

interface WorkoutComposerContextValue {
  session: WorkoutComposerSession
  draft: WorkoutComposerDraftState
  review: WorkoutComposerReviewState
  hasHydrated: boolean
  hasActiveSession: boolean
  elapsedSeconds: number
  canReview: boolean
  canDiscard: boolean
  isReviewing: boolean
  updateDraft: (
    update:
      | WorkoutComposerDraftPatch
      | ((draft: WorkoutComposerDraftState) => WorkoutComposerDraftPatch),
  ) => void
  updateReview: (
    update:
      | WorkoutComposerReviewPatch
      | ((review: WorkoutComposerReviewState) => WorkoutComposerReviewPatch),
  ) => void
  seedRoutine: (input: SeedRoutineInput) => void
  enterReview: () => boolean
  returnToEditing: () => void
  discardSession: () => void
  enqueueCurrentSession: () => Promise<void>
}

const WorkoutComposerContext = createContext<
  WorkoutComposerContextValue | undefined
>(undefined)

export function WorkoutComposerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const { weightUnit } = useWeightUnits()
  const {
    startWorkoutActivity,
    stopWorkoutActivity,
    updateWorkoutActivity,
  } = useLiveActivity()
  const [session, dispatch] = useReducer(
    workoutComposerReducer,
    undefined,
    createEmptyWorkoutComposerSession,
  )
  const [hasHydrated, setHasHydrated] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())
  const sessionRef = useRef(session)
  const hasStartedActivityRef = useRef(false)
  const isEnqueueingRef = useRef(false)
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const hydratedSession = await loadWorkoutComposerSessionWithMigration()
      if (cancelled) return

      dispatch({ type: 'hydrate', session: hydratedSession })
      setHasHydrated(true)
    }

    hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return subscribeToWorkoutComposerSessionRestored((restoredSession) => {
      dispatch({ type: 'hydrate', session: restoredSession })
    })
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current)
    }

    persistTimeoutRef.current = setTimeout(() => {
      persistTimeoutRef.current = null
      void saveStoredWorkoutComposerSession(session)
    }, 250)

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
        persistTimeoutRef.current = null
      }
    }
  }, [hasHydrated, session])

  useEffect(() => {
    if (session.timer.status !== 'running') {
      setNowMs(Date.now())
      return
    }

    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [session.timer.status])

  const elapsedSeconds = useMemo(
    () => getWorkoutComposerElapsedSeconds(session, nowMs),
    [nowMs, session],
  )
  const hasActiveSession = hasActiveWorkoutComposerSession(session)
  const canReview = canReviewWorkoutComposerSession(session)
  const canDiscard = hasActiveSession
  const isReviewing =
    session.stage === 'reviewing' || session.stage === 'enqueueing'

  useEffect(() => {
    if (session.timer.status === 'running' && elapsedSeconds > 0) {
      if (!hasStartedActivityRef.current) {
        startWorkoutActivity()
        hasStartedActivityRef.current = true
      } else {
        updateWorkoutActivity(elapsedSeconds)
      }
      return
    }

    if (hasStartedActivityRef.current) {
      stopWorkoutActivity()
      hasStartedActivityRef.current = false
    }
  }, [
    elapsedSeconds,
    session.timer.status,
    startWorkoutActivity,
    stopWorkoutActivity,
    updateWorkoutActivity,
  ])

  const updateDraft = useCallback<
    WorkoutComposerContextValue['updateDraft']
  >((update) => {
    const currentDraft = sessionRef.current.draft
    const patch =
      typeof update === 'function' ? update(currentDraft) : update

    dispatch({
      type: 'update_draft',
      patch,
      now: Date.now(),
      nowIso: new Date().toISOString(),
    })
  }, [])

  const updateReview = useCallback<
    WorkoutComposerContextValue['updateReview']
  >((update) => {
    const currentReview = sessionRef.current.review
    const patch =
      typeof update === 'function' ? update(currentReview) : update

    dispatch({
      type: 'update_review',
      patch,
      now: Date.now(),
    })
  }, [])

  const seedRoutine = useCallback((input: SeedRoutineInput) => {
    dispatch({
      type: 'seed_routine',
      title: input.title,
      structuredData: input.structuredData,
      selectedRoutineId: input.selectedRoutineId,
      routineSource: input.routineSource,
      song: input.song ?? null,
      now: Date.now(),
      nowIso: new Date().toISOString(),
    })
  }, [])

  const enterReview = useCallback(() => {
    const currentSession = sessionRef.current
    if (!canReviewWorkoutComposerSession(currentSession)) {
      return false
    }

    dispatch({
      type: 'enter_review',
      now: Date.now(),
      nowIso: new Date().toISOString(),
      defaultTitle: getDefaultWorkoutTitle(),
    })

    return true
  }, [])

  const returnToEditing = useCallback(() => {
    if (!hasActiveWorkoutComposerSession(sessionRef.current)) {
      return
    }

    dispatch({
      type: 'return_to_editing',
      now: Date.now(),
    })
  }, [])

  const discardSession = useCallback(() => {
    dispatch({ type: 'discard' })
    void clearStoredWorkoutComposerSession()
  }, [])

  const enqueueCurrentSession = useCallback(async () => {
    if (!user) {
      throw new Error('User must be authenticated to submit workouts')
    }

    if (!beginSingleFlight(isEnqueueingRef)) {
      return
    }

    const currentSession = sessionRef.current

    dispatch({
      type: 'set_enqueueing',
      now: Date.now(),
    })

    try {
      await enqueueWorkoutSubmission({
        session: currentSession,
        userId: user.id,
        weightUnit,
      })
      dispatch({ type: 'discard' })
      await clearStoredWorkoutComposerSession()
    } catch (error) {
      dispatch({
        type: 'mark_enqueue_failed',
        now: Date.now(),
      })
      throw error
    } finally {
      endSingleFlight(isEnqueueingRef)
    }
  }, [user, weightUnit])

  const value = useMemo<WorkoutComposerContextValue>(
    () => ({
      session,
      draft: session.draft,
      review: session.review,
      hasHydrated,
      hasActiveSession,
      elapsedSeconds,
      canReview,
      canDiscard,
      isReviewing,
      updateDraft,
      updateReview,
      seedRoutine,
      enterReview,
      returnToEditing,
      discardSession,
      enqueueCurrentSession,
    }),
    [
      canDiscard,
      canReview,
      discardSession,
      elapsedSeconds,
      enqueueCurrentSession,
      enterReview,
      hasActiveSession,
      hasHydrated,
      isReviewing,
      returnToEditing,
      seedRoutine,
      session,
      updateDraft,
      updateReview,
    ],
  )

  return (
    <WorkoutComposerContext.Provider value={value}>
      {children}
    </WorkoutComposerContext.Provider>
  )
}

export function useWorkoutComposer() {
  const context = useContext(WorkoutComposerContext)
  if (!context) {
    throw new Error(
      'useWorkoutComposer must be used within a WorkoutComposerProvider',
    )
  }

  return context
}
