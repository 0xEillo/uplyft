import {
    TRIAL_FEATURE_TO_STEP,
    TrialFeatureId,
    TUTORIAL_DISMISSED_KEY,
    TUTORIAL_STEPS,
    TUTORIAL_STORAGE_KEY,
    TUTORIAL_TRIAL_USED_KEY,
    TutorialStepId,
} from '@/constants/tutorial'
import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
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
  const [completedSteps, setCompletedSteps] = useState<Set<TutorialStepId>>(
    new Set(),
  )
  const [consumedTrials, setConsumedTrials] = useState<Set<TrialFeatureId>>(
    new Set(),
  )
  const [isTutorialDismissed, setIsTutorialDismissed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load tutorial progress and trial usage from AsyncStorage
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const [progressData, dismissedData, trialData] = await Promise.all([
          AsyncStorage.getItem(TUTORIAL_STORAGE_KEY),
          AsyncStorage.getItem(TUTORIAL_DISMISSED_KEY),
          AsyncStorage.getItem(TUTORIAL_TRIAL_USED_KEY),
        ])

        console.log('[Tutorial] Loading stored data. progressData:', progressData, 'dismissedData:', dismissedData, 'trialData:', trialData)

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

        console.log('[Tutorial] Initializing completedSteps:', Array.from(initialSteps))
        setCompletedSteps(initialSteps)

        // Load consumed trials
        if (trialData) {
          const trials = JSON.parse(trialData) as TrialFeatureId[]
          console.log('[Tutorial] Initializing consumedTrials:', trials)
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
  }, [])

  // Save step progress
  const saveStepProgress = useCallback(async (steps: Set<TutorialStepId>) => {
    try {
      const stepsArray = Array.from(steps)
      console.log('[Tutorial] Saving progressData:', stepsArray)
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(stepsArray))
    } catch (error) {
      console.error('[Tutorial] Error saving progress:', error)
    }
  }, [])

  // Save trial usage
  const saveTrialUsage = useCallback(async (trials: Set<TrialFeatureId>) => {
    try {
      const trialsArray = Array.from(trials)
      console.log('[Tutorial] Saving trialData:', trialsArray)
      await AsyncStorage.setItem(TUTORIAL_TRIAL_USED_KEY, JSON.stringify(trialsArray))
    } catch (error) {
      console.error('[Tutorial] Error saving trial usage:', error)
    }
  }, [])

  // Complete a tutorial step (synchronous - storage saves in background)
  const completeStep = useCallback(
    (stepId: TutorialStepId) => {
      console.log('[Tutorial] Completing step:', stepId)
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
      if (isConsumed) console.log('[Tutorial] Trial already consumed for:', featureId)
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
      console.log('[Tutorial] Consuming trial for:', featureId)
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
        console.log('[Tutorial] Consuming trial also completes step:', stepId)
        completeStep(stepId)
      }
    },
    [saveTrialUsage, completeStep],
  )

  // Dismiss the tutorial checklist
  const dismissTutorial = useCallback(async () => {
    console.log('[Tutorial] Dismissing tutorial checklist')
    try {
      await AsyncStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true')
      setIsTutorialDismissed(true)
    } catch (error) {
      console.error('[Tutorial] Error dismissing tutorial:', error)
    }
  }, [])

  // Reset tutorial (for testing)
  const resetTutorial = useCallback(async () => {
    console.log('[Tutorial] Resetting all tutorial data')
    try {
      await Promise.all([
        AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY),
        AsyncStorage.removeItem(TUTORIAL_DISMISSED_KEY),
        AsyncStorage.removeItem(TUTORIAL_TRIAL_USED_KEY),
      ])
      setCompletedSteps(new Set())
      setConsumedTrials(new Set())
      setIsTutorialDismissed(false)
    } catch (error) {
      console.error('[Tutorial] Error resetting tutorial:', error)
    }
  }, [])

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
