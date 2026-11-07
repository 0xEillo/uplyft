import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
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
  /**
   * Current elapsed workout time, computed on demand. The ticking value is
   * deliberately NOT part of this context (it would re-render every consumer
   * once per second); subscribe with `useWorkoutElapsedSeconds` instead.
   */
  getElapsedSeconds: () => number
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

interface ElapsedSecondsStore {
  get: () => number
  set: (value: number) => void
  subscribe: (listener: () => void) => () => void
}

function createElapsedSecondsStore(): ElapsedSecondsStore {
  let value = 0
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      if (next === value) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const WorkoutElapsedSecondsContext = createContext<ElapsedSecondsStore | null>(
  null,
)

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
  const [elapsedStore] = useState(createElapsedSecondsStore)
  useEffect(() => {
    elapsedStore.set(elapsedSeconds)
  }, [elapsedStore, elapsedSeconds])
  const getElapsedSeconds = useCallback(
    () => getWorkoutComposerElapsedSeconds(sessionRef.current, Date.now()),
    [],
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

    const action = {
      type: 'update_draft' as const,
      patch,
      now: Date.now(),
      nowIso: new Date().toISOString(),
    }
    // Track the latest state eagerly (the reducer is pure) so a functional
    // update issued before React commits - e.g. async history placeholders
    // landing while the user types - builds on the newest draft instead of
    // overwriting the keystroke.
    sessionRef.current = workoutComposerReducer(sessionRef.current, action)
    dispatch(action)
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
      getElapsedSeconds,
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
      enqueueCurrentSession,
      enterReview,
      getElapsedSeconds,
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
      <WorkoutElapsedSecondsContext.Provider value={elapsedStore}>
        {children}
      </WorkoutElapsedSecondsContext.Provider>
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

function identity<T>(value: T) {
  return value
}

/**
 * Subscribe to the ticking workout timer. Only components using this hook
 * re-render each second. Pass a selector (e.g. `(s) => s > 0`) to re-render
 * only when the derived value changes.
 */
export function useWorkoutElapsedSeconds(): number
export function useWorkoutElapsedSeconds<T>(selector: (seconds: number) => T): T
export function useWorkoutElapsedSeconds<T>(
  selector: (seconds: number) => T = identity as (seconds: number) => T,
): T {
  const store = useContext(WorkoutElapsedSecondsContext)
  if (!store) {
    throw new Error(
      'useWorkoutElapsedSeconds must be used within a WorkoutComposerProvider',
    )
  }

  return useSyncExternalStore(store.subscribe, () => selector(store.get()))
}
