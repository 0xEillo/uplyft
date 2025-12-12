import { EditorToolbar } from '@/components/editor-toolbar'
import { ExerciseSearchModal } from '@/components/exercise-search-modal'
import { FinalizeWorkoutOverlay } from '@/components/FinalizeWorkoutOverlay'
import { Paywall } from '@/components/paywall'
import { RestTimerOverlay } from '@/components/RestTimerOverlay'
import { RoutineSelectorSheet } from '@/components/routine-selector-sheet'
import { SlideUpView } from '@/components/slide-up-view'
import { StructuredWorkoutInput } from '@/components/structured-workout-input'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useRatingPrompt } from '@/contexts/rating-prompt-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import { useFreemiumLimits } from '@/hooks/useFreemiumLimits'
import { useImageTranscription } from '@/hooks/useImageTranscription'
import { useRestTimer } from '@/hooks/useRestTimer'
import { SubmitWorkoutError, useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer'
import { database } from '@/lib/database'
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

const IMAGE_FADE_DURATION = 200

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

// Helper function moved outside component to avoid hoisting issues
// Detect if current line looks like an exercise name
const detectExerciseName = (text: string, cursorPos: number) => {
  // Only check if we have text
  if (!text) return false

  // Find text before cursor without full substring/split if possible,
  // but cursor might be in middle.
  // Optimization: find start of current line
  const textBeforeCursor = text.substring(0, cursorPos)
  const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
  const currentLine = textBeforeCursor.substring(lastNewlineIndex + 1).trim()

  // Simple heuristic: if current line is non-empty and doesn't look like a set (no numbers/weights)
  // and is on its own line or at start of text, it might be an exercise name
  if (!currentLine) return false

  // Check if line looks like a set (has numbers, x, lbs/kg, etc)
  const setPattern = /(\d+|\d+\.\d+)\s*(x|×|lbs?|kg|reps?)/i
  if (setPattern.test(currentLine)) return false

  // Check if it's a reasonable length for an exercise name (2-50 chars)
  if (currentLine.length < 2 || currentLine.length > 50) return false

  // Check if previous line is empty or doesn't exist (exercise names are usually on their own line)
  // Find end of previous line
  if (lastNewlineIndex > 0) {
    const textBeforeCurrentLine = text.substring(0, lastNewlineIndex)
    const prevLineLastNewline = textBeforeCurrentLine.lastIndexOf('\n')
    const prevLine = textBeforeCurrentLine
      .substring(prevLineLastNewline + 1)
      .trim()
    if (prevLine && !prevLine.match(setPattern)) return false
  }

  return true
}

const getExerciseSuggestion = (
  text: string,
  cursorPos: number,
  exercises: Exercise[],
): { name: string; inputLength: number } | null => {
  if (!text || !exercises.length) return null

  // Find start of current line
  const textBeforeCursor = text.substring(0, cursorPos)
  const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
  const currentLineStart = lastNewlineIndex + 1

  // Get text from start of line to cursor
  const currentLinePrefix = textBeforeCursor.substring(currentLineStart)
  const trimmedPrefix = currentLinePrefix.trimStart() // Allow indentation but trim for matching

  // Check text AFTER cursor on the current line
  const textAfterCursor = text.substring(cursorPos)
  const nextNewlineIndex = textAfterCursor.indexOf('\n')
  const currentLineSuffix =
    nextNewlineIndex === -1
      ? textAfterCursor
      : textAfterCursor.substring(0, nextNewlineIndex)

  // Only suggest if the cursor is at the end of the line or followed by whitespace
  // This prevents ghost text from overlaying existing text in the middle of a line
  if (currentLineSuffix.trim().length > 0) return null

  // Only suggest if at least 2 chars typed and prefix doesn't look like a set/numbers
  if (trimmedPrefix.length < 2) return null
  if (/^[\d\sxX.]+$/.test(trimmedPrefix)) return null
  if (/(\d+(?:\.\d+)?)\s*(?:x|×|lbs?|kg)/i.test(trimmedPrefix)) return null

  const normalizedInput = trimmedPrefix.toLowerCase()

  // Find best match
  // 1. Exact start match
  // 2. Word boundary match (optional, but start match is standard for autocomplete)
  const match = exercises.find((ex) =>
    ex.name.toLowerCase().startsWith(normalizedInput),
  )

  // Only return if it's a strictly longer match
  if (match && match.name.toLowerCase() !== normalizedInput) {
    return { name: match.name, inputLength: trimmedPrefix.length }
  }

  return null
}

export default function CreatePostScreen() {
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()
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

  // =============================================================================
  // ROUTINE & STRUCTURED WORKOUT STATE
  // =============================================================================
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [showRoutineSelector, setShowRoutineSelector] = useState(false)
  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
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
    reset: resetWorkoutTimer,
    hydrate: hydrateWorkoutTimer,
    getElapsedSeconds: getWorkoutElapsedSeconds,
    serializableState: workoutTimerSerializableState,
  } = useWorkoutTimer()

  const [showRestTimer, setShowRestTimer] = useState(false)
  const restTimer = useRestTimer()

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
  const [
    lastRoutineWorkout,
    setLastRoutineWorkout,
  ] = useState<WorkoutSessionWithDetails | null>(null)

  // =============================================================================
  // TEXT-TO-STRUCTURED CONVERSION STATE
  // =============================================================================
  const [cursorPosition, setCursorPosition] = useState(0)

  const showConvertButton = useMemo(() => {
    return isNotesFocused && detectExerciseName(notes, cursorPosition)
  }, [notes, cursorPosition, isNotesFocused])

  const previousLineCount = useRef(0)

  // =============================================================================
  // IMAGE ATTACHMENT STATE
  // =============================================================================
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  const { showOverlay } = useSuccessOverlay()
  const { showPrompt } = useRatingPrompt()
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
    // (structuredData/notes in deps would cause infinite loops if cleared async)
    setPendingDraftRoutineId(null)
    setPendingRoutineSource(null)

    setSelectedRoutine(routine)
    setIsStructuredMode(true)
    // Only clear structuredData if this is a fresh routine start (from route, not draft)
    if (source === 'route') {
      setStructuredData([])
    }
    setLastRoutineWorkout(null)

    if (source === 'route' || !titleRef.current.trim()) {
      setWorkoutTitle(routine.name)
    }

    // Persist the routine selection immediately to avoid losing it on navigation
    void saveWorkoutDraft({
      notes,
      title: titleRef.current,
      structuredData,
      isStructuredMode: true,
      selectedRoutineId: routine.id,
      timerStartedAt: workoutTimerSerializableState.timerStartedAt,
      timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
    }).catch((error) =>
      console.error('[Routine] Immediate persist failed:', error),
    )

    // Hydrate last workout data (async, but no longer controls loop prevention)
    if (user?.id) {
      database.workoutSessions
        .getLastForRoutine(user.id, routine.id)
        .then((lastWorkout) => {
          setLastRoutineWorkout(lastWorkout)
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
  const showExerciseSearchRef = useRef(showExerciseSearch)

  useEffect(() => {
    showExerciseSearchRef.current = showExerciseSearch
  }, [showExerciseSearch])

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      // Only reset key if not showing exercise search (prevent remount when returning from detail)
      // Use ref to avoid re-running effect when modal state changes
      if (!showExerciseSearchRef.current) {
        setSlideKey((prev) => prev + 1)
      }
      setShouldExit(false)

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      // Don't blur inputs immediately when returning from exercise search
      if (!showExerciseSearchRef.current) {
        blurInputs()
      }

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(notesRef.current.trim()),
        hasTitle: Boolean(titleRef.current.trim()),
      })

      const timeoutId = setTimeout(() => {
        if (!showExerciseSearchRef.current) {
          blurInputs()
        }
      }, 0)

      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        if (!showExerciseSearchRef.current) {
          blurInputs()
        }
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

    void saveWorkoutDraft({
      notes,
      title: workoutTitle,
      structuredData,
      isStructuredMode,
      selectedRoutineId: routineIdToSave,
      timerStartedAt: workoutTimerSerializableState.timerStartedAt,
      timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
    }).catch((error) => console.error('[Draft] Save failed:', error))
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

  const handleToggleRecording = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await toggleRecording()
  }

  const handleDumbbellPress = async () => {
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
  }

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

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
      const durationSeconds = Math.max(0, getWorkoutElapsedSeconds())

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
      setShowRoutineSelector(false)
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

      setTimeout(() => {
        showPrompt(workoutNumber)
      }, 3700)
    },
    [
      user,
      queueWorkout,
      trackEvent,
      blurInputs,
      showOverlay,
      showPrompt,
      refreshFreemiumLimits,
      getWorkoutElapsedSeconds,
      resetWorkoutTimer,
    ],
  )

  const submitWorkout = async (caption?: string) => {
    // Check if user can post workout (freemium limit)
    if (!canPostWorkout) {
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

  const handleOpenRoutineSelector = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    blurInputs()
    setShowRoutineSelector(true)
  }

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

  const handleEditRoutine = (routine: WorkoutRoutineWithDetails) => {
    setShowRoutineSelector(false)
    router.push(`/create-routine?routineId=${routine.id}`)
  }

  const handleDeleteRoutine = useCallback(
    async (routine: WorkoutRoutineWithDetails) => {
      Alert.alert(
        'Delete Routine',
        `Are you sure you want to delete "${routine.name}"? This cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await database.workoutRoutines.delete(routine.id)

                // If the deleted routine is currently selected, clear the selection
                if (selectedRoutine?.id === routine.id) {
                  setSelectedRoutine(null)
                  setIsStructuredMode(false)
                  setStructuredData([])
                  setLastRoutineWorkout(null)
                  setWorkoutTitle('')
                  setPendingDraftRoutineId(null)
                  setPendingRoutineSource(null)
                }

                // Refresh routines list
                await loadRoutinesAndExercises()
                Alert.alert('Success', 'Routine deleted successfully')
              } catch (error) {
                console.error('Error deleting routine:', error)
                Alert.alert(
                  'Error',
                  'Failed to delete routine. Please try again.',
                )
              }
            },
          },
        ],
      )
    },
    [loadRoutinesAndExercises, selectedRoutine],
  )

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

    // Check if this is a first-time user (0 workouts)
    try {
      const workouts = await database.workoutSessions.getRecent(user.id, 1)

      if (workouts.length === 0) {
        // First-time user - show confirmation modal, then overlay
        Alert.alert(
          'Submit Your First Workout',
          "You're about to submit your workout! We'll analyze it and add it to your feed. Ready to track your progress?",
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                // User cancelled - re-enable button
                isSubmittingRef.current = false
                setIsLoading(false)
              },
            },
            {
              text: 'Submit',
              onPress: () => {
                // Reset loading state since we're showing overlay, not submitting yet
                isSubmittingRef.current = false
                setIsLoading(false)
                setShowFinalizeOverlay(true)
              },
            },
          ],
        )
        return
      }
    } catch (error) {
      console.error('Error checking workout count:', error)
      // If check fails, just proceed with showing overlay
    }

    // Reset loading state since we're showing overlay, not submitting yet
    isSubmittingRef.current = false
    setIsLoading(false)
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
  const currentSuggestion = useMemo(() => {
    return isNotesFocused
      ? getExerciseSuggestion(notes, cursorPosition, allExercises)
      : null
  }, [notes, cursorPosition, allExercises, isNotesFocused])

  const handleAcceptSuggestion = useCallback(() => {
    if (!currentSuggestion) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // 1. Create structured workout entry
    const newExercise: StructuredExerciseDraft = {
      id: `manual-${Date.now()}`,
      name: currentSuggestion.name,
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

    // 2. Remove the text that triggered the suggestion from the notes
    // Find current line start/end
    const textBeforeCursor = notes.substring(0, cursorPosition)
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
    const startOfLine = lastNewlineIndex + 1

    // We simply remove the line where the user was typing
    const newText =
      notes.substring(0, startOfLine) + notes.substring(cursorPosition)

    setNotes(newText)
  }, [currentSuggestion, notes, cursorPosition])

  // Handle text change
  const handleNotesChange = useCallback(
    (text: string) => {
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
          // Manually call accept suggestion logic with the calculated suggestion
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          // 1. Create structured workout entry
          const newExercise: StructuredExerciseDraft = {
            id: `manual-${Date.now()}`,
            name: suggestion.name,
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

          // 2. Remove the text line
          const textBeforeCursor = notes.substring(0, cursorPosition)
          const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
          const startOfLine = lastNewlineIndex + 1

          const newText =
            notes.substring(0, startOfLine) + notes.substring(cursorPosition)

          setNotes(newText)

          return
        }
      }

      setNotes(text)
    },
    [notes, cursorPosition, allExercises],
  )

  const handleChooseExercisePress = useCallback(() => {
    setShowExerciseSearch(true)
  }, [])

  // Convert text to structured format
  const handleConvertToStructured = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const parsed = parseExerciseFromText(notes, cursorPosition)
    if (!parsed) return

    const { exerciseName, sets, startLineIndex, endLineIndex } = parsed

    // Create exercise data
    const newExercise: StructuredExerciseDraft = {
      id: `manual-${Date.now()}`,
      name: exerciseName,
      sets: sets.map((set) => ({
        weight: set.weight || '',
        reps: set.reps || '',
        lastWorkoutWeight: null,
        lastWorkoutReps: null,
        targetRepsMin: null,
        targetRepsMax: null,
        targetRestSeconds: null,
      })),
    }

    // Add to structured data FIRST, then enable structured mode
    // This ensures the component renders with the exercise already in structuredData
    setStructuredData((prev) => {
      return [...prev, newExercise]
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
  }, [notes, cursorPosition, parseExerciseFromText, isStructuredMode])

  const handleSelectExerciseFromModal = useCallback((exercise: Exercise) => {
    // Create new structured exercise
    const newExercise: StructuredExerciseDraft = {
      id: `manual-${Date.now()}`,
      name: exercise.name,
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

    // Scroll to bottom after a short delay to allow render
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }, [])

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <SlideUpView
        key={slideKey}
        style={{ flex: 1 }}
        backgroundColor="transparent"
        fade={true}
        fadeFrom={0.5}
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
            <Ionicons name="chevron-down" size={30} color={colors.text} />
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
              <Ionicons name="checkmark" size={30} color={colors.white} />
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
                style={styles.routineSelectorButton}
                onPress={handleOpenRoutineSelector}
                disabled={isLoading || isRecording || isTranscribing}
                activeOpacity={0.6}
              >
                <Ionicons
                  name="albums-outline"
                  size={24}
                  color={colors.textSecondary}
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
          <EditorToolbar
            onScanEquipment={handleDumbbellPress}
            onMicPress={handleToggleRecording}
            onStopwatchPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              blurInputs()
              setShowRestTimer(true)
            }}
            onSearchExercise={handleChooseExercisePress}
            onAddExercise={handleConvertToStructured}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            isProcessingImage={isProcessingImage}
            isLoading={isLoading}
            showAddExercise={showConvertButton}
            isRestTimerActive={restTimer.isActive}
            restTimerRemaining={restTimer.remainingSeconds}
          />
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

        {/* Routine Selector Modal */}
        <RoutineSelectorSheet
          visible={showRoutineSelector}
          routines={routines}
          onClose={() => setShowRoutineSelector(false)}
          onSelectRoutine={handleSelectRoutine}
          onCreateRoutine={() => router.push('/create-routine')}
          onEditRoutine={handleEditRoutine}
          onDeleteRoutine={handleDeleteRoutine}
        />

        <ExerciseSearchModal
          visible={showExerciseSearch}
          onClose={() => setShowExerciseSearch(false)}
          onSelectExercise={handleSelectExerciseFromModal}
        />

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title="Try Pro for FREE!"
          message="Free workout limit reached"
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
            setShowFinalizeOverlay(false)
            isSubmittingRef.current = true
            setIsLoading(true)
            submitWorkout()
          }}
          onFinish={() => {
            // "Finish" pressed - submit with caption
            setShowFinalizeOverlay(false)
            isSubmittingRef.current = true
            setIsLoading(true)
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
