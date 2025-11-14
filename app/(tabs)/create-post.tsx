import { ImagePickerModal } from '@/components/ImagePickerModal'
import { KeyboardAccessory } from '@/components/keyboard-accessory'
import { Paywall } from '@/components/paywall'
import { RoutineSelectorSheet } from '@/components/routine-selector-sheet'
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
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
const KEYBOARD_ACCESSORY_ID = 'workout-notes-accessory'

const formatTimerDisplay = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))

  // If under 1 minute, show just seconds
  if (safeSeconds < 60) {
    return `${safeSeconds}`
  }

  // If 1 minute or more, show M:SS
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
  const insets = useSafeAreaInsets()

  // =============================================================================
  // BASIC WORKOUT INPUT STATE
  // =============================================================================
  const [notes, setNotes] = useState('')
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
  const [isStructuredMode, setIsStructuredMode] = useState(false)
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

  const [structuredData, setStructuredData] = useState<
    StructuredExerciseDraft[]
  >([])
  const [pendingDraftRoutineId, setPendingDraftRoutineId] = useState<
    string | null
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

  // Wrapper to log structuredData changes
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
  const [showConvertButton, setShowConvertButton] = useState(false)
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

  // Page opening animation - like lifting a notepad or opening a book
  const pageSlideAnim = useRef(new Animated.Value(100)).current // Start below screen
  const pageOpacityAnim = useRef(new Animated.Value(0)).current // Start transparent

  const titleInputRef = useRef<TextInput>(null)
  const notesInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const notesRef = useRef(notes)
  const titleRef = useRef(workoutTitle)
  const suppressDraftToastRef = useRef(false)
  const skipNextPersistRef = useRef(false)
  const isHydratingRef = useRef(true)
  const convertButtonDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
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
    pickImage,
    showModal,
    closeModal,
    handleScanWithCamera,
    handleScanWithLibrary,
    handleAttachWithCamera,
    handleAttachWithLibrary,
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

  // Load user's routines
  const loadRoutines = useCallback(async () => {
    try {
      if (user?.id) {
        const userRoutines = await database.workoutRoutines.getAll(user.id)
        setRoutines(userRoutines)
      }
    } catch (error) {
      console.error('Error loading routines:', error)
    }
  }, [user])

  useEffect(() => {
    if (!pendingDraftRoutineId || !user?.id) {
      return
    }

    const routine = routines.find((item) => item.id === pendingDraftRoutineId)
    if (!routine) {
      return
    }

    setSelectedRoutine(routine)
    setPendingDraftRoutineId(null)

    let isMounted = true

    const hydrateLastWorkout = async () => {
      try {
        const lastWorkout = await database.workoutSessions.getLastForRoutine(
          user.id,
          routine.id,
        )

        if (isMounted) {
          setLastRoutineWorkout(lastWorkout)
        }
      } catch (error) {
        console.error(
          '[hydrateDraftRoutine] Error loading last workout for routine:',
          error,
        )
      }
    }

    hydrateLastWorkout()

    return () => {
      isMounted = false
    }
  }, [pendingDraftRoutineId, routines, user])

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      pageSlideAnim.setValue(100)
      pageOpacityAnim.setValue(0)

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      Animated.parallel([
        Animated.spring(pageSlideAnim, {
          toValue: 0,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(pageOpacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start()

      blurInputs()

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(notesRef.current.trim()),
        hasTitle: Boolean(titleRef.current.trim()),
      })

      const timeoutId = setTimeout(blurInputs, 0)
      const interactionHandle = InteractionManager.runAfterInteractions(
        blurInputs,
      )

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

      loadRoutines()

      return () => {
        clearTimeout(timeoutId)
        interactionHandle.cancel?.()
        blurInputs()
      }
    }, [
      blurInputs,
      trackEvent,
      pageSlideAnim,
      pageOpacityAnim,
      user,
      loadRoutines,
    ]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
    }
  }, [blurInputs])

  // Load saved draft on mount
  useEffect(() => {
    let isMounted = true

    const hydrateDraft = async () => {
      try {
        const [draft, pending] = await Promise.all([
          loadWorkoutDraft(),
          loadPendingWorkout(),
        ])

        if (!isMounted) {
          return
        }

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

        if (
          Array.isArray(draft?.structuredData) &&
          draft.structuredData.length
        ) {
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
        if (routineIdFromDraft) {
          setPendingDraftRoutineId(routineIdFromDraft)
        }

        if (
          draft &&
          (draft.timerStartedAt ||
            typeof draft.timerElapsedSeconds === 'number')
        ) {
          hydrateWorkoutTimer(
            draft.timerStartedAt ?? null,
            draft.timerElapsedSeconds ?? 0,
          )
        } else {
          resetWorkoutTimer()
        }

        skipNextPersistRef.current = true
      } finally {
        isHydratingRef.current = false
      }
    }

    hydrateDraft()

    return () => {
      isMounted = false
    }
  }, [hydrateWorkoutTimer, resetWorkoutTimer])

  // Auto-save draft whenever inputs change
  useEffect(() => {
    if (isHydratingRef.current) {
      return
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }

    const selectedRoutineId =
      selectedRoutine?.id ?? pendingDraftRoutineId ?? null

    void saveWorkoutDraft({
      notes,
      title: workoutTitle,
      structuredData,
      isStructuredMode,
      selectedRoutineId,
      timerStartedAt: workoutTimerSerializableState.timerStartedAt,
      timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
    }).catch((error) => console.error('Failed to save workout draft', error))
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
    router.back()
  }

  const handlePickImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    blurInputs()
    await pickImage()
  }

  const handleRemoveAttachedImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    imageOpacity.setValue(0)
    setAttachedImageUri(null)
  }

  const handleToggleRecording = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await toggleRecording()
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
    ) => {
      if (!user) {
        throw new Error('User must be authenticated to submit workouts')
      }

      const trimmedNotes = notesValue.trim()
      const trimmedTitle = titleValue.trim()
      const durationSeconds = Math.max(0, getWorkoutElapsedSeconds())

      console.log('Submitting workout with duration:', durationSeconds, 'seconds')

      await queueWorkout({
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUri: imageUriValue,
        routineId: routineIdValue,
        durationSeconds,
      })

      // Refresh freemium limits after successful submission
      refreshFreemiumLimits()

      trackEvent(AnalyticsEvents.WORKOUT_SAVED_TO_PENDING, {
        hasTitle: Boolean(trimmedTitle),
        length: trimmedNotes.length,
      })

      let message = 'Well done on completing another workout!'
      let workoutNumber = 1
      let weeklyTarget = 3

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

        weeklyTarget = parseCommitment(profile.commitment)
        message = generateWorkoutMessage({
          workoutNumber,
          weeklyTarget,
        })
      } catch (error) {
        console.error('Error generating workout message:', error)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      skipNextPersistRef.current = true
      suppressDraftToastRef.current = true
      await clearWorkoutDraft()
      resetWorkoutTimer()

      setNotes('')
      setWorkoutTitle('')
      setAttachedImageUri(null)
      setIsStructuredMode(false)
      setSelectedRoutine(null)
      setPendingDraftRoutineId(null)
      setStructuredData([])
      setLastRoutineWorkout(null)
      setShowRoutineSelector(false)
      blurInputs()

      // Store title for later use in share screen
      console.log('[create-post] Showing overlay with data:', {
        message,
        workoutNumber,
        weeklyTarget,
        workoutTitle: trimmedTitle || undefined,
      })
      showOverlay({
        message,
        workoutNumber,
        weeklyTarget,
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

  const submitWorkout = async () => {
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
      )
    } catch (error) {
      if (
        error instanceof SubmitWorkoutError &&
        error.code === 'IMAGE_UPLOAD'
      ) {
        console.error('Error uploading image:', error.originalError ?? error)
        setIsLoading(false)
        Alert.alert(
          'Image Upload Failed',
          'Unable to upload your workout photo. Would you like to continue without it?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Continue',
              onPress: async () => {
                setIsLoading(true)
                setAttachedImageUri(null)
                try {
                  await performSubmission(
                    workoutNotes,
                    workoutTitle,
                    null,
                    selectedRoutine?.id ?? null,
                  )
                } catch (retryError) {
                  console.error('Error saving pending post:', retryError)
                  Alert.alert(
                    'Save Failed',
                    'Unable to save your workout. Please try again.',
                    [{ text: 'OK' }],
                  )
                } finally {
                  setIsLoading(false)
                }
              },
            },
          ],
        )
        return
      }

      console.error('Error saving pending post:', error)
      Alert.alert(
        'Save Failed',
        'Unable to save your workout. Please try again.',
        [{ text: 'OK' }],
      )
    } finally {
      setIsLoading(false)
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
      setPendingDraftRoutineId(routine.id)
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
                }

                // Refresh routines list
                await loadRoutines()
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
    [loadRoutines, selectedRoutine],
  )

  const handlePost = async () => {
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
      setIsLoading(false)
      Alert.alert(
        'Workout Details Missing',
        'Add your exercises, sets, and reps to track your progress.',
        [{ text: 'OK' }],
      )
      return
    }

    if (!user) {
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
        // First-time user - show confirmation modal
        Alert.alert(
          'Submit Your First Workout',
          "You're about to submit your workout! We'll analyze it and add it to your feed. Ready to track your progress?",
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                // User cancelled - re-enable button
                setIsLoading(false)
              },
            },
            {
              text: 'Submit',
              onPress: submitWorkout,
            },
          ],
        )
        return
      }
    } catch (error) {
      console.error('Error checking workout count:', error)
      // If check fails, just proceed with submission
    }

    // Not a first-time user, submit directly
    await submitWorkout()

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

  // Detect if current line looks like an exercise name
  const detectExerciseName = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.substring(0, cursorPos)
    const lines = textBeforeCursor.split('\n')
    const currentLine = lines[lines.length - 1].trim()

    // Simple heuristic: if current line is non-empty and doesn't look like a set (no numbers/weights)
    // and is on its own line or at start of text, it might be an exercise name
    if (!currentLine) return false

    // Check if line looks like a set (has numbers, x, lbs/kg, etc)
    const setPattern = /(\d+|\d+\.\d+)\s*(x|×|lbs?|kg|reps?)/i
    if (setPattern.test(currentLine)) return false

    // Check if it's a reasonable length for an exercise name (2-50 chars)
    if (currentLine.length < 2 || currentLine.length > 50) return false

    // Check if previous line is empty or doesn't exist (exercise names are usually on their own line)
    const prevLine = lines.length > 1 ? lines[lines.length - 2].trim() : ''
    if (prevLine && !prevLine.match(setPattern)) return false

    return true
  }, [])

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

  // Handle cursor position changes to show convert button
  const handleNotesSelectionChange = useCallback(
    (event: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const cursorPos = event.nativeEvent.selection.start
      setCursorPosition(cursorPos)

      // Clear any existing debounce
      if (convertButtonDebounceRef.current) {
        clearTimeout(convertButtonDebounceRef.current)
        convertButtonDebounceRef.current = null
      }

      // Hide button immediately when selection changes
      setShowConvertButton(false)

      // Debounce showing the convert button
      convertButtonDebounceRef.current = setTimeout(() => {
        // Check if we should show convert button in keyboard accessory
        const shouldShow = detectExerciseName(notes, cursorPos)
        setShowConvertButton(shouldShow)
      }, 500) // 0.5 second debounce
    },
    [notes, detectExerciseName],
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

  // Handle text change - update convert button visibility
  const handleNotesChange = useCallback((text: string) => {
    setNotes(text)
    // Clear debounce when text changes
    if (convertButtonDebounceRef.current) {
      clearTimeout(convertButtonDebounceRef.current)
      convertButtonDebounceRef.current = null
    }
    // Hide button immediately when typing
    setShowConvertButton(false)
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
    setShowConvertButton(false)
  }, [notes, cursorPosition, parseExerciseFromText, isStructuredMode])

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
    }

    // Update previous length
    previousStructuredDataLength.current = currentLength
  }, [structuredData, selectedRoutine])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateY: pageSlideAnim }],
          opacity: pageOpacityAnim,
        }}
      >
        <Pressable style={styles.header} onPress={blurInputs}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={28} color={colors.text} />
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
              <Ionicons name="checkmark" size={28} color={colors.white} />
            </Animated.View>
          </TouchableOpacity>
        </Pressable>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
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
                placeholder={
                  isStructuredMode
                    ? 'Add notes about your workout...'
                    : 'Input your workout...'
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
                  // Hide convert button when blurring
                  setShowConvertButton(false)
                  // Clear debounce
                  if (convertButtonDebounceRef.current) {
                    clearTimeout(convertButtonDebounceRef.current)
                    convertButtonDebounceRef.current = null
                  }
                }}
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              />
              {!isNotesFocused && (
                <Pressable
                  style={styles.notesOverlay}
                  onPress={() => {
                    notesInputRef.current?.focus()
                  }}
                />
              )}
            </View>

            {/* Attached Image Thumbnail */}
            {attachedImageUri && (
              <View style={styles.attachedImageContainer}>
                <View style={styles.attachedImageWrapper}>
                  <Animated.Image
                    source={{ uri: attachedImageUri }}
                    style={[styles.attachedImage, { opacity: imageOpacity }]}
                    resizeMode="cover"
                    onLoadStart={() => setImageLoading(true)}
                    onLoad={() => {
                      setImageLoading(false)
                      Animated.timing(imageOpacity, {
                        toValue: 1,
                        duration: IMAGE_FADE_DURATION,
                        useNativeDriver: true,
                      }).start()
                    }}
                    onError={(error) => {
                      console.error(
                        'Failed to load attached image:',
                        error.nativeEvent.error,
                      )
                      setImageLoading(false)
                    }}
                  />
                  {imageLoading && (
                    <View style={styles.imageLoadingOverlay}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={handleRemoveAttachedImage}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={28}
                      color={colors.white}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.attachedImageLabel}>Workout Photo</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Example Workout - shown when user has no workouts and inputs are empty */}
        {!notes.trim() && !workoutTitle.trim() && userWorkoutCount === 0 && (
          <View style={styles.exampleContainer}>
            <Text style={styles.exampleLabel}>Example:</Text>
            <View style={styles.exampleCard}>
              <Text style={styles.exampleTitle}>{exampleWorkout.title}</Text>
              <View style={styles.exampleDivider} />
              <Text style={styles.exampleText}>{exampleWorkout.notes}</Text>
            </View>
          </View>
        )}

        {/* Floating Microphone Button */}
        <TouchableOpacity
          style={[styles.micFab, isRecording && styles.micFabActive]}
          onPress={handleToggleRecording}
          disabled={isTranscribing || isLoading || isProcessingImage}
        >
          {isTranscribing ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <View style={styles.loaderRing}>
                <View style={styles.loaderArc} />
              </View>
            </Animated.View>
          ) : (
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={28}
              color={colors.white}
            />
          )}
        </TouchableOpacity>

        {/* Floating Camera Button */}
        <TouchableOpacity
          style={[styles.cameraFab]}
          onPress={handlePickImage}
          disabled={
            isProcessingImage || isRecording || isTranscribing || isLoading
          }
        >
          {isProcessingImage ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <View style={styles.loaderRing}>
                <View style={styles.loaderArc} />
              </View>
            </Animated.View>
          ) : (
            <Ionicons name="camera" size={28} color={colors.white} />
          )}
        </TouchableOpacity>

        {/* Image Picker Modal */}
        <ImagePickerModal
          visible={showModal}
          onClose={closeModal}
          onScanWithCamera={handleScanWithCamera}
          onScanWithLibrary={handleScanWithLibrary}
          onAttachWithCamera={handleAttachWithCamera}
          onAttachWithLibrary={handleAttachWithLibrary}
        />

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

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title="Try Pro for FREE!"
          message="Free workout limit reached"
        />
      </Animated.View>

      {/* Keyboard Accessory for adding exercises */}
      <KeyboardAccessory
        nativeID={KEYBOARD_ACCESSORY_ID}
        onConvertPress={handleConvertToStructured}
        showConvertButton={showConvertButton && isNotesFocused}
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
      backgroundColor: colors.white,
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
      color: colors.primary,
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
    micFab: {
      position: 'absolute',
      bottom: 32 + insets.bottom,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    cameraFab: {
      position: 'absolute',
      bottom: -48 + insets.bottom,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    micFabActive: {
      backgroundColor: colors.primaryDark,
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
      fontSize: 28,
      fontWeight: '600',
      color: colors.text,
      lineHeight: Platform.OS === 'ios' ? 34 : 32,
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
  })
