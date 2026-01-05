import {
    TRIAL_FEATURE_TO_STEP,
    TrialFeatureId,
    TUTORIAL_DISMISSED_KEY,
    TUTORIAL_STEPS,
    TUTORIAL_STORAGE_KEY,
    TUTORIAL_TRIAL_USED_KEY,
    TutorialStepId,
} from '@/constants/tutorial'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

export interface TutorialStep {
  id: TutorialStepId
  title: string
  description: string
  icon: string
  route: string | null
  completed: boolean
  trialFeature: TrialFeatureId | null
}

interface TutorialContextValue {
  // Tutorial state
  tutorialSteps: TutorialStep[]
  completedSteps: Set<TutorialStepId>
  isTutorialComplete: boolean
  isTutorialDismissed: boolean
  isLoading: boolean

  // Step completion (synchronous - storage saves in background)
  completeStep: (stepId: TutorialStepId) => void

  // Trial system for Pro features
  // Returns true if the user can use this feature for free (hasn't used trial yet)
  canUseTrial: (featureId: TrialFeatureId) => boolean
  // Call this when user actually uses the trial (e.g., generates a workout)
  consumeTrial: (featureId: TrialFeatureId) => void
  // Check if trial has been consumed for a feature
  isTrialConsumed: (featureId: TrialFeatureId) => boolean

  // Tutorial management
  dismissTutorial: () => Promise<void>
  resetTutorial: () => Promise<void>
}

const TutorialContext = createContext<TutorialContextValue | undefined>(
  undefined,
)

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [completedSteps, setCompletedSteps] = useState<Set<TutorialStepId>>(
    new Set(),
  )
  const [consumedTrials, setConsumedTrials] = useState<Set<TrialFeatureId>>(
    new Set(),
  )
  const [isTutorialDismissed, setIsTutorialDismissed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Track the previous user ID to detect user changes
  const previousUserIdRef = useRef<string | null>(null)
  
  // User-scoped storage keys to ensure each user has their own tutorial progress
  const storageKeys = useMemo(() => {
    const userId = user?.id
    if (!userId) {
      return {
        progress: TUTORIAL_STORAGE_KEY,
        dismissed: TUTORIAL_DISMISSED_KEY,
        trial: TUTORIAL_TRIAL_USED_KEY,
      }
    }
    return {
      progress: `${TUTORIAL_STORAGE_KEY}_${userId}`,
      dismissed: `${TUTORIAL_DISMISSED_KEY}_${userId}`,
      trial: `${TUTORIAL_TRIAL_USED_KEY}_${userId}`,
    }
  }, [user?.id])

  // Load tutorial progress and trial usage from AsyncStorage
  // Re-run when user changes to load the correct user's progress
  useEffect(() => {
    const loadProgress = async () => {
      // Detect user change and reset state
      const currentUserId = user?.id || null
      if (previousUserIdRef.current !== null && previousUserIdRef.current !== currentUserId) {
        // User changed - reset state before loading new user's data
        console.log('[Tutorial] User changed, resetting tutorial state')
        setCompletedSteps(new Set())
        setConsumedTrials(new Set())
        setIsTutorialDismissed(false)
      }
      previousUserIdRef.current = currentUserId
      
      // If no user, just set loading to false with default state
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      
      try {
        const [progressData, dismissedData, trialData] = await Promise.all([
          AsyncStorage.getItem(storageKeys.progress),
          AsyncStorage.getItem(storageKeys.dismissed),
          AsyncStorage.getItem(storageKeys.trial),
        ])


        // Start with auto-completed steps
        const autoCompletedSteps = TUTORIAL_STEPS
          .filter((s) => s.autoComplete)
          .map((s) => s.id)
        const initialSteps = new Set<TutorialStepId>(autoCompletedSteps)

        // Merge with saved progress
        if (progressData) {
          const completed = JSON.parse(progressData) as TutorialStepId[]
          completed.forEach((id) => initialSteps.add(id))
        }

        setCompletedSteps(initialSteps)

        // Load consumed trials
        if (trialData) {
          const trials = JSON.parse(trialData) as TrialFeatureId[]
          setConsumedTrials(new Set(trials))
        }

        if (dismissedData === 'true') {
          setIsTutorialDismissed(true)
        }
      } catch (error) {
        console.error('[Tutorial] Error loading progress:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProgress()
  }, [user?.id, storageKeys])

  // Save step progress (needs to use userId-scoped key) - defined before useEffect that uses it
  const saveStepProgress = useCallback(async (steps: Set<TutorialStepId>) => {
    if (!user?.id) return // Don't save if no user
    try {
      const stepsArray = Array.from(steps)
      await AsyncStorage.setItem(storageKeys.progress, JSON.stringify(stepsArray))
    } catch (error) {
      console.error('[Tutorial] Error saving progress:', error)
    }
  }, [user?.id, storageKeys.progress])

  // Save trial usage (needs to use userId-scoped key) - defined before useEffect that uses it
  const saveTrialUsage = useCallback(async (trials: Set<TrialFeatureId>) => {
    if (!user?.id) return // Don't save if no user
    try {
      const trialsArray = Array.from(trials)
      await AsyncStorage.setItem(storageKeys.trial, JSON.stringify(trialsArray))
    } catch (error) {
      console.error('[Tutorial] Error saving trial usage:', error)
    }
  }, [user?.id, storageKeys.trial])

  // Auto-complete steps for existing users based on database state
  useEffect(() => {
    if (!user || isLoading) return

    const checkExistingData = async () => {
      try {
        const stepsToComplete: TutorialStepId[] = []

        // Check for workouts
        const workoutCount = await database.workoutSessions.getTotalCount(user.id)
        if (workoutCount > 0 && !completedSteps.has('log_workout')) {
          stepsToComplete.push('log_workout')
        }

        // Check for routines
        const routines = await database.workoutRoutines.getAll(user.id)
        if (routines.length > 0 && !completedSteps.has('create_routine')) {
          stepsToComplete.push('create_routine')
        }

        // Check for body logs
        const bodyLogEntries = await database.bodyLog.getEntriesPage(user.id, 0, 1)
        if (bodyLogEntries.entries.length > 0 && !completedSteps.has('body_log')) {
          stepsToComplete.push('body_log')
        }

        if (stepsToComplete.length > 0) {
          setCompletedSteps((prev) => {
            const newSet = new Set(prev)
            stepsToComplete.forEach((id) => newSet.add(id))
            saveStepProgress(newSet)
            return newSet
          })
        }
      } catch (error) {
        console.error('[Tutorial] Error checking existing data:', error)
      }
    }

    checkExistingData()
  }, [user, isLoading, completedSteps.size, saveStepProgress]) // Use size to avoid infinite loop if we update

  // Complete a tutorial step (synchronous - storage saves in background)
  const completeStep = useCallback(
    (stepId: TutorialStepId) => {
      setCompletedSteps((prev) => {
        if (prev.has(stepId)) return prev
        const newSet = new Set(prev)
        newSet.add(stepId)
        // Fire and forget - don't await
        saveStepProgress(newSet)
        return newSet
      })
    },
    [saveStepProgress],
  )

  // Check if user can use a free trial for a feature
  // Returns true if trial hasn't been consumed yet
  const canUseTrial = useCallback(
    (featureId: TrialFeatureId): boolean => {
      const isConsumed = consumedTrials.has(featureId)
      const canUse = !isConsumed
      // Subtle log to avoid spamming every render, but useful for debugging paywall issues
      return canUse
    },
    [consumedTrials],
  )

  // Check if trial has been consumed
  const isTrialConsumed = useCallback(
    (featureId: TrialFeatureId): boolean => {
      return consumedTrials.has(featureId)
    },
    [consumedTrials],
  )

  // Consume a trial (called when user actually uses the feature)
  // This also completes the associated tutorial step (synchronous - storage saves in background)
  const consumeTrial = useCallback(
    (featureId: TrialFeatureId) => {
      // Mark trial as consumed
      setConsumedTrials((prev) => {
        if (prev.has(featureId)) return prev
        const newSet = new Set(prev)
        newSet.add(featureId)
        // Fire and forget - don't await
        saveTrialUsage(newSet)
        return newSet
      })

      // Also complete the associated tutorial step
      const stepId = TRIAL_FEATURE_TO_STEP[featureId]
      if (stepId) {
        completeStep(stepId)
      }
    },
    [saveTrialUsage, completeStep],
  )

  // Dismiss the tutorial checklist
  const dismissTutorial = useCallback(async () => {
    if (!user?.id) return // Don't save if no user
    try {
      await AsyncStorage.setItem(storageKeys.dismissed, 'true')
      setIsTutorialDismissed(true)
    } catch (error) {
      console.error('[Tutorial] Error dismissing tutorial:', error)
    }
  }, [user?.id, storageKeys.dismissed])

  // Reset tutorial (for testing)
  const resetTutorial = useCallback(async () => {
    if (!user?.id) return // Don't reset if no user
    try {
      await Promise.all([
        AsyncStorage.removeItem(storageKeys.progress),
        AsyncStorage.removeItem(storageKeys.dismissed),
        AsyncStorage.removeItem(storageKeys.trial),
      ])
      setCompletedSteps(new Set())
      setConsumedTrials(new Set())
      setIsTutorialDismissed(false)
    } catch (error) {
      console.error('[Tutorial] Error resetting tutorial:', error)
    }
  }, [user?.id, storageKeys])

  // Build tutorial steps with completion status
  const tutorialSteps: TutorialStep[] = TUTORIAL_STEPS.map((step) => ({
    ...step,
    completed: completedSteps.has(step.id),
  }))

  const isTutorialComplete = completedSteps.size === TUTORIAL_STEPS.length

  const value: TutorialContextValue = {
    tutorialSteps,
    completedSteps,
    isTutorialComplete,
    isTutorialDismissed,
    isLoading,
    completeStep,
    canUseTrial,
    consumeTrial,
    isTrialConsumed,
    dismissTutorial,
    resetTutorial,
  }

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider')
  }
  return context
}
