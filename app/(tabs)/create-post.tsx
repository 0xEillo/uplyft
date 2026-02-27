import { EditorToolbar } from '@/components/editor-toolbar'
import { FinalizeWorkoutOverlay } from '@/components/FinalizeWorkoutOverlay'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Paywall } from '@/components/paywall'
import { RestTimerOverlay } from '@/components/RestTimerOverlay'
import { SlideUpView } from '@/components/slide-up-view'
import { StructuredWorkoutInput } from '@/components/structured-workout-input'
import { WorkoutCoachSheet } from '@/components/WorkoutCoachSheet'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useLiveActivity } from '@/contexts/live-activity-context'
import { useProfile } from '@/contexts/profile-context'
import { useRestTimerContext } from '@/contexts/rest-timer-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import {
  getExerciseSuggestion,
  parseRepRange,
  useExerciseAutocompleteGroup,
  useShowConvertButton,
} from '@/hooks/useExerciseAutocomplete'
import { useExerciseHistory } from '@/hooks/useExerciseHistory'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useFreemiumLimits } from '@/hooks/useFreemiumLimits'
import { useImageTranscription } from '@/hooks/useImageTranscription'
import { useRoutineSelection } from '@/hooks/useRoutineSelection'
import { SubmitWorkoutError, useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { clearExerciseHistoryCache } from '@/lib/services/exerciseHistoryService'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import {
  clearDraft as clearWorkoutDraft,
  compactDraft as compactWorkoutDraft,
  loadPendingWorkout,
  loadDraft as loadWorkoutDraft,
  saveDraft as saveWorkoutDraft,
  saveDraftPatch as saveWorkoutDraftPatch,
} from '@/lib/utils/workout-draft'
import { buildHydrationPlan } from '@/lib/utils/workout-draft-hydration'
import {
  generateWorkoutMessage,
  parseCommitment,
} from '@/lib/utils/workout-messages'
import {
  Exercise,
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import { TabActions, useFocusEffect, useNavigation } from '@react-navigation/native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const IS_DEV_RUNTIME =
  typeof (globalThis as { __DEV__?: boolean }).__DEV__ === 'boolean'
    ? ((globalThis as { __DEV__?: boolean }).__DEV__ as boolean)
    : process.env.NODE_ENV !== 'production'
const DEBUG_LOGS = false

function formatTimerDisplay(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))

  // If under 1 minute, show just seconds
  if (safeSeconds < 60) {
    return `${safeSeconds}`
  }

  // If 1 hour or more, show H:MM:SS
  if (safeSeconds >= 3600) {
    const hours = Math.floor(safeSeconds / 3600)
    const mins = Math.floor((safeSeconds % 3600) / 60)
    const secs = safeSeconds % 60
    return `${hours}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // If 1 minute or more (but under 1 hour), show M:SS
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const NEW_USER_STRUCTURED_PREVIEW: StructuredExerciseDraft[] = [
  {
    id: 'preview-bench-press',
    name: 'Bench Press',
    sets: [{ weight: '135', reps: '8' }],
  },
]

export default function CreatePostScreen() {
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const { scrollToTop } = useScrollToTop()
  const navigation = useNavigation()
  const { coachId } = useProfile()
  const coach = getCoach(coachId)
  const coachFirstName = coach.name.split(' ')[1] || coach.name
  const insets = useSafeAreaInsets()
  const isIOS = Platform.OS === 'ios'
  const bottomSafeInset =
    isIOS ? Math.min(insets.bottom, 34) : insets.bottom

  // Exercise history hook for creating exercises with last performance data
  const {
    createExerciseWithHistory,
    createEmptySet,
    fetchSetHistory,
  } = useExerciseHistory()
  const {
    selectedRoutineId: selectedRoutineIdParam,
    refresh: refreshParam,
  } = useLocalSearchParams<{
    selectedRoutineId?: string
    refresh?: string
  }>()
  const selectedRoutineId = selectedRoutineIdParam ?? null
  const refresh = refreshParam ?? null

  // =============================================================================
  // BASIC WORKOUT INPUT STATE
  // =============================================================================
  const [notes, setNotes] = useState('')
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // =============================================================================
  // FINALIZE OVERLAY STATE
  // =============================================================================
  const [showFinalizeOverlay, setShowFinalizeOverlay] = useState(false)
  const [finalizeDescription, setFinalizeDescription] = useState('')

  // =============================================================================
  // UI STATE
  // =============================================================================
  const [userWorkoutCount, setUserWorkoutCount] = useState(-1)
  const [showDraftSaved, setShowDraftSaved] = useState(false)
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showCoachSheet, setShowCoachSheet] = useState(false)
  const [selectedSong, setSelectedSong] = useState<WorkoutSong | null>(null)
  const handleStructuredPreviewChange = useCallback(() => {}, [])

  // =============================================================================
  // ROUTINE & STRUCTURED WORKOUT STATE
  // =============================================================================
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isStructuredMode, setIsStructuredMode] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [
    selectedRoutine,
    setSelectedRoutine,
  ] = useState<WorkoutRoutineWithDetails | null>(null)
  const {
    elapsedSeconds: workoutElapsedSeconds,
    isRunning: isWorkoutTimerRunning,
    start: startWorkoutTimer,
    pause: pauseWorkoutTimer,
    reset: resetWorkoutTimer,
    hydrate: hydrateWorkoutTimer,
    getElapsedSeconds: getWorkoutElapsedSeconds,
    serializableState: workoutTimerSerializableState,
  } = useWorkoutTimer()

  const [showRestTimer, setShowRestTimer] = useState(false)
  const restTimer = useRestTimerContext()
  const {
    startWorkoutActivity,
    updateWorkoutActivity,
    stopWorkoutActivity,
  } = useLiveActivity()

  const [structuredData, setStructuredData] = useState<
    StructuredExerciseDraft[]
  >([])
  const [pendingDraftRoutineId, setPendingDraftRoutineId] = useState<
    string | null
  >(null)
  const [pendingRoutineSource, setPendingRoutineSource] = useState<
    'route' | 'draft' | null
  >(null)

  const hasStructuredEntries = useMemo(() => {
    if (!isStructuredMode) return false
    if (structuredData.length === 0) return false
    return structuredData.some((exercise) =>
      exercise.sets.some((set) => set.weight.trim() || set.reps.trim()),
    )
  }, [isStructuredMode, structuredData])

  const hasWorkoutDraftContent = useMemo(() => {
    const hasStructuredSkeleton = structuredData.length > 0
    return (
      Boolean(notes.trim()) ||
      Boolean(workoutTitle.trim()) ||
      hasStructuredSkeleton ||
      Boolean(selectedRoutine) ||
      Boolean(pendingDraftRoutineId)
    )
  }, [
    notes,
    pendingDraftRoutineId,
    selectedRoutine,
    structuredData,
    workoutTitle,
  ])

  // Context for the AI coach sheet
  const workoutContext = useMemo(
    () => ({
      title: workoutTitle,
      notes,
      exercises: structuredData.map((e) => ({
        name: e.name,
        setsCount: e.sets.length,
        sets: e.sets
          .map((set) => ({
            weight: set.weight || undefined,
            reps: set.reps || undefined,
          }))
          .filter((set) => set.weight || set.reps),
      })),
    }),
    [workoutTitle, notes, structuredData],
  )

  // Check if workout is empty (no notes, no structured workouts)
  const isWorkoutEmpty = useMemo(
    () => !notes.trim() && !workoutTitle.trim() && !hasStructuredEntries,
    [notes, workoutTitle, hasStructuredEntries],
  )

  const shouldShowWorkoutTimer =
    hasWorkoutDraftContent || workoutElapsedSeconds > 0
  const headerTimerDisplay = formatTimerDisplay(
    Math.max(1, workoutElapsedSeconds ?? 0),
  )

  const handleStructuredDataChange = useCallback(
    (newData: StructuredExerciseDraft[]) => {
      setStructuredData(newData)
    },
    [],
  )

  const handleRestTimerStart = useCallback(
    (seconds: number) => {
      restTimer.start(seconds)
    },
    [restTimer],
  )

  // Navigate to exercise page if exercise exists in the database
  const handleExerciseNamePress = useCallback(
    (exerciseName: string) => {
      // Case-insensitive exact match
      const normalizedName = exerciseName.toLowerCase().trim()
      const matchedExercise = allExercises.find(
        (e) => e.name.toLowerCase().trim() === normalizedName,
      )

      if (matchedExercise) {
        router.push(`/exercise/${matchedExercise.id}`)
      }
      // If no match found, do nothing
    },
    [allExercises],
  )

  const [
    lastRoutineWorkout,
    setLastRoutineWorkout,
  ] = useState<WorkoutSessionWithDetails | null>(null)

  // =============================================================================
  // TEXT-TO-STRUCTURED CONVERSION STATE
  // =============================================================================
  const [cursorPosition, setCursorPosition] = useState(0)

  // Use hook for convert button visibility
  const showConvertButton = useShowConvertButton(
    notes,
    cursorPosition,
    isNotesFocused,
  )

  const previousLineCount = useRef(0)

  // =============================================================================
  // IMAGE ATTACHMENT STATE
  // =============================================================================
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null)

  const { showStreakOverlay } = useSuccessOverlay()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const spinValue = useRef(new Animated.Value(0)).current
  const buttonScaleAnim = useRef(new Animated.Value(1)).current
  const imageOpacity = useRef(new Animated.Value(0)).current

  const titleInputRef = useRef<TextInput>(null)
  const notesInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const notesRef = useRef(notes)
  const titleRef = useRef(workoutTitle)
  const structuredDataRef = useRef(structuredData)
  const isStructuredModeRef = useRef(isStructuredMode)
  const selectedRoutineIdRef = useRef<string | null>(null)
  const pendingDraftRoutineIdRef = useRef<string | null>(null)
  const workoutTimerStateRef = useRef(workoutTimerSerializableState)
  const lastLocalEditAtRef = useRef(0)
  const lastDraftSavedAtRef = useRef(0)
  const lastRouteRoutineTokenRef = useRef<string | null>(null)
  const hasHydratedRef = useRef(false)
  const isScreenFocusedRef = useRef(false)
  const suppressLocalEditTrackingRef = useRef(false)
  const suppressDraftToastRef = useRef(false)
  // Skip counter - decrements each time auto-save would run, skips while > 0
  const skipPersistCountRef = useRef(0)
  const isHydratingRef = useRef(true)
  const isSubmittingRef = useRef(false)
  const hadWorkoutDraftContentRef = useRef(false)
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { isProMember } = useSubscription()
  const { completeStep } = useTutorial()
  const { submitWorkout: queueWorkout } = useSubmitWorkout()
  const { canPostWorkout, refresh: refreshFreemiumLimits } = useFreemiumLimits()

  const logDraftDebug = useCallback(
    (_event: string, _payload?: Record<string, unknown>) => {
      if (!DEBUG_LOGS || !IS_DEV_RUNTIME) return
    },
    [],
  )

  const buildDraftMetrics = useCallback((data: StructuredExerciseDraft[]) => {
    let setsWithData = 0
    data.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.weight?.trim() || set.reps?.trim()) {
          setsWithData += 1
        }
      })
    })

    return {
      structuredExercisesCount: data.length,
      structuredSetsWithDataCount: setsWithData,
    }
  }, [])

  const persistDraft = useCallback(
    (source: 'unmount' | 'background' | 'blur') => {
      // Never persist while hydration is in progress; this can overwrite a valid
      // on-disk draft with initial empty state during app lifecycle transitions.
      if (isHydratingRef.current || !hasHydratedRef.current) {
        logDraftDebug('persist-skipped', {
          source,
          isHydrating: isHydratingRef.current,
          hasHydrated: hasHydratedRef.current,
        })
        return
      }

      const routineIdToSave =
        selectedRoutineIdRef.current ?? pendingDraftRoutineIdRef.current ?? null
      const updatedAt = Math.max(Date.now(), lastLocalEditAtRef.current)
      lastDraftSavedAtRef.current = updatedAt
      const hasInMemoryDraftContent =
        Boolean(notesRef.current.trim()) ||
        Boolean(titleRef.current.trim()) ||
        structuredDataRef.current.length > 0 ||
        Boolean(routineIdToSave) ||
        Boolean(workoutTimerStateRef.current.timerStartedAt) ||
        (workoutTimerStateRef.current.timerElapsedSeconds ?? 0) > 0

      // Do not compact empty in-memory state; this can clear a valid on-disk draft
      // if a non-focused/preloaded instance unmounts.
      if (!hasInMemoryDraftContent) {
        logDraftDebug('persist-skipped-empty', {
          source,
          updatedAt,
        })
        return
      }

      logDraftDebug('persist-start', {
        source,
        updatedAt,
        notesLength: notesRef.current.trim().length,
        hasTitle: Boolean(titleRef.current.trim()),
        structuredCount: structuredDataRef.current.length,
        hasRoutine: Boolean(routineIdToSave),
        timerStartedAt: workoutTimerStateRef.current.timerStartedAt,
        timerElapsedSeconds: workoutTimerStateRef.current.timerElapsedSeconds,
      })

      void compactWorkoutDraft({
        notes: notesRef.current,
        title: titleRef.current,
        structuredData: structuredDataRef.current,
        isStructuredMode: isStructuredModeRef.current,
        selectedRoutineId: routineIdToSave,
        timerStartedAt: workoutTimerStateRef.current.timerStartedAt,
        timerElapsedSeconds: workoutTimerStateRef.current.timerElapsedSeconds,
        updatedAt,
      })
        .then(() => {
          logDraftDebug('persist-success', {
            source,
            updatedAt,
          })
          const metrics = buildDraftMetrics(structuredDataRef.current)
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'compact',
            source,
            length: notesRef.current.trim().length,
            hasTitle: Boolean(titleRef.current.trim()),
            updatedAt,
            ...metrics,
          })
        })
        .catch((error) => {
          console.error(`[Draft] ${source} compact failed:`, error)
          logDraftDebug('persist-failed', {
            source,
            error: error instanceof Error ? error.message : String(error),
          })
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'fail',
            source,
            reason: 'compact_failed',
            error: error instanceof Error ? error.message : String(error),
            length: notesRef.current.trim().length,
            hasTitle: Boolean(titleRef.current.trim()),
            updatedAt,
            ...buildDraftMetrics(structuredDataRef.current),
          })
        })
    },
    [buildDraftMetrics, logDraftDebug, trackEvent],
  )

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    titleRef.current = workoutTitle
  }, [workoutTitle])

  useEffect(() => {
    structuredDataRef.current = structuredData
  }, [structuredData])

  useEffect(() => {
    isStructuredModeRef.current = isStructuredMode
  }, [isStructuredMode])

  useEffect(() => {
    selectedRoutineIdRef.current = selectedRoutine?.id ?? null
  }, [selectedRoutine?.id])

  useEffect(() => {
    pendingDraftRoutineIdRef.current = pendingDraftRoutineId
  }, [pendingDraftRoutineId])

  useEffect(() => {
    workoutTimerStateRef.current = workoutTimerSerializableState
  }, [workoutTimerSerializableState])

  useEffect(() => {
    if (isHydratingRef.current || !hasHydratedRef.current) {
      return
    }
    if (suppressLocalEditTrackingRef.current) {
      suppressLocalEditTrackingRef.current = false
      return
    }
    lastLocalEditAtRef.current = Date.now()
  }, [
    notes,
    workoutTitle,
    structuredData,
    isStructuredMode,
    selectedRoutine?.id,
  ])

  useEffect(() => {
    if (isHydratingRef.current || !isScreenFocusedRef.current) {
      return
    }

    const hadWorkoutDraftContent = hadWorkoutDraftContentRef.current
    hadWorkoutDraftContentRef.current = hasWorkoutDraftContent

    if (hasWorkoutDraftContent) {
      if (!isWorkoutTimerRunning) {
        startWorkoutTimer()
      }
      return
    }

    // If the user manually clears all draft content, treat it like a cleared draft:
    // reset timer state and remove persisted draft data.
    if (hadWorkoutDraftContent) {
      resetWorkoutTimer()
      void clearWorkoutDraft('create-post-empty-input')
    }
  }, [
    hasWorkoutDraftContent,
    isWorkoutTimerRunning,
    resetWorkoutTimer,
    startWorkoutTimer,
  ])

  // Sync Live Activity with workout timer for Dynamic Island display
  const hasStartedActivityRef = useRef(false)
  useEffect(() => {
    if (isWorkoutTimerRunning && workoutElapsedSeconds > 0) {
      if (!hasStartedActivityRef.current) {
        // First time seeing a running timer in this session - start the activity
        startWorkoutActivity()
        hasStartedActivityRef.current = true
      } else {
        // Already started - just update
        updateWorkoutActivity(workoutElapsedSeconds)
      }
    } else if (hasStartedActivityRef.current) {
      // Timer stopped or cleared - stop the activity
      stopWorkoutActivity()
      hasStartedActivityRef.current = false
    }
  }, [
    isWorkoutTimerRunning,
    workoutElapsedSeconds,
    startWorkoutActivity,
    updateWorkoutActivity,
    stopWorkoutActivity,
  ])

  const blurInputs = useCallback(() => {
    const textInputState = (TextInput as any)?.State
    const activeInput = textInputState?.currentlyFocusedInput?.()

    if (activeInput) {
      textInputState?.blurTextInput?.(activeInput)
    }

    titleInputRef.current?.blur?.()
    notesInputRef.current?.blur?.()
    Keyboard.dismiss()
  }, [])

  const resetLocalWorkoutDraftState = useCallback(() => {
    suppressLocalEditTrackingRef.current = true
    suppressDraftToastRef.current = true
    // Skip the next few autosaves while reset state propagates.
    skipPersistCountRef.current = 3

    // Update refs immediately so any lifecycle-triggered persist in the same
    // tick sees cleared state and cannot recreate a discarded draft.
    notesRef.current = ''
    titleRef.current = ''
    structuredDataRef.current = []
    isStructuredModeRef.current = false
    selectedRoutineIdRef.current = null
    pendingDraftRoutineIdRef.current = null
    workoutTimerStateRef.current = {
      timerStartedAt: null,
      timerElapsedSeconds: 0,
    }

    resetWorkoutTimer()
    setNotes('')
    setWorkoutTitle('')
    setAttachedImageUri(null)
    setIsStructuredMode(false)
    setSelectedRoutine(null)
    setPendingDraftRoutineId(null)
    setPendingRoutineSource(null)
    setStructuredData([])
    setLastRoutineWorkout(null)
    setFinalizeDescription('')
    setSelectedSong(null)

    lastDraftSavedAtRef.current = 0
    lastLocalEditAtRef.current = 0
  }, [resetWorkoutTimer])

  // Use audio transcription hook
  const {
    isRecording,
    isTranscribing,
    toggleRecording,
    stopRecording,
  } = useAudioTranscription({
    weightUnit,
    onStructuredTranscriptionComplete: (data) => {
      // Set title if extracted and not already set
      if (data.title && !workoutTitle.trim()) {
        setWorkoutTitle(data.title)
      }

      // Convert parsed exercises to StructuredExerciseDraft format
      const structuredExercises: StructuredExerciseDraft[] = data.exercises.map(
        (exercise) => ({
          id: exercise.id,
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            isWarmup: false,
            lastWorkoutWeight: null,
            lastWorkoutReps: null,
            targetRepsMin: null,
            targetRepsMax: null,
            targetRestSeconds: null,
          })),
        }),
      )

      // Append structured exercises and enable structured mode
      setStructuredData((prev) => [...prev, ...structuredExercises])
      setIsStructuredMode(true)
    },
    onTranscriptionComplete: (text) => {
      // Fallback: if structured parsing fails, append raw text to notes
      setNotes((prev) => (prev ? `${prev}\n${text}` : text))
    },
  })

  // Use image transcription hook
  const {
    isProcessing: isProcessingImage,
    handleScanWithCamera,
    handleScanWithLibrary,
    handleAttachWithCamera,
    handleAttachWithLibrary,
  } = useImageTranscription({
    onStructuredExtractionComplete: (data) => {
      // Set title if extracted
      if (data.title) {
        setWorkoutTitle(data.title)
      }

      // Set description in notes if provided
      if (data.description) {
        const desc = data.description
        setNotes((prev) => (prev ? `${prev}\n\n${desc}` : desc))
      }

      // Convert parsed exercises to StructuredExerciseDraft format
      const structuredExercises: StructuredExerciseDraft[] = data.exercises.map(
        (exercise) => ({
          id: exercise.id,
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            isWarmup: false,
            lastWorkoutWeight: null,
            lastWorkoutReps: null,
            targetRepsMin: null,
            targetRepsMax: null,
            targetRestSeconds: null,
          })),
        }),
      )

      // Set the structured data and enable structured mode
      setStructuredData((prev) => [...prev, ...structuredExercises])
      setIsStructuredMode(true)
    },
    onExtractionComplete: (data) => {
      // Fallback: if structured parsing fails, use the old text-based approach
      if (data.title) {
        setWorkoutTitle(data.title)
      }
      const newNotes = data.description
        ? `${data.description}\n\n${data.workout}`
        : data.workout
      setNotes((prev) => (prev ? `${prev}\n\n${newNotes}` : newNotes))
    },
    onImageAttached: (uri) => {
      imageOpacity.setValue(0)
      setAttachedImageUri(uri)
    },
  })

  const styles = createStyles(colors, {
    ...insets,
    bottom: bottomSafeInset,
  })

  // Animate draft saved indicator
  useEffect(() => {
    if (showDraftSaved) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [showDraftSaved, fadeAnim])

  // Animate camera processing and audio transcription spinner
  useEffect(() => {
    if (isProcessingImage || isTranscribing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start()
    } else {
      spinValue.setValue(0)
    }
  }, [isProcessingImage, isTranscribing, spinValue])

  // Load user's routines and exercises
  const loadRoutinesAndExercises = useCallback(async () => {
    try {
      if (user?.id) {
        const [
          userRoutines,
          allExercisesList,
          recentExercises,
        ] = await Promise.all([
          database.workoutRoutines.getAll(user.id),
          database.exercises.getAll(),
          database.exercises.getRecent(user.id, 50), // Fetch last 50 unique recent exercises
        ])

        setRoutines(userRoutines)

        // Sort exercises: Recent ones first, then alphabetical
        // This ensures autocomplete suggests frequently used exercises first
        const recentIds = new Set(recentExercises.map((e) => e.id))
        const otherExercises = allExercisesList.filter(
          (e) => !recentIds.has(e.id),
        )

        setAllExercises([...recentExercises, ...otherExercises])
      }
    } catch (error) {
      console.error('[CreatePost] Error loading data:', error)
    }
  }, [user])

  // Track if we're waiting for routines to load before applying pending routine
  const pendingRoutineWaitingForLoad = useRef(false)

  useEffect(() => {
    if (!pendingDraftRoutineId) {
      pendingRoutineWaitingForLoad.current = false
      return
    }

    const routine = routines.find((item) => item.id === pendingDraftRoutineId)

    if (!routine) {
      // Routines might not be loaded yet - mark that we're waiting
      if (routines.length === 0) {
        pendingRoutineWaitingForLoad.current = true
      } else {
        // Routines loaded but routine not found - routine may have been deleted
        pendingRoutineWaitingForLoad.current = false
        setPendingDraftRoutineId(null)
        setPendingRoutineSource(null)
      }
      return
    }

    pendingRoutineWaitingForLoad.current = false

    // Capture source before clearing to use in logic below
    const source = pendingRoutineSource

    // Clear pending state synchronously BEFORE other state updates to prevent re-triggers
    setPendingDraftRoutineId(null)
    setPendingRoutineSource(null)

    setSelectedRoutine(routine)
    setIsStructuredMode(true)

    // Transform routine exercises into structured data format
    const transformedExercises = (routine.workout_routine_exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((we) => ({
        id: we.id,
        name: we.exercise?.name || 'Exercise',
        sets: (we.sets || [])
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({
            weight: '',
            reps: '',
            targetRepsMin: s.reps_min ?? null,
            targetRepsMax: s.reps_max ?? null,
            targetRestSeconds: s.rest_seconds ?? null,
          })),
      }))

    // Only set if this is a fresh routine start (from route, not draft)
    if (source === 'route') {
      setStructuredData(transformedExercises)
    }
    setLastRoutineWorkout(null)

    if (source === 'route' || !titleRef.current.trim()) {
      setWorkoutTitle(routine.name)
    }

    // Persist the routine selection immediately to avoid losing it on navigation
    // Use the transformed exercises if we just set them
    const routineTitleToSave =
      source === 'route' ? routine.name : titleRef.current
    const structuredToSave =
      source === 'route' ? transformedExercises : structuredData
    const routineUpdatedAt = Date.now()
    void saveWorkoutDraft({
      notes,
      title: routineTitleToSave,
      structuredData: structuredToSave,
      isStructuredMode: true,
      selectedRoutineId: routine.id,
      timerStartedAt: workoutTimerSerializableState.timerStartedAt,
      timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
      updatedAt: routineUpdatedAt,
    })
      .then(() => {
        const metrics = buildDraftMetrics(structuredToSave)
        trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
          action: 'compact',
          source: 'routine',
          length: notes.trim().length,
          hasTitle: Boolean(routineTitleToSave.trim()),
          updatedAt: routineUpdatedAt,
          ...metrics,
        })
      })
      .catch((error) => {
        console.error('[Routine] Immediate persist failed:', error)
        trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
          action: 'fail',
          source: 'routine',
          reason: 'save_failed',
          error: error instanceof Error ? error.message : String(error),
          length: notes.trim().length,
          hasTitle: Boolean(routineTitleToSave.trim()),
          updatedAt: routineUpdatedAt,
          ...buildDraftMetrics(structuredToSave),
        })
      })

    // Hydrate last workout data and update structured data with history if needed
    if (user?.id) {
      database.workoutSessions
        .getLastForRoutine(user.id, routine.id)
        .then((lastWorkout) => {
          setLastRoutineWorkout(lastWorkout)

          // If we just applied this from route, we should update the history in the structuredData
          if (source === 'route' && lastWorkout) {
            setStructuredData((current) =>
              current.map((exercise) => {
                const exerciseName = exercise.name
                const lastWorkoutExercise = lastWorkout.workout_exercises?.find(
                  (we) => we.exercise?.name === exerciseName,
                )

                return {
                  ...exercise,
                  sets: exercise.sets.map((set, index) => {
                    const lastSet = lastWorkoutExercise?.sets?.find(
                      (s) => s.set_number === index + 1,
                    )
                    return {
                      ...set,
                      lastWorkoutWeight: lastSet?.weight
                        ? lastSet.weight.toString()
                        : null,
                      lastWorkoutReps: lastSet?.reps
                        ? lastSet.reps.toString()
                        : null,
                    }
                  }),
                }
              }),
            )
          }
        })
        .catch((error) => {
          console.error('[Routine] Error loading last workout:', error)
          setLastRoutineWorkout(null)
        })
    }
  }, [
    pendingDraftRoutineId,
    pendingRoutineSource,
    routines,
    user,
    notes,
    structuredData,
    workoutTimerSerializableState.timerElapsedSeconds,
    workoutTimerSerializableState.timerStartedAt,
    buildDraftMetrics,
    trackEvent,
  ])

  // Track animation state to reset on each focus
  const [slideKey, setSlideKey] = useState(0)
  const [shouldExit, setShouldExit] = useState(false)

  // Use exercise selection hook for navigation-based exercise search
  const { registerCallback } = useExerciseSelection()

  // Use routine selection hook for navigation-based routine selection
  const { registerCallback: registerRoutineCallback } = useRoutineSelection()

  const hydrateDraft = useCallback(async () => {
    isHydratingRef.current = true
    try {
      const [draft, pending] = await Promise.all([
        loadWorkoutDraft(),
        loadPendingWorkout(),
      ])

      const plan = buildHydrationPlan({
        draft,
        pending,
        selectedRoutineId,
        refresh,
        lastRouteRoutineToken: lastRouteRoutineTokenRef.current,
        hasHydrated: hasHydratedRef.current,
        lastLocalEditAt: lastLocalEditAtRef.current,
      })

      if (plan.shouldSkip) {
        logDraftDebug('hydrate-skip', {
          reason: 'local_newer_than_disk',
          draftUpdatedAt: plan.draftUpdatedAt,
          lastLocalEditAt: lastLocalEditAtRef.current,
        })
        const metrics = buildDraftMetrics(structuredDataRef.current)
        trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
          action: 'skip',
          source: 'hydrate',
          reason: 'local_newer_than_disk',
          length: notesRef.current.trim().length,
          hasTitle: Boolean(titleRef.current.trim()),
          updatedAt: lastLocalEditAtRef.current,
          ...metrics,
        })
        return
      }

      if (plan.shouldResetToEmpty) {
        logDraftDebug('hydrate-reset-empty-storage', {
          draftUpdatedAt: plan.draftUpdatedAt,
          lastLocalEditAt: lastLocalEditAtRef.current,
        })
        resetLocalWorkoutDraftState()
        return
      }

      if (plan.shouldApplyHydration) {
        suppressLocalEditTrackingRef.current = true
      }

      logDraftDebug('hydrate-plan', {
        shouldApplyHydration: plan.shouldApplyHydration,
        shouldHydrateTimer: plan.shouldHydrateTimer,
        hasNewRouteRoutine: plan.hasNewRouteRoutine,
        shouldResetToEmpty: plan.shouldResetToEmpty,
        effectiveRoutineId: plan.effectiveRoutineId,
        draftUpdatedAt: plan.draftUpdatedAt,
      })

      if (plan.notes !== undefined) {
        suppressDraftToastRef.current = true
        setNotes(plan.notes)
      }

      if (plan.title !== undefined) {
        setWorkoutTitle(plan.title)
      }

      if (plan.structuredData) {
        setStructuredData(plan.structuredData)
        if (plan.isStructuredMode !== undefined) {
          setIsStructuredMode(plan.isStructuredMode)
        }
      } else if (plan.isStructuredMode !== undefined) {
        setIsStructuredMode(plan.isStructuredMode)
      }

      if (plan.effectiveRoutineId) {
        setPendingDraftRoutineId(plan.effectiveRoutineId)
        setPendingRoutineSource(plan.routineSource)
      } else {
        setPendingDraftRoutineId(null)
        setPendingRoutineSource(null)
      }

      if (plan.shouldHydrateTimer) {
        hydrateWorkoutTimer(plan.timerStartedAt, plan.timerElapsedSeconds)
      } else {
        resetWorkoutTimer()
      }

      // Skip the next 3 auto-saves to allow all hydration state changes to settle
      skipPersistCountRef.current = 3

      lastDraftSavedAtRef.current = plan.draftUpdatedAt
      lastLocalEditAtRef.current = plan.draftUpdatedAt

      if (plan.hasNewRouteRoutine) {
        lastRouteRoutineTokenRef.current = plan.routeRoutineToken
      }
    } finally {
      isHydratingRef.current = false
      hasHydratedRef.current = true
      logDraftDebug('hydrate-finish', {
        hasHydrated: hasHydratedRef.current,
        isHydrating: isHydratingRef.current,
      })
    }
  }, [
    logDraftDebug,
    buildDraftMetrics,
    hydrateWorkoutTimer,
    resetLocalWorkoutDraftState,
    resetWorkoutTimer,
    refresh,
    selectedRoutineId,
    trackEvent,
  ])

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      setSlideKey((prev) => prev + 1)
      setShouldExit(false)
      isScreenFocusedRef.current = true

      haptic('light')

      blurInputs()

      // Reload draft when screen is focused (handles case where draft was saved after failure)
      hydrateDraft()

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(notesRef.current.trim()),
        hasTitle: Boolean(titleRef.current.trim()),
      })

      const timeoutId = setTimeout(() => {
        blurInputs()
      }, 0)

      const interactionHandle = runAfterInteractions(() => {
        blurInputs()
      })

      const loadWorkoutCount = async () => {
        try {
          if (user?.id) {
            const workouts = await database.workoutSessions.getRecent(
              user.id,
              1,
            )
            setUserWorkoutCount(workouts.length)
          }
        } catch (error) {
          console.error('Error loading workout count:', error)
        }
      }
      loadWorkoutCount()

      loadRoutinesAndExercises()

      return () => {
        clearTimeout(timeoutId)
        if (interactionHandle) {
          interactionHandle.cancel?.()
        }
        persistDraft('blur')
        isScreenFocusedRef.current = false
      }
    }, [
      blurInputs,
      trackEvent,
      user,
      loadRoutinesAndExercises,
      hydrateDraft,
      persistDraft,
    ]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
      if (isScreenFocusedRef.current) {
        persistDraft('unmount')
      } else {
        logDraftDebug('persist-skipped-unmount-not-focused')
      }
    }
  }, [blurInputs, logDraftDebug, persistDraft])

  // Load saved draft on mount or when refresh param changes
  useEffect(() => {
    if (!isScreenFocusedRef.current) {
      return
    }
    hydrateDraft()
  }, [hydrateDraft, refresh])

  // Auto-save draft whenever inputs change
  useEffect(() => {
    if (!isScreenFocusedRef.current) {
      logDraftDebug('autosave-skipped', {
        reason: 'not-focused',
      })
      return
    }

    if (isHydratingRef.current) {
      return
    }

    if (skipPersistCountRef.current > 0) {
      logDraftDebug('autosave-skipped', {
        reason: 'skip-persist-counter',
        remaining: skipPersistCountRef.current,
      })
      skipPersistCountRef.current--
      return
    }

    // Use selectedRoutine.id if available, fall back to pendingDraftRoutineId
    // This ensures we persist the routine ID even while waiting for routines to load
    const routineIdToSave = selectedRoutine?.id ?? pendingDraftRoutineId ?? null

    const timeoutId = setTimeout(() => {
      const updatedAt = Math.max(Date.now(), lastLocalEditAtRef.current)
      lastDraftSavedAtRef.current = updatedAt
      logDraftDebug('autosave-start', {
        updatedAt,
        notesLength: notes.trim().length,
        hasTitle: Boolean(workoutTitle.trim()),
        structuredCount: structuredData.length,
        hasRoutine: Boolean(routineIdToSave),
        timerStartedAt: workoutTimerSerializableState.timerStartedAt,
        timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
      })
      void saveWorkoutDraftPatch({
        notes,
        title: workoutTitle,
        structuredData,
        isStructuredMode,
        selectedRoutineId: routineIdToSave,
        timerStartedAt: workoutTimerSerializableState.timerStartedAt,
        timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
        updatedAt,
      })
        .then(() => {
          logDraftDebug('autosave-success', {
            updatedAt,
          })
          const metrics = buildDraftMetrics(structuredData)
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'patch',
            source: 'autosave',
            length: notes.trim().length,
            hasTitle: Boolean(workoutTitle.trim()),
            updatedAt,
            ...metrics,
          })
        })
        .catch((error) => {
          if (DEBUG_LOGS) console.error('[Draft] Save failed:', error)
          logDraftDebug('autosave-failed', {
            error: error instanceof Error ? error.message : String(error),
          })
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'fail',
            source: 'autosave',
            reason: 'save_patch_failed',
            error: error instanceof Error ? error.message : String(error),
            length: notes.trim().length,
            hasTitle: Boolean(workoutTitle.trim()),
            updatedAt,
            ...buildDraftMetrics(structuredData),
          })
        })
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [
    logDraftDebug,
    notes,
    workoutTitle,
    structuredData,
    isStructuredMode,
    selectedRoutine?.id,
    pendingDraftRoutineId,
    workoutTimerSerializableState.timerElapsedSeconds,
    workoutTimerSerializableState.timerStartedAt,
    buildDraftMetrics,
    trackEvent,
  ])

  // Persist draft immediately when app backgrounds (timers may be paused)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      logDraftDebug('appstate-change', {
        state,
        isHydrating: isHydratingRef.current,
        isFocused: isScreenFocusedRef.current,
      })
      if (state === 'active' || isHydratingRef.current) {
        return
      }

      if (!isScreenFocusedRef.current) {
        logDraftDebug('persist-skipped-background-not-focused')
        return
      }

      persistDraft('background')
    })

    return () => {
      subscription.remove()
    }
  }, [logDraftDebug, persistDraft])

  // Show "Draft saved" indicator with debounce (UI only)
  useEffect(() => {
    if (isHydratingRef.current) {
      return
    }

    if (suppressDraftToastRef.current) {
      suppressDraftToastRef.current = false
      return
    }

    const trimmedNotes = notes.trim()

    if (!trimmedNotes) {
      setShowDraftSaved(false)
      return
    }

    let hideTimer: ReturnType<typeof setTimeout> | undefined
    const showTimer = setTimeout(() => {
      setShowDraftSaved(true)
      trackEvent(AnalyticsEvents.WORKOUT_DRAFT_AUTO_SAVED, {
        length: trimmedNotes.length,
        hasTitle: Boolean(workoutTitle.trim()),
      })

      hideTimer = setTimeout(() => setShowDraftSaved(false), 2000)
    }, 2500)

    return () => {
      clearTimeout(showTimer)
      if (hideTimer) {
        clearTimeout(hideTimer)
      }
    }
  }, [notes, trackEvent, workoutTitle])

  const handleCancel = async () => {
    if (isRecording) {
      await stopRecording()
    }

    blurInputs()
    setShouldExit(true)
  }

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [])

  const handleDiscardWorkout = useCallback(() => {
    haptic('medium')
    blurInputs()

    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout? All progress will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearWorkoutDraft('create-post-discard-button')
            resetLocalWorkoutDraftState()

            haptic('light')
          },
        },
      ],
    )
  }, [blurInputs, resetLocalWorkoutDraftState])

  const handleRemoveAttachedImage = async () => {
    haptic('light')
    imageOpacity.setValue(0)
    setAttachedImageUri(null)
  }

  const handleToggleRecording = useCallback(async () => {
    haptic('medium')
    await toggleRecording()
  }, [toggleRecording])

  const handleScanWorkoutPress = useCallback(() => {
    haptic('medium')
    blurInputs()

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Scan Workout',
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleScanWithCamera()
          } else if (buttonIndex === 1) {
            handleScanWithLibrary()
          }
        },
      )
      return
    }

    Alert.alert('Scan Workout', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: handleScanWithCamera,
      },
      {
        text: 'Choose from Library',
        onPress: handleScanWithLibrary,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ])
  }, [blurInputs, handleScanWithCamera, handleScanWithLibrary])

  const performSubmission = useCallback(
    async (
      notesValue: string,
      titleValue: string,
      imageUriValue: string | null,
      routineIdValue: string | null,
      descriptionValue?: string,
      parserNotesValue?: string,
    ) => {
      if (!user) {
        throw new Error('User must be authenticated to submit workouts')
      }

      const trimmedNotes = notesValue.trim()
      const trimmedTitle = titleValue.trim()
      // Cap duration at 4 hours to prevent absurdly long durations from forgotten timers
      const MAX_WORKOUT_DURATION_SECONDS = 4 * 60 * 60 // 4 hours
      const durationSeconds = Math.min(
        Math.max(0, getWorkoutElapsedSeconds()),
        MAX_WORKOUT_DURATION_SECONDS,
      )

      await queueWorkout({
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUri: imageUriValue,
        routineId: routineIdValue,
        durationSeconds,
        description: descriptionValue?.trim() || undefined,
        parserNotes: parserNotesValue,
        song: selectedSong,
        structuredData: isStructuredMode ? structuredData : undefined,
        isStructuredMode,
      })

      // Refresh freemium limits after successful submission
      refreshFreemiumLimits()

      // Complete tutorial step for logging first workout
      completeStep('log_workout')

      trackEvent(AnalyticsEvents.WORKOUT_SAVED_TO_PENDING, {
        hasTitle: Boolean(trimmedTitle),
        length: trimmedNotes.length,
      })

      let message = 'Well done on completing another workout!'
      let workoutNumber = 1
      let weeklyTarget = 2
      let currentStreak = 0
      let previousStreak = 0

      try {
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        // Fetch profile and week count in parallel (no dependency between them)
        const [profile, workoutsThisWeek] = await Promise.all([
          database.profiles.getById(user.id),
          database.workoutSessions.getThisWeekCount(user.id, startOfWeek),
        ])

        workoutNumber = workoutsThisWeek + 1
        weeklyTarget = parseCommitment(profile.commitment?.[0] ?? null)

        // Both streak calculations can also run in parallel
        const [previousStreakResult, currentStreakResult] = await Promise.all([
          database.stats.calculateStreak(
            user.id,
            weeklyTarget,
            false, // Don't include current week - this is the streak before submission
          ),
          database.stats.calculateStreak(
            user.id,
            weeklyTarget,
            true, // Include current week since workout is being submitted
          ),
        ])

        previousStreak = previousStreakResult.currentStreak ?? 0
        currentStreak = currentStreakResult.currentStreak ?? 0

        message = generateWorkoutMessage({
          workoutNumber,
          weeklyTarget,
        })
      } catch (error) {
        console.error('Error generating workout message:', error)
      }

      hapticSuccess()

      await clearWorkoutDraft('create-post-submit-success')
      clearExerciseHistoryCache() // Clear cache so new workout data is available next time
      resetLocalWorkoutDraftState()
      blurInputs()

      // Show streak overlay only if the streak increased (e.g., 2 weeks -> 3 weeks)
      showStreakOverlay({
        message,
        workoutNumber,
        weeklyTarget,
        currentStreak,
        previousStreak,
        workoutTitle: trimmedTitle || undefined,
      })
      navigation.dispatch(TabActions.jumpTo('index'))
      runAfterInteractions(() => {
        requestAnimationFrame(() => {
          scrollToTop('index')
        })
      })

      // NOTE: Rating prompt is now triggered from index.tsx handlePendingPost
      // to avoid duplicate triggers causing modal overlap and iOS freeze
    },
    [
      user,
      queueWorkout,
      trackEvent,
      blurInputs,
      showStreakOverlay,
      refreshFreemiumLimits,
      getWorkoutElapsedSeconds,
      resetLocalWorkoutDraftState,
      completeStep,
      isStructuredMode,
      structuredData,
      selectedSong,
      scrollToTop,
      navigation,
    ],
  )

  const submitWorkout = async (caption?: string) => {
    // Check if user can post workout (freemium limit)
    if (!canPostWorkout) {
      // Reset loading state before showing paywall
      isSubmittingRef.current = false
      setIsLoading(false)
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'workout_logging',
        source_screen: 'create_post',
        subscription_status: isProMember ? 'active' : 'none',
      })
      return
    }

    // Combine structured data with free-form notes
    let workoutNotes = notes
    let parserNotes = notes
    // We no longer prepend caption to notes, as it's handled separately

    if (isStructuredMode && structuredData.length > 0) {
      const structuredText = convertStructuredDataToText(structuredData)
      // Add structured workout first, then notes
      workoutNotes = structuredText + (notes.trim() ? '\n\n' + notes : '')
      // Only parse the user's actual free-form notes, not the synthetic
      // structured text we generate for raw storage/debugging.
      parserNotes = notes
    }

    try {
      await performSubmission(
        workoutNotes,
        workoutTitle,
        attachedImageUri,
        selectedRoutine?.id ?? null,
        caption, // Pass caption as description
        parserNotes,
      )
      // Success - reset loading state
      isSubmittingRef.current = false
      setIsLoading(false)
    } catch (error) {
      if (
        error instanceof SubmitWorkoutError &&
        error.code === 'IMAGE_UPLOAD'
      ) {
        // IMAGE_UPLOAD error - show Alert and let user decide
        // Don't reset loading state here - Alert handlers will do it
        console.error('Error uploading image:', error.originalError ?? error)
        Alert.alert(
          'Image Upload Failed',
          'Unable to upload your workout photo. Would you like to continue without it?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                isSubmittingRef.current = false
                setIsLoading(false)
              },
            },
            {
              text: 'Continue',
              onPress: async () => {
                setAttachedImageUri(null)
                try {
                  await performSubmission(
                    workoutNotes,
                    workoutTitle,
                    null,
                    selectedRoutine?.id ?? null,
                    caption,
                    parserNotes,
                  )
                } catch (retryError) {
                  console.error('Error saving pending post:', retryError)
                  Alert.alert(
                    'Save Failed',
                    'Unable to save your workout. Please try again.',
                    [{ text: 'OK' }],
                  )
                } finally {
                  isSubmittingRef.current = false
                  setIsLoading(false)
                }
              },
            },
          ],
        )
        return
      }

      // Generic error - reset loading state
      console.error('Error saving pending post:', error)
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert(
        'Save Failed',
        'Unable to save your workout. Please try again.',
        [{ text: 'OK' }],
      )
    }
  }

  // =============================================================================
  // ROUTINE MANAGEMENT HANDLERS
  // =============================================================================
  // Routine State Lifecycle:
  // 1. User opens routine selector → showRoutineSelector = true
  // 2. User selects a routine → selectedRoutine set, lastRoutineWorkout fetched,
  //    isStructuredMode enabled, structuredData cleared
  // 3. User fills in workout data → structuredData populated via StructuredWorkoutInput
  // 4. User can clear routine → selectedRoutine/lastRoutineWorkout cleared,
  //    optionally keep structuredData if user has entered data
  // 5. On submission → all routine state cleared
  // 6. On cancel → all routine state cleared
  // 7. On routine deletion → if selected, all routine state cleared
  // =============================================================================

  const handleSelectRoutine = useCallback(
    async (routine: WorkoutRoutineWithDetails) => {
      // Clear any existing routine data first to prevent stale state
      setLastRoutineWorkout(null)
      setStructuredData([])

      // Query for last workout FIRST before setting state
      let lastWorkout: WorkoutSessionWithDetails | null = null
      if (user?.id) {
        try {
          lastWorkout = await database.workoutSessions.getLastForRoutine(
            user.id,
            routine.id,
          )
        } catch (error) {
          console.error(
            '[handleSelectRoutine] Error loading last workout for routine:',
            error,
          )
          lastWorkout = null
        }
      }

      // Set all states together so component renders with lastWorkout data
      setSelectedRoutine(routine)
      setWorkoutTitle(routine.name)
      setIsStructuredMode(true)
      setLastRoutineWorkout(lastWorkout)

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'routine_template',
        routineId: routine.id,
      })
    },
    [user, trackEvent],
  )

  const handleOpenRoutineSelector = useCallback(async () => {
    haptic('light')
    blurInputs()

    // Register callback for routine selection
    registerRoutineCallback((routine: WorkoutRoutineWithDetails) => {
      handleSelectRoutine(routine)
    })

    // Navigate to the full-screen routine selector
    router.push('/routines')
  }, [blurInputs, registerRoutineCallback, handleSelectRoutine])

  const handlePost = async () => {
    // Prevent double-tap race condition using synchronous ref check
    if (isSubmittingRef.current) {
      return
    }
    isSubmittingRef.current = true

    // Immediate haptic feedback for responsive feel
    haptic('medium')

    // Immediate button animation
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start()

    // Prevent multiple submissions by disabling button immediately
    setIsLoading(true)

    // Dismiss keyboard
    blurInputs()

    // Check freemium workout limit
    if (!canPostWorkout) {
      isSubmittingRef.current = false
      setIsLoading(false)
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'workout_logging',
        source_screen: 'create_post',
        subscription_status: isProMember ? 'active' : 'none',
      })
      return
    }

    if (!workoutTitle.trim()) {
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert(
        'Title Required',
        'Give your workout a title so you can find it later.',
        [{ text: 'OK' }],
      )
      return
    }

    // Check if there's workout data (either notes or structured data)
    const hasStructuredData =
      isStructuredMode &&
      structuredData.length > 0 &&
      structuredData.some((exercise) =>
        exercise.sets.some((set) => set.weight || set.reps),
      )

    if (!notes.trim() && !hasStructuredData) {
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert(
        'Workout Details Missing',
        'Add your exercises, sets, and reps to track your progress.',
        [{ text: 'OK' }],
      )
      return
    }

    if (!user) {
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert('Not Logged In', 'Sign in to save and track your workouts.', [
        { text: 'OK' },
      ])
      return
    }

    // Reset loading state since we're showing overlay, not submitting yet
    isSubmittingRef.current = false
    setIsLoading(false)

    // Stop the workout timer before showing the finalize overlay
    pauseWorkoutTimer()

    setShowFinalizeOverlay(true)

    trackEvent(AnalyticsEvents.WORKOUT_CREATE_SUBMITTED, {
      hasTitle: Boolean(workoutTitle.trim()),
      length: notes.trim().length,
    })
  }

  // Convert structured workout data to text format
  const convertStructuredDataToText = useCallback(
    (data: StructuredExerciseDraft[]): string => {
      if (!data || data.length === 0) return ''

      const unitDisplay = weightUnit === 'kg' ? 'kg' : 'lbs'

      return data
        .map((exercise) => {
          const lines = [exercise.name]

          exercise.sets.forEach((set, index) => {
            if (set.weight || set.reps) {
              const weightText = set.weight || '___'
              const repsText = set.reps || '___'
              
              lines.push(
                `Set ${
                  index + 1
                }: ${weightText} ${unitDisplay} x ${repsText} reps`,
              )
            }
          })

          return lines.join('\n')
        })
        .join('\n\n')
    },
    [weightUnit],
  )

  // Parse text around cursor to extract exercise name and sets
  const parseExerciseFromText = useCallback(
    (text: string, cursorPos: number) => {
      const lines = text.split('\n')
      const textBeforeCursor = text.substring(0, cursorPos)
      const linesBefore = textBeforeCursor.split('\n')
      const currentLineIndex = linesBefore.length - 1

      // Get exercise name (current line or previous line if current is empty)
      let exerciseName = lines[currentLineIndex]?.trim() || ''
      let startIndex = currentLineIndex

      // If current line is empty, look at previous line
      if (!exerciseName && currentLineIndex > 0) {
        exerciseName = lines[currentLineIndex - 1]?.trim() || ''
        startIndex = currentLineIndex - 1
      }

      if (!exerciseName) return null

      // Extract sets from following lines (until empty line or end)
      const sets: { weight?: string; reps?: string }[] = []
      for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) break // Stop at empty line

        // Try to parse set: "weight x reps" or "weight x reps reps" or "135 x 8"
        // Note: Weight pattern accepts both period and comma as decimal separators (e.g., "7.5" or "7,5")
        const setMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+)/i)
        
        if (setMatch) {
          // Normalize decimal separator: replace comma with period (for European locales)
          const rawWeight = setMatch[1]
          const weight = rawWeight.replace(',', '.')
          
          sets.push({
            weight,
            reps: setMatch[2],
          })
        } else {
          // If line doesn't match set pattern, stop
          break
        }
      }

      return {
        exerciseName,
        sets: sets.length > 0 ? sets : [{ weight: '', reps: '' }], // At least one empty set
        startLineIndex: startIndex,
        endLineIndex: startIndex + sets.length,
      }
    },
    [],
  )

  // Handle cursor position changes
  const handleNotesSelectionChange = useCallback(
    (event: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const cursorPos = event.nativeEvent.selection.start
      setCursorPosition(cursorPos)
    },
    [],
  )

  // Calculate dynamic height of structured content
  const calculateStructuredContentHeight = useCallback(() => {
    if (!isStructuredMode || structuredData.length === 0) return 0

    let totalHeight = 0

    structuredData.forEach((exercise) => {
      // Exercise header (name + delete button)
      totalHeight += 32 // Exercise name line height

      // Each set row
      totalHeight += exercise.sets.length * 26 // ~26px per set row

      // Add set button
      totalHeight += 32

      // Exercise bottom margin
      totalHeight += 20
    })

    return totalHeight
  }, [isStructuredMode, structuredData])

  // Handle content size changes to scroll to cursor when adding new lines
  const handleContentSizeChange = useCallback(
    (event: {
      nativeEvent: { contentSize: { width: number; height: number } }
    }) => {
      if (scrollViewRef.current && isNotesFocused) {
        // Calculate cursor position in text
        const textBeforeCursor = notes.substring(0, cursorPosition)
        const currentLineCount = textBeforeCursor.split('\n').length

        // Only scroll if we're adding lines (going down)
        if (currentLineCount > previousLineCount.current) {
          // Calculate dynamic height of structured content above notes
          const structuredContentHeight = calculateStructuredContentHeight()

          // Scroll to show cursor with minimal padding above keyboard
          scrollViewRef.current.scrollTo({
            y: structuredContentHeight + currentLineCount * 24 - 250,
            animated: true,
          })
        }

        previousLineCount.current = currentLineCount
      }
    },
    [notes, cursorPosition, isNotesFocused, calculateStructuredContentHeight],
  )

  // =============================================================================
  // AUTOCOMPLETE STATE
  // =============================================================================
  const exerciseAutocomplete = useExerciseAutocompleteGroup({
    text: notes,
    cursorPosition,
    exercises: allExercises,
    isInputFocused: isNotesFocused,
  })

  const currentSuggestion = exerciseAutocomplete?.primary ?? null

  const variationSuggestions = useMemo(() => {
    const variations = exerciseAutocomplete?.variations ?? []
    if (variations.length < 2) return []
    return variations.slice(0, 4)
  }, [exerciseAutocomplete])

  const hasTrailingText = useMemo(() => {
    const textAfter = notes.substring(cursorPosition)
    const nextNewline = textAfter.indexOf('\n')
    const currentLineSuffix =
      nextNewline === -1 ? textAfter : textAfter.substring(0, nextNewline)
    return currentLineSuffix.trim().length > 0
  }, [notes, cursorPosition])

  const showInlineVariations =
    isNotesFocused &&
    variationSuggestions.length > 0 &&
    !hasTrailingText


  const stackedVariationSuggestions = useMemo(() => {
    if (!showInlineVariations) return []
    const primaryName = currentSuggestion?.name ?? null
    return variationSuggestions.filter(
      (suggestion) => suggestion.name !== primaryName,
    )
  }, [showInlineVariations, variationSuggestions, currentSuggestion])

  // Auto-scroll to show variations when they appear
  useEffect(() => {
    if (showInlineVariations && stackedVariationSuggestions.length > 0 && scrollViewRef.current) {
      // Small delay to allow layout to update with new padding
      requestAnimationFrame(() => {
        if (scrollViewRef.current) {
          // Calculate roughly where the cursor is
          const cursorLineIndex = notes.substring(0, cursorPosition).split('\n').length
          const lineHeight = 24
          const structuredHeight = calculateStructuredContentHeight()
          
          // Calculate explicit cursor Y position
          const cursorY = structuredHeight + (cursorLineIndex * lineHeight)

          // Scroll such that the cursor is positioned slightly down from the top
          // giving context above (approx 3 lines) while maximizing space below for variations
          // The buffer of -80 ensures previous lines are visible
          scrollViewRef.current.scrollTo({
            y: Math.max(0, cursorY - 80), 
            animated: true,
          })
        }
      })
    }
  }, [showInlineVariations, stackedVariationSuggestions.length, notes, cursorPosition, calculateStructuredContentHeight])

  const acceptSuggestionByName = useCallback(
    async (exerciseName: string) => {
      try {
        hapticSuccess()

        // 1. Create structured workout entry with history data
        const newExercise = await createExerciseWithHistory(exerciseName)

        setStructuredData((prev) => [...prev, newExercise])
        setIsStructuredMode(true)

        // 2. Remove the text that triggered the suggestion from the notes
        // Find current line start/end
        const textBeforeCursor = notes.substring(0, cursorPosition)
        const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
        const startOfLine = lastNewlineIndex + 1

        // We simply remove the line where the user was typing
        const newText =
          notes.substring(0, startOfLine) + notes.substring(cursorPosition)

        setNotes(newText)
        return true
      } catch (error) {
        console.error(
          '[acceptSuggestionByName] Error accepting suggestion:',
          error,
        )
        return false
      }
    },
    [notes, cursorPosition, createExerciseWithHistory],
  )

  const handleAcceptSuggestion = useCallback(() => {
    if (!currentSuggestion) return
    void acceptSuggestionByName(currentSuggestion.name)
  }, [currentSuggestion, acceptSuggestionByName])

  // Handle text change
  const handleNotesChange = useCallback(
    async (text: string) => {
      // Check for Enter key press (newline addition) when a suggestion is active
      const isNewlineAdded =
        text.length > notes.length &&
        text.slice(cursorPosition, cursorPosition + 1) === '\n'

      if (isNewlineAdded) {
        const suggestion = getExerciseSuggestion(
          notes,
          cursorPosition,
          allExercises,
        )
        if (suggestion) {
          const accepted = await acceptSuggestionByName(suggestion.name)
          if (!accepted) {
            // Fallback: just set the text with the newline
            setNotes(text)
          }
          return
        }
      }

      setNotes(text)
    },
    [notes, cursorPosition, allExercises, acceptSuggestionByName],
  )

  // Convert text to structured format
  const handleConvertToStructured = useCallback(async () => {
    haptic('light')

    const parsed = parseExerciseFromText(notes, cursorPosition)
    if (!parsed) return

    const { exerciseName, sets, startLineIndex, endLineIndex } = parsed

    // Create exercise with history data, using the number of sets parsed from text
    const baseExercise = await createExerciseWithHistory(
      exerciseName,
      sets.length,
    )

    // Merge with user-typed data (preserve any values they already entered)
    const mergedExercise: StructuredExerciseDraft = {
      ...baseExercise,
      sets: baseExercise.sets.map((set, index) => {
        const typedSet = sets[index]
        return {
          ...set,
          weight: typedSet?.weight || set.weight,
          reps: typedSet?.reps || set.reps,
        }
      }),
    }

    // Add to structured data FIRST, then enable structured mode
    // This ensures the component renders with the exercise already in structuredData
    setStructuredData((prev) => {
      return [...prev, mergedExercise]
    })

    // Enable structured mode AFTER adding exercise to ensure component renders with data
    if (!isStructuredMode) {
      setIsStructuredMode(true)
    }

    // Remove the converted text from notes
    const lines = notes.split('\n')
    const newLines = [
      ...lines.slice(0, startLineIndex),
      ...lines.slice(endLineIndex + 1),
    ]
    const newNotes = newLines.join('\n')
    setNotes(newNotes)
    // showConvertButton will automatically update via useMemo
  }, [
    notes,
    cursorPosition,
    parseExerciseFromText,
    isStructuredMode,
    createExerciseWithHistory,
  ])

  const handleMultiSelectExercises = useCallback(
    async (exercises: Exercise[]) => {
      // Create new structured exercises with history data (in parallel)
      const newExercises = await Promise.all(
        exercises.map((exercise) => createExerciseWithHistory(exercise.name)),
      )

      setStructuredData((prev) => [...prev, ...newExercises])
      setIsStructuredMode(true)
    },
    [createExerciseWithHistory],
  )

  const handleChooseExercisePress = useCallback(() => {
    // Register callback for exercise selection
    registerCallback((selectedExercises: Exercise | Exercise[]) => {
      const exercises = Array.isArray(selectedExercises)
        ? selectedExercises
        : [selectedExercises]
      handleMultiSelectExercises(exercises)
    })

    // Navigate to the full-screen exercise selector
    router.push('/select-exercise')
  }, [registerCallback, handleMultiSelectExercises])

  // Handler for adding exercise from AI coach suggestions
  const handleAddExerciseFromCoach = useCallback(
    async (exercise: { name: string; sets: number; reps: string }) => {
      const { targetRepsMin, targetRepsMax } = parseRepRange(exercise.reps)

      // Create exercise with history data
      const newExercise = await createExerciseWithHistory(
        exercise.name,
        exercise.sets,
        targetRepsMin,
        targetRepsMax,
      )

      setStructuredData((prev) => [...prev, newExercise])
      setIsStructuredMode(true)
    },
    [createExerciseWithHistory],
  )

  // Handler for replacing exercise from AI coach suggestions
  const handleReplaceExerciseFromCoach = useCallback(
    async (
      oldExerciseName: string,
      newExercise: { name: string; sets: number; reps: string },
    ) => {
      const { targetRepsMin, targetRepsMax } = parseRepRange(newExercise.reps)

      // First check if the exercise exists
      const existingIndex = structuredData.findIndex(
        (ex) => ex.name.toLowerCase() === oldExerciseName.toLowerCase(),
      )

      if (existingIndex === -1) {
        // If not found, add as a new exercise with history
        const newExerciseData = await createExerciseWithHistory(
          newExercise.name,
          newExercise.sets,
          targetRepsMin,
          targetRepsMax,
        )
        setStructuredData((prev) => [...prev, newExerciseData])
        return
      }

      // Exercise exists - fetch history for the new exercise to fill any extra sets
      const newHistory = await createExerciseWithHistory(
        newExercise.name,
        newExercise.sets,
        targetRepsMin,
        targetRepsMax,
      )

      setStructuredData((prev) => {
        const oldExercise = prev[existingIndex]
        const setCount = Math.max(newExercise.sets, oldExercise.sets.length)

        // Preserve existing set data where available, use history for new sets
        const sets = Array.from({ length: setCount }, (_, i) => {
          if (i < oldExercise.sets.length) {
            // Keep the user's existing data but update target reps
            return { ...oldExercise.sets[i], targetRepsMin, targetRepsMax }
          }
          // Use history data for new sets
          return (
            newHistory.sets[i] || createEmptySet(targetRepsMin, targetRepsMax)
          )
        })

        const updated = [...prev]
        updated[existingIndex] = {
          id: oldExercise.id,
          name: newExercise.name,
          sets,
        }
        return updated
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createEmptySet is stable
    [createExerciseWithHistory, structuredData],
  )

  // Track previous structured data length to detect deletions
  const previousStructuredDataLength = useRef(0)

  // Check if all structured exercises have been deleted and clear routine if so
  useEffect(() => {
    const currentLength = structuredData.length
    const previousLength = previousStructuredDataLength.current

    // If we had exercises and now have zero (user deleted all)
    if (selectedRoutine && previousLength > 0 && currentLength === 0) {
      // All exercises deleted - clear routine state
      setSelectedRoutine(null)
      setLastRoutineWorkout(null)
      setIsStructuredMode(false)
      setPendingDraftRoutineId(null)
      setPendingRoutineSource(null)
    }

    // Update previous length
    previousStructuredDataLength.current = currentLength
  }, [structuredData, selectedRoutine])

  const editorToolbarProps = useMemo(
    () => ({
      onScanWorkout: handleScanWorkoutPress,
      onMicPress: handleToggleRecording,
      onStopwatchPress: () => {
        haptic('light')
        blurInputs()
        setShowRestTimer(true)
      },
      onRoutinePress: handleOpenRoutineSelector,
      onSearchExercise: handleChooseExercisePress,
      onAddExercise: handleConvertToStructured,
      isRecording,
      isTranscribing,
      isProcessingImage,
      isLoading,
      showAddExercise: showConvertButton,
      isRestTimerActive: restTimer.isActive,
      restTimerRemaining: restTimer.remainingSeconds,
      bottomInsetOverride: bottomSafeInset,
    }),
    [
      handleScanWorkoutPress,
      handleToggleRecording,
      blurInputs,
      handleOpenRoutineSelector,
      handleChooseExercisePress,
      handleConvertToStructured,
      isRecording,
      isTranscribing,
      isProcessingImage,
      isLoading,
      showConvertButton,
      restTimer.isActive,
      restTimer.remainingSeconds,
      bottomSafeInset,
    ],
  )

  // Keyboard handling with Reanimated for perfect sync
  const keyboard = useAnimatedKeyboard()
  
  const spacerStyle = useAnimatedStyle(() => ({
    height: keyboard.height.value,
  }))

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <SlideUpView
        key={slideKey}
        style={{ flex: 1 }}
        backgroundColor={colors.bg}
        fade={false}
        duration={200}
        tension={65}
        friction={14}
        shouldExit={shouldExit}
        onExitComplete={handleExitComplete}
      >
        <Pressable style={styles.header} onPress={blurInputs}>
          <LiquidGlassSurface
            style={styles.headerIconShell}
            debugLabel="create-post-close-button"
          >
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
              disabled={isLoading}
            >
              <Ionicons
                name="chevron-down"
                size={24}
                color={colors.textPrimary}
                style={styles.headerBackChevron}
              />
            </TouchableOpacity>
          </LiquidGlassSurface>

          <View pointerEvents="none" style={styles.headerCenter}>
            {(shouldShowWorkoutTimer || showDraftSaved) && (
              <View style={styles.headerCenterContainer}>
                {shouldShowWorkoutTimer && !showDraftSaved && (
                  <Text style={styles.headerTimerText}>{headerTimerDisplay}</Text>
                )}
                {showDraftSaved && (
                  <Animated.View
                    style={[
                      styles.draftSavedContainer,
                      { opacity: fadeAnim, position: 'absolute' },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.brandPrimary}
                    />
                    <Text style={styles.draftSavedText}>Draft saved</Text>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
          <View style={styles.headerRightButtons}>
            {shouldShowWorkoutTimer && (
              <TouchableOpacity
                onPress={handleDiscardWorkout}
                style={styles.discardButton}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color="#E53935" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handlePost}
              style={[styles.headerButton, styles.submitButtonFilled]}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Animated.View
                style={{
                  transform: [{ scale: buttonScaleAnim }],
                }}
              >
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Pressable>

        <View style={styles.keyboardView}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.inputContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            bounces={true}
            automaticallyAdjustContentInsets={false}
          >
            {/* Title Input */}
            <View style={styles.titleInputContainer}>
              <TextInput
                ref={titleInputRef}
                style={styles.titleInput}
                placeholder="Workout Title"
                placeholderTextColor="#999"
                value={workoutTitle}
                onChangeText={setWorkoutTitle}
                editable={!isRecording && !isTranscribing}
                maxLength={50}
                autoFocus={false}
                cursorColor={colors.brandPrimary}
                selectionColor={colors.brandPrimary}
              />
              <View>
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => {
                    haptic('light')
                    blurInputs()
                    setShowCoachSheet(true)
                  }}
                  disabled={isLoading || isRecording || isTranscribing}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={28}
                    color={colors.brandPrimary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Structured Workout Input - Shown when routine is loaded or manual exercises exist */}
            {isStructuredMode && (
              <View style={styles.structuredSection}>
                <StructuredWorkoutInput
                  routine={selectedRoutine || undefined}
                  lastWorkout={lastRoutineWorkout || undefined}
                  initialExercises={
                    structuredData.length > 0 ? structuredData : undefined
                  }
                  onDataChange={handleStructuredDataChange}
                  onRestTimerStart={handleRestTimerStart}
                  onFetchSetHistory={fetchSetHistory}
                  onExerciseNamePress={handleExerciseNamePress}
                />
              </View>
            )}

            {/* Free-form Notes Input - Always visible */}
            <View style={styles.notesInputWrapper}>
              <TextInput
                ref={notesInputRef}
                style={[
                  styles.notesInput,
                  { color: colors.textPrimary },
                  isStructuredMode &&
                    (structuredData.length > 0 || selectedRoutine) &&
                    styles.notesInputWithStructured,
                  {
                    paddingBottom: showInlineVariations
                      ? stackedVariationSuggestions.length * 28 + 24 // 28px per line approx + base padding
                      : 24,
                  },
                ]}
                // Android alignment fix
                {...Platform.select({ android: { includeFontPadding: false } })}
                placeholder={
                  isStructuredMode
                    ? 'Add notes about your workout...'
                    : 'Log your exercises...'
                }
                placeholderTextColor="#999"
                multiline
                value={notes}
                onChangeText={handleNotesChange}
                onContentSizeChange={handleContentSizeChange}
                textAlignVertical="top"
                editable={!isRecording && !isTranscribing}
                autoFocus={false}
                cursorColor={colors.brandPrimary}
                selectionColor={colors.brandPrimary}
                onSelectionChange={handleNotesSelectionChange}
                onFocus={() => {
                  setIsNotesFocused(true)
                }}
                onBlur={() => {
                  setIsNotesFocused(false)
                }}
              />

              {/* Ghost Text Overlay - Rendered AFTER TextInput to allow touch interception on suffix */}
              {(currentSuggestion || showInlineVariations) && isNotesFocused && (
                <View
                  style={[
                    styles.notesInput,
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 10, // Ensure it sits on top
                    },
                    isStructuredMode &&
                      (structuredData.length > 0 || selectedRoutine) &&
                      styles.notesInputWithStructured,
                  ]}
                  pointerEvents="box-none"
                >
                  <Text
                    style={{
                      color: 'transparent',
                      textAlignVertical: 'top',
                      fontSize: 17,
                      lineHeight: 24,
                      paddingTop: Platform.OS === 'android' ? 0 : 2,
                    }}
                  >
                    {notes.substring(0, cursorPosition)}
                    {currentSuggestion && (
                      <Text
                        style={{ color: colors.textTertiary }}
                        onPress={handleAcceptSuggestion}
                        suppressHighlighting={true}
                      >
                        {currentSuggestion.name.slice(
                          currentSuggestion.inputLength,
                        )}
                      </Text>
                    )}
                    {showInlineVariations &&
                      stackedVariationSuggestions.map((suggestion) => (
                        <Text
                          key={suggestion.name}
                          style={{ color: colors.textTertiary }}
                          onPress={() =>
                            void acceptSuggestionByName(suggestion.name)
                          }
                          suppressHighlighting={true}
                        >
                          {'\n'}
                          {suggestion.name}
                        </Text>
                      ))}
                    {!showInlineVariations && notes.substring(cursorPosition)}
                  </Text>
                </View>
              )}
              {!isNotesFocused && (
                <Pressable
                  style={styles.notesOverlay}
                  onPress={() => {
                    notesInputRef.current?.focus()
                  }}
                />
              )}
            </View>

            {/* Attached Image Thumbnail - REMOVED per refactor */}
          </ScrollView>

          {/* Editor Toolbar */}
          <EditorToolbar {...editorToolbarProps} />
          <Reanimated.View style={spacerStyle} />
        </View>

        {isLoading && (
          <View style={styles.submissionOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={colors.surface} />
            <Text style={styles.submissionOverlayText}>Saving workout...</Text>
          </View>
        )}

        {/* New-user guide - shown when user has no workouts and inputs are empty */}
        {!hasWorkoutDraftContent && userWorkoutCount === 0 && (
          <View style={styles.newUserGuideContainer} pointerEvents="none">
            <View style={styles.newUserGuideCard}>
              <Text style={styles.newUserGuideTitle}>
                Log workouts how you like!
              </Text>
         

              <View style={styles.newUserGuideOptionRow}>
                <View style={styles.newUserGuideOptionBadge}>
                  <Text style={styles.newUserGuideOptionBadgeText}>1</Text>
                </View>
                <View style={styles.newUserGuideOptionContent}>
                  <Text style={styles.newUserGuideOptionTitle}>Notes</Text>
                  <View style={styles.newUserGuideOptionHintRow}>
                    <View style={styles.newUserGuideOptionHintIconWrap}>
                      <Ionicons
                        name="create-outline"
                        size={12}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.newUserGuideOptionHintText}>
                      Log it like Apple Notes, free-form
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.newUserGuideOptionRow}>
                <View style={styles.newUserGuideOptionBadge}>
                  <Text style={styles.newUserGuideOptionBadgeText}>2</Text>
                </View>
                <View style={styles.newUserGuideOptionContent}>
                  <Text style={styles.newUserGuideOptionTitle}>Structured</Text>
                  <View style={styles.newUserGuideOptionHintRow}>
                    <View style={styles.newUserGuideOptionHintIconWrap}>
                      <Ionicons
                        name="add-outline"
                        size={12}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.newUserGuideOptionHintText}>
                      Type an exercise name and tap +
                    </Text>
                  </View>
                  <View style={styles.newUserGuideStructuredPreview}>
                    <View style={styles.newUserGuideStructuredPreviewContent}>
                      <StructuredWorkoutInput
                        initialExercises={NEW_USER_STRUCTURED_PREVIEW}
                        compactPreview
                        onDataChange={handleStructuredPreviewChange}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.newUserGuideOptionRow}>
                <View style={styles.newUserGuideOptionBadge}>
                  <Text style={styles.newUserGuideOptionBadgeText}>3</Text>
                </View>
                <View style={styles.newUserGuideOptionContent}>
                  <Text style={styles.newUserGuideOptionTitle}>
                    Search exercises
                  </Text>
                  <View style={styles.newUserGuideOptionHintRow}>
                    <View style={styles.newUserGuideOptionHintIconWrap}>
                      <Ionicons
                        name="search-outline"
                        size={12}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.newUserGuideOptionHintText}>
                      Tap search to see exercises and videos
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.newUserGuideOptionRow}>
                <View style={styles.newUserGuideOptionBadge}>
                  <Text style={styles.newUserGuideOptionBadgeText}>4</Text>
                </View>
                <View style={styles.newUserGuideOptionContent}>
                  <Text style={styles.newUserGuideOptionTitle}>Voice log</Text>
                  <View style={styles.newUserGuideOptionHintRow}>
                    <View style={styles.newUserGuideOptionHintIconWrap}>
                      <Ionicons
                        name="mic-outline"
                        size={12}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.newUserGuideOptionHintText}>
                      Tap mic and speak your workout
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.newUserGuideFooter}>
                No matter how you log, AI detects your exercises and turns it into a formatted workout post.
              </Text>
            </View>
          </View>
        )}

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title={`Take Your Training to the Next Level!`}
          message={`Unlock ${coachFirstName}'s full coaching suite, unlimited workouts, and advanced progress tracking.`}
        />

        <FinalizeWorkoutOverlay
          visible={showFinalizeOverlay}
          onClose={() => {
            // Modal dismissed (swipe down) - do NOT submit
            setShowFinalizeOverlay(false)
            isSubmittingRef.current = false
            setIsLoading(false)
          }}
          onFinish={() => {
            // "Finish" pressed - submit with caption
            // Set submitting state FIRST to prevent race conditions
            isSubmittingRef.current = true
            setIsLoading(true)
            setShowFinalizeOverlay(false)
            submitWorkout(finalizeDescription)
          }}
          onAttachWithCamera={handleAttachWithCamera}
          onAttachWithLibrary={handleAttachWithLibrary}
          imageUri={attachedImageUri}
          onRemoveImage={handleRemoveAttachedImage}
          selectedSong={selectedSong}
          onSelectSong={setSelectedSong}
          onRemoveSong={() => setSelectedSong(null)}
          description={finalizeDescription}
          setDescription={setFinalizeDescription}
          isLoading={isLoading}
        />
      </SlideUpView>

      <RestTimerOverlay
        visible={showRestTimer}
        onClose={() => setShowRestTimer(false)}
        remainingSeconds={restTimer.remainingSeconds}
        isActive={restTimer.isActive}
        onStart={restTimer.start}
        onStop={restTimer.stop}
        onAddTime={restTimer.addTime}
      />

      <WorkoutCoachSheet
        visible={showCoachSheet}
        onClose={() => setShowCoachSheet(false)}
        workoutContext={workoutContext}
        onAddExercise={handleAddExerciseFromCoach}
        onReplaceExercise={handleReplaceExerciseFromCoach}
        isWorkoutEmpty={isWorkoutEmpty}
      />
    </SafeAreaView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { top: number; bottom: number; left: number; right: number },
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    headerButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerIconShell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBackChevron: {
      transform: [{ translateY: 1 }],
    },
    submitButtonFilled: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 22,
    },
    headerCenter: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    },
    headerCenterContainer: {
      minHeight: 40,
      minWidth: 72,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    headerTimerText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    headerRightButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    discardButton: {
      height: 44,
      width: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    draftSavedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 16,
    },
    draftSavedText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.brandPrimary,
    },
    loaderContainer: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderRing: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderArc: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'transparent',
      borderTopColor: '#ffffff',
      borderRightColor: '#ffffff',
    },

    inputContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      position: 'relative',
      paddingBottom: 96 + insets.bottom,
    },
    titleInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      gap: 8,
    },
    titleInput: {
      flex: 1,
      fontSize: 30,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: Platform.OS === 'ios' ? 36 : 34,
      paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    },
    routineSelectorButton: {
      padding: 6,
      borderRadius: 8,
    },
    chatButton: {
      padding: 6,
      borderRadius: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    structuredSection: {
      paddingTop: 16,
      paddingBottom: 0,
      paddingHorizontal: 20,
    },
    structuredHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    removeStructuredButton: {
      padding: 4,
    },
    notesInputWrapper: {
      flex: 1,
      position: 'relative',
    },
    notesInput: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      fontSize: 17,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    notesInputWithStructured: {
      paddingTop: 8,
    },
    notesOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    newUserGuideContainer: {
      position: 'absolute',
      top: 68, // Header height (12px padding + 44px button + 12px padding)
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      pointerEvents: 'none',
    },
    newUserGuideCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    newUserGuideTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    newUserGuideSubtitle: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    newUserGuideOptionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 1,
    },
    newUserGuideOptionBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 0,
    },
    newUserGuideOptionBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    newUserGuideOptionContent: {
      flex: 1,
      gap: 2,
    },
    newUserGuideOptionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    newUserGuideOptionHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 1,
    },
    newUserGuideOptionHintIconWrap: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    newUserGuideOptionHintText: {
      fontSize: 12,
      lineHeight: 15,
      color: colors.textSecondary,
    },
    newUserGuideStructuredPreview: {
      backgroundColor: colors.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingTop: 6,
      paddingBottom: 4,
      marginTop: 2,
    },
    // StructuredWorkoutInput keeps bottom spacing for full-page editing.
    // Trim it in this read-only preview to keep the onboarding card compact.
    newUserGuideStructuredPreviewContent: {
      marginBottom: -4,
    },
    newUserGuideFooter: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 4,
    },
    attachedImageContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    attachedImageWrapper: {
      position: 'relative',
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    attachedImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    attachedImageLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    staticAccessoryBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingBottom: insets.bottom,
    },
    submissionOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      zIndex: 50,
    },
    submissionOverlayText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.surface,
    },
  })
