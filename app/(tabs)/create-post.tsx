import { EditorToolbar } from '@/components/editor-toolbar'
import { FinalizeWorkoutOverlay } from '@/components/FinalizeWorkoutOverlay'
import { Paywall } from '@/components/paywall'
import { RestTimerOverlay } from '@/components/RestTimerOverlay'
import { SlideUpView } from '@/components/slide-up-view'
import { StructuredWorkoutInput } from '@/components/structured-workout-input'
import { WorkoutCoachSheet } from '@/components/WorkoutCoachSheet'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useRestTimerContext } from '@/contexts/rest-timer-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import {
  getExerciseSuggestion,
  parseRepRange,
  useExerciseAutocomplete,
  useShowConvertButton
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
import { clearExerciseHistoryCache } from '@/lib/services/exerciseHistoryService'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import {
  clearDraft as clearWorkoutDraft,
  loadPendingWorkout,
  loadDraft as loadWorkoutDraft,
  saveDraft as saveWorkoutDraft,
} from '@/lib/utils/workout-draft'
import {
  generateWorkoutMessage,
  parseCommitment,
} from '@/lib/utils/workout-messages'
import {
  Exercise,
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Easing,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const formatTimerDisplay = (seconds: number) => {
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

const EXAMPLE_WORKOUTS = [
  {
    title: 'Push Day',
    notes: `Felt strong today, hit a new PR on bench!

Bench Press
135 x 8
155 x 6
165 x 4

Incline DB Press
50 x 10
55 x 8 x 3`,
  },
  {
    title: 'Leg Day',
    notes: `Squats: 185x5, 205x5, 225x3
RDL's: 135 for 3 sets of 10
Leg Press: 270x12, 290x10, 310x8

Really focusing on form this week. Legs are getting stronger!`,
  },
  {
    title: 'Pull',
    notes: `Back day complete! 💪

Pull-ups
bodyweight x 8, 8, 7

Barbell Rows
135 lbs x 10 reps
155 lbs x 8 reps x 3 sets`,
  },
  {
    title: 'Upper Body',
    notes: `Overhead Press 95x8, 105x6, 115x5
Cable Flyes 30lbs x 12 x 3

Finished with 10min cardio. Shoulder felt great today!`,
  },
]

export default function CreatePostScreen() {
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const { coachId } = useProfile()
  const coach = getCoach(coachId)
  const coachFirstName = coach.name.split(' ')[1] || coach.name
  const insets = useSafeAreaInsets()

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
  const [exampleWorkout, setExampleWorkout] = useState({ title: '', notes: '' })
  const [userWorkoutCount, setUserWorkoutCount] = useState(-1)
  const [showDraftSaved, setShowDraftSaved] = useState(false)
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showCoachSheet, setShowCoachSheet] = useState(false)

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
    return (
      Boolean(notes.trim()) ||
      Boolean(workoutTitle.trim()) ||
      hasStructuredEntries ||
      Boolean(selectedRoutine)
    )
  }, [hasStructuredEntries, notes, selectedRoutine, workoutTitle])

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

  const [
    lastRoutineWorkout,
    setLastRoutineWorkout,
  ] = useState<WorkoutSessionWithDetails | null>(null)


  // =============================================================================
  // TEXT-TO-STRUCTURED CONVERSION STATE
  // =============================================================================
  const [cursorPosition, setCursorPosition] = useState(0)

  // Use hook for convert button visibility
  const showConvertButton = useShowConvertButton(notes, cursorPosition, isNotesFocused)

  const previousLineCount = useRef(0)

  // =============================================================================
  // IMAGE ATTACHMENT STATE
  // =============================================================================
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null)

  const { showOverlay } = useSuccessOverlay()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const spinValue = useRef(new Animated.Value(0)).current
  const buttonScaleAnim = useRef(new Animated.Value(1)).current
  const imageOpacity = useRef(new Animated.Value(0)).current

  const titleInputRef = useRef<TextInput>(null)
  const notesInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const notesRef = useRef(notes)
  const titleRef = useRef(workoutTitle)
  const suppressDraftToastRef = useRef(false)
  // Skip counter - decrements each time auto-save would run, skips while > 0
  const skipPersistCountRef = useRef(0)
  const isHydratingRef = useRef(true)
  const isSubmittingRef = useRef(false)
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { isProMember } = useSubscription()
  const { completeStep } = useTutorial()
  const { submitWorkout: queueWorkout } = useSubmitWorkout()
  const { canPostWorkout, refresh: refreshFreemiumLimits } = useFreemiumLimits()

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    titleRef.current = workoutTitle
  }, [workoutTitle])

  useEffect(() => {
    if (isHydratingRef.current) {
      return
    }

    if (hasWorkoutDraftContent) {
      if (!isWorkoutTimerRunning) {
        startWorkoutTimer()
      }
    } else if (isWorkoutTimerRunning || workoutElapsedSeconds > 0) {
      resetWorkoutTimer()
    }
  }, [
    hasWorkoutDraftContent,
    isWorkoutTimerRunning,
    workoutElapsedSeconds,
    startWorkoutTimer,
    resetWorkoutTimer,
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

  // Use audio transcription hook
  const {
    isRecording,
    isTranscribing,
    toggleRecording,
    stopRecording,
  } = useAudioTranscription({
    onTranscriptionComplete: (text) => {
      setNotes((prev) => (prev ? `${prev}\n${text}` : text))
    },
  })

  // Use image transcription hook
  const {
    isProcessing: isProcessingImage,
    handleAttachWithCamera,
    handleAttachWithLibrary,
    handleScanEquipment,
  } = useImageTranscription({
    onExtractionComplete: (data) => {
      // Set title if extracted
      if (data.title) {
        setWorkoutTitle(data.title)
      }
      // Combine description and workout data in notes
      const newNotes = data.description
        ? `${data.description}\n\n${data.workout}`
        : data.workout
      setNotes((prev) => (prev ? `${prev}\n\n${newNotes}` : newNotes))
    },
    onImageAttached: (uri) => {
      imageOpacity.setValue(0)
      setAttachedImageUri(uri)
    },
    onEquipmentIdentified: (equipmentName) => {
      const newExercise: StructuredExerciseDraft = {
        id: `auto-${Date.now()}`,
        name: equipmentName,
        sets: [
          {
            weight: '',
            reps: '',
            lastWorkoutWeight: null,
            lastWorkoutReps: null,
            targetRepsMin: null,
            targetRepsMax: null,
            targetRestSeconds: null,
          },
        ],
      }

      setStructuredData((prev) => [...prev, newExercise])
      setIsStructuredMode(true)

      // Feedback to user
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    },
  })

  const styles = createStyles(colors, insets)

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
        console.warn('[Routine] Not found:', pendingDraftRoutineId)
        pendingRoutineWaitingForLoad.current = false
        setPendingDraftRoutineId(null)
        setPendingRoutineSource(null)
      }
      return
    }

    console.log(
      '[Routine] Applied:',
      routine.name,
      '| source:',
      pendingRoutineSource,
    )
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
    void saveWorkoutDraft({
      notes,
      title: source === 'route' ? routine.name : titleRef.current,
      structuredData:
        source === 'route' ? transformedExercises : structuredData,
      isStructuredMode: true,
      selectedRoutineId: routine.id,
      timerStartedAt: workoutTimerSerializableState.timerStartedAt,
      timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
    }).catch((error) =>
      console.error('[Routine] Immediate persist failed:', error),
    )

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
                      lastWorkoutWeight: lastSet?.weight ? lastSet.weight.toString() : null,
                      lastWorkoutReps: lastSet?.reps ? lastSet.reps.toString() : null,
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
  ])

  // Track animation state to reset on each focus
  const [slideKey, setSlideKey] = useState(0)
  const [shouldExit, setShouldExit] = useState(false)
  
  // Use exercise selection hook for navigation-based exercise search
  const { registerCallback } = useExerciseSelection()
  
  // Use routine selection hook for navigation-based routine selection
  const { registerCallback: registerRoutineCallback } = useRoutineSelection()

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      setSlideKey((prev) => prev + 1)
      setShouldExit(false)

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      blurInputs()

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(notesRef.current.trim()),
        hasTitle: Boolean(titleRef.current.trim()),
      })

      const timeoutId = setTimeout(() => {
        blurInputs()
      }, 0)

      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        blurInputs()
      })

      const randomExample =
        EXAMPLE_WORKOUTS[Math.floor(Math.random() * EXAMPLE_WORKOUTS.length)]
      setExampleWorkout(randomExample)

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
      }
    }, [blurInputs, trackEvent, user, loadRoutinesAndExercises]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
    }
  }, [blurInputs])

  const hydrateDraft = useCallback(async () => {
    isHydratingRef.current = true
    try {
      const [draft, pending] = await Promise.all([
        loadWorkoutDraft(),
        loadPendingWorkout(),
      ])

      if (draft?.notes?.trim()) {
        suppressDraftToastRef.current = true
        setNotes(draft.notes)
      } else if (pending?.notes) {
        suppressDraftToastRef.current = true
        setNotes(pending.notes)
      }

      if (draft?.title?.trim()) {
        setWorkoutTitle(draft.title)
      } else if (pending?.title) {
        setWorkoutTitle(pending.title)
      }

      if (Array.isArray(draft?.structuredData) && draft.structuredData.length) {
        setStructuredData(draft.structuredData)
        setIsStructuredMode(
          typeof draft.isStructuredMode === 'boolean'
            ? draft.isStructuredMode
            : true,
        )
      } else if (typeof draft?.isStructuredMode === 'boolean') {
        setIsStructuredMode(draft.isStructuredMode)
      }

      const routineIdFromDraft =
        draft?.selectedRoutineId ?? pending?.routineId ?? null
      const effectiveRoutineId = selectedRoutineId || routineIdFromDraft || null

      if (effectiveRoutineId) {
        const source = selectedRoutineId ? 'route' : 'draft'
        setPendingDraftRoutineId(effectiveRoutineId)
        setPendingRoutineSource(source)
      } else {
        setPendingDraftRoutineId(null)
        setPendingRoutineSource(null)
      }

      if (
        draft &&
        (draft.timerStartedAt || typeof draft.timerElapsedSeconds === 'number')
      ) {
        hydrateWorkoutTimer(
          draft.timerStartedAt ?? null,
          draft.timerElapsedSeconds ?? 0,
        )
      } else {
        resetWorkoutTimer()
      }

      // Skip the next 3 auto-saves to allow all hydration state changes to settle
      skipPersistCountRef.current = 3
    } finally {
      isHydratingRef.current = false
    }
  }, [hydrateWorkoutTimer, resetWorkoutTimer, selectedRoutineId])

  // Load saved draft on mount or when refresh param changes
  useEffect(() => {
    hydrateDraft()
  }, [hydrateDraft, refresh])

  // Auto-save draft whenever inputs change
  useEffect(() => {
    if (isHydratingRef.current) {
      return
    }

    if (skipPersistCountRef.current > 0) {
      skipPersistCountRef.current--
      return
    }

    // Use selectedRoutine.id if available, fall back to pendingDraftRoutineId
    // This ensures we persist the routine ID even while waiting for routines to load
    const routineIdToSave = selectedRoutine?.id ?? pendingDraftRoutineId ?? null

    const timeoutId = setTimeout(() => {
      void saveWorkoutDraft({
        notes,
        title: workoutTitle,
        structuredData,
        isStructuredMode,
        selectedRoutineId: routineIdToSave,
        timerStartedAt: workoutTimerSerializableState.timerStartedAt,
        timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
      }).catch((error) => console.error('[Draft] Save failed:', error))
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [
    notes,
    workoutTitle,
    structuredData,
    isStructuredMode,
    selectedRoutine?.id,
    pendingDraftRoutineId,
    workoutTimerSerializableState.timerElapsedSeconds,
    workoutTimerSerializableState.timerStartedAt,
  ])

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

  const handleRemoveAttachedImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    imageOpacity.setValue(0)
    setAttachedImageUri(null)
  }

  const handleToggleRecording = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await toggleRecording()
  }, [toggleRecording])

  const handleDumbbellPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    blurInputs()

    try {
      const hasSeenPrompt = await AsyncStorage.getItem(
        '@has_seen_scan_equipment_prompt',
      )

      if (hasSeenPrompt) {
        handleScanEquipment()
        return
      }

      Alert.alert(
        'Scan Equipment',
        "Take a photo of the equipment you're using, and we'll add it to your workout.",
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Scan',
            onPress: async () => {
              await AsyncStorage.setItem(
                '@has_seen_scan_equipment_prompt',
                'true',
              )
              handleScanEquipment()
            },
          },
        ],
      )
    } catch (error) {
      console.error('Error checking scan prompt status:', error)
      // Fallback to opening directly if storage fails
      handleScanEquipment()
    }
  }, [blurInputs, handleScanEquipment])

  const performSubmission = useCallback(
    async (
      notesValue: string,
      titleValue: string,
      imageUriValue: string | null,
      routineIdValue: string | null,
      descriptionValue?: string,
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
      })

      // Refresh freemium limits after successful submission
      refreshFreemiumLimits()

      // Complete tutorial step for logging first workout
      console.log('[CreatePost] Successful workout submission. Completing log_workout tutorial step.')
      completeStep('log_workout')

      trackEvent(AnalyticsEvents.WORKOUT_SAVED_TO_PENDING, {
        hasTitle: Boolean(trimmedTitle),
        length: trimmedNotes.length,
      })

      let message = 'Well done on completing another workout!'
      let workoutNumber = 1
      let weeklyTarget = 2
      let currentStreak = 0

      try {
        const profile = await database.profiles.getById(user.id)

        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const workoutsThisWeek = await database.workoutSessions.getThisWeekCount(
          user.id,
          startOfWeek,
        )
        workoutNumber = workoutsThisWeek + 1

        weeklyTarget = parseCommitment(profile.commitment?.[0] ?? null)

        // Fetch current streak (includeCurrentWeek=true since we're submitting a workout now)
        const streakResult = await database.stats.calculateStreak(
          user.id,
          weeklyTarget,
          true, // Include current week since workout is being submitted
        )
        currentStreak = streakResult.currentStreak ?? 0

        message = generateWorkoutMessage({
          workoutNumber,
          weeklyTarget,
        })
      } catch (error) {
        console.error('Error generating workout message:', error)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      skipPersistCountRef.current = 1
      suppressDraftToastRef.current = true
      await clearWorkoutDraft()
      clearExerciseHistoryCache() // Clear cache so new workout data is available next time
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
      blurInputs()

      // Store title for later use in share screen
      showOverlay({
        message,
        workoutNumber,
        weeklyTarget,
        currentStreak,
        workoutTitle: trimmedTitle || undefined,
      })
      router.replace('/(tabs)')

      // NOTE: Rating prompt is now triggered from index.tsx handlePendingPost
      // to avoid duplicate triggers causing modal overlap and iOS freeze
    },
    [
      user,
      queueWorkout,
      trackEvent,
      blurInputs,
      showOverlay,
      refreshFreemiumLimits,
      getWorkoutElapsedSeconds,
      resetWorkoutTimer,
      completeStep,
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
    // We no longer prepend caption to notes, as it's handled separately

    if (isStructuredMode && structuredData.length > 0) {
      const structuredText = convertStructuredDataToText(structuredData)
      // Add structured workout first, then notes
      workoutNotes = structuredText + (notes.trim() ? '\n\n' + notes : '')
    }

    try {
      await performSubmission(
        workoutNotes,
        workoutTitle,
        attachedImageUri,
        selectedRoutine?.id ?? null,
        caption, // Pass caption as description
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    blurInputs()
    
    // Register callback for routine selection
    registerRoutineCallback((routine: WorkoutRoutineWithDetails) => {
      handleSelectRoutine(routine)
    })
    
    // Navigate to the full-screen routine selector
    router.push('/select-routine')
   
  }, [blurInputs, registerRoutineCallback, handleSelectRoutine])

  const handlePost = async () => {
    // Prevent double-tap race condition using synchronous ref check
    if (isSubmittingRef.current) {
      return
    }
    isSubmittingRef.current = true

    // Immediate haptic feedback for responsive feel
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

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
        const setMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+)/i)
        if (setMatch) {
          sets.push({
            weight: setMatch[1],
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
  const currentSuggestion = useExerciseAutocomplete({
    text: notes,
    cursorPosition,
    exercises: allExercises,
    isInputFocused: isNotesFocused,
  })

  const handleAcceptSuggestion = useCallback(async () => {
    if (!currentSuggestion) return

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // 1. Create structured workout entry with history data
      const newExercise = await createExerciseWithHistory(currentSuggestion.name)

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
    } catch (error) {
      console.error('[handleAcceptSuggestion] Error accepting suggestion:', error)
    }
  }, [currentSuggestion, notes, cursorPosition, createExerciseWithHistory])

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
          try {
            // Manually call accept suggestion logic with the calculated suggestion
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

            // 1. Create structured workout entry with history data
            const newExercise = await createExerciseWithHistory(suggestion.name)

            setStructuredData((prev) => [...prev, newExercise])
            setIsStructuredMode(true)

            // 2. Remove the text line
            const textBeforeCursor = notes.substring(0, cursorPosition)
            const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
            const startOfLine = lastNewlineIndex + 1

            const newText =
              notes.substring(0, startOfLine) + notes.substring(cursorPosition)

            setNotes(newText)
          } catch (error) {
            console.error('[handleNotesChange] Error creating exercise:', error)
            // Fallback: just set the text with the newline
            setNotes(text)
          }
          return
        }
      }

      setNotes(text)
    },
    [notes, cursorPosition, allExercises, createExerciseWithHistory],
  )



  // Convert text to structured format
  const handleConvertToStructured = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

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
  }, [notes, cursorPosition, parseExerciseFromText, isStructuredMode, createExerciseWithHistory])

  const handleMultiSelectExercises = useCallback(async (exercises: Exercise[]) => {
    // Create new structured exercises with history data (in parallel)
    const newExercises = await Promise.all(
      exercises.map((exercise) => createExerciseWithHistory(exercise.name)),
    )

    setStructuredData((prev) => [...prev, ...newExercises])
    setIsStructuredMode(true)

    // Scroll to bottom after a short delay to allow render
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }, [createExerciseWithHistory])

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

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 100)
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
          return newHistory.sets[i] || createEmptySet(targetRepsMin, targetRepsMax)
        })

        const updated = [...prev]
        updated[existingIndex] = { id: oldExercise.id, name: newExercise.name, sets }
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

  const [isStructuredInputFocused, setIsStructuredInputFocused] = useState(
    false,
  )

  const editorToolbarProps = useMemo(
    () => ({
      onScanEquipment: handleDumbbellPress,
      onMicPress: handleToggleRecording,
      onStopwatchPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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
    }),
    [
      handleDumbbellPress,
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
    ],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <SlideUpView
        key={slideKey}
        style={{ flex: 1 }}
        backgroundColor={colors.background}
        fade={true}
        fadeFrom={0}
        duration={200}
        tension={65}
        friction={14}
        shouldExit={shouldExit}
        onExitComplete={handleExitComplete}
      >
        <Pressable style={styles.header} onPress={blurInputs}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            disabled={isLoading}
          >
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </TouchableOpacity>

          <View pointerEvents="none" style={styles.headerCenter}>
            {shouldShowWorkoutTimer && (
              <Text style={styles.headerTimerText}>{headerTimerDisplay}</Text>
            )}
          </View>

          {showDraftSaved && (
            <Animated.View
              style={[styles.draftSavedContainer, { opacity: fadeAnim }]}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.primary}
              />
              <Text style={styles.draftSavedText}>Draft saved</Text>
            </Animated.View>
          )}
          <TouchableOpacity
            onPress={handlePost}
            style={[styles.headerButton, styles.primaryButton]}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Animated.View
              style={{
                transform: [{ scale: buttonScaleAnim }],
              }}
            >
              <Ionicons name="checkmark" size={24} color={colors.white} />
            </Animated.View>
          </TouchableOpacity>
        </Pressable>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
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
            automaticallyAdjustKeyboardInsets={true}
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
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  blurInputs()
                  setShowCoachSheet(true)
                }}
                disabled={isLoading || isRecording || isTranscribing}
                activeOpacity={0.6}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={28}
                  color={colors.primary}
                />
              </TouchableOpacity>
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
                  onInputFocus={() => setIsStructuredInputFocused(true)}
                  onInputBlur={() => setIsStructuredInputFocused(false)}
                  editorToolbarProps={editorToolbarProps}
                  onFetchSetHistory={fetchSetHistory}
                />
              </View>
            )}

            {/* Free-form Notes Input - Always visible */}
            <View style={styles.notesInputWrapper}>
              <TextInput
                ref={notesInputRef}
                style={[
                  styles.notesInput,
                  { color: colors.text },
                  isStructuredMode &&
                    (structuredData.length > 0 || selectedRoutine) &&
                    styles.notesInputWithStructured,
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
                cursorColor={colors.primary}
                selectionColor={colors.primary}
                onSelectionChange={handleNotesSelectionChange}
                onFocus={() => {
                  setIsNotesFocused(true)
                }}
                onBlur={() => {
                  setIsNotesFocused(false)
                }}
              />

              {/* Ghost Text Overlay - Rendered AFTER TextInput to allow touch interception on suffix */}
              {currentSuggestion && isNotesFocused && (
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
                    <Text
                      style={{ color: colors.textTertiary }}
                      onPress={handleAcceptSuggestion}
                      suppressHighlighting={true}
                    >
                      {currentSuggestion.name.slice(
                        currentSuggestion.inputLength,
                      )}
                    </Text>
                    {notes.substring(cursorPosition)}
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
          {!isStructuredInputFocused && (
            <EditorToolbar {...editorToolbarProps} />
          )}
        </KeyboardAvoidingView>

        {/* Example Workout - shown when user has no workouts and inputs are empty */}
        {!notes.trim() && !workoutTitle.trim() && userWorkoutCount === 0 && (
          <View style={styles.exampleContainer}>
            <Text style={styles.exampleLabel}>Example:</Text>
            <View style={styles.exampleCard}>
              <Text style={styles.exampleTitle}>{exampleWorkout.title}</Text>
              <View style={styles.exampleDivider} />
              {/* Description removed per refactor */}
              <Text style={styles.exampleText}>
                {exampleWorkout.notes.split('\n\n')[1]}
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
          onSkip={() => {
            // "Skip" pressed - submit without caption
            // Set submitting state FIRST to prevent race conditions
            isSubmittingRef.current = true
            setIsLoading(true)
            setShowFinalizeOverlay(false)
            submitWorkout()
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
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    headerButton: {
      padding: 8,
      minWidth: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    },
    headerTimerText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      height: 44,
    },
    draftSavedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.backgroundLight,
      borderRadius: 16,
    },
    draftSavedText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
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
      paddingBottom: 150 + insets.bottom,
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
      color: colors.text,
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
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 9,
      elevation: 6,
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
      color: colors.text,
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
    exampleContainer: {
      position: 'absolute',
      top: 68, // Header height (12px padding + 44px button + 12px padding)
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'none',
    },
    exampleLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textTertiary,
      marginBottom: 8,
    },
    exampleCard: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      maxWidth: 280,
      alignSelf: 'center',
    },
    exampleTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    exampleDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    exampleText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
      backgroundColor: colors.backgroundLight,
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
      backgroundColor: colors.backgroundLight,
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
      backgroundColor: colors.white,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingBottom: insets.bottom,
    },
  })
