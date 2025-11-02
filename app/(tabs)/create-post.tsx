import { ImagePickerModal } from '@/components/ImagePickerModal'
import { Paywall } from '@/components/paywall'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useRatingPrompt } from '@/contexts/rating-prompt-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import { useImageTranscription } from '@/hooks/useImageTranscription'
import { SubmitWorkoutError, useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import {
  loadPendingWorkout,
  loadDraft as loadWorkoutDraft,
  saveDraft as saveWorkoutDraft,
} from '@/lib/utils/workout-draft'
import {
  generateWorkoutMessage,
  parseCommitment,
} from '@/lib/utils/workout-messages'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  InteractionManager,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const IMAGE_FADE_DURATION = 200

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
  const insets = useSafeAreaInsets()
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [exampleWorkout, setExampleWorkout] = useState({ title: '', notes: '' })
  const [userWorkoutCount, setUserWorkoutCount] = useState(-1)
  const [showDraftSaved, setShowDraftSaved] = useState(false)
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  // Image attachment states
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
  const latestNotes = useRef('')
  const latestTitle = useRef('')
  const skipDraftClearRef = useRef(false)
  const skipTitleDraftClearRef = useRef(false)
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { isProMember } = useSubscription()
  const { submitWorkout: queueWorkout } = useSubmitWorkout()

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

  const styles = createStyles(colors)

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

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      // Reset animation values
      pageSlideAnim.setValue(100)
      pageOpacityAnim.setValue(0)

      // Light haptic feedback when page opens
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      // Elegant page opening animation - like lifting a notepad
      Animated.parallel([
        // Slide up from below
        Animated.spring(pageSlideAnim, {
          toValue: 0,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }),
        // Fade in
        Animated.timing(pageOpacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start()

      // Blur inputs immediately on focus
      blurInputs()

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(latestNotes.current.trim()),
        hasTitle: Boolean(latestTitle.current.trim()),
      })

      // Blur inputs after a short delay to catch any late focus events
      const timeoutId = setTimeout(blurInputs, 0)

      // Blur inputs after interactions complete
      const interactionHandle = InteractionManager.runAfterInteractions(
        blurInputs,
      )

      // Randomize example workout
      const randomExample =
        EXAMPLE_WORKOUTS[Math.floor(Math.random() * EXAMPLE_WORKOUTS.length)]
      setExampleWorkout(randomExample)

      // Load user's workout count to determine if examples should be shown
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

      return () => {
        clearTimeout(timeoutId)
        interactionHandle.cancel?.()
        blurInputs()
      }
    }, [blurInputs, trackEvent, pageSlideAnim, pageOpacityAnim]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
    }
  }, [blurInputs])

  // Track keyboard height for button positioning
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
      },
    )
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
      },
    )

    return () => {
      keyboardWillShowListener.remove()
      keyboardWillHideListener.remove()
    }
  }, [])

  useEffect(() => {
    latestNotes.current = notes
  }, [notes])

  useEffect(() => {
    latestTitle.current = workoutTitle
  }, [workoutTitle])

  // Load saved draft on mount
  useEffect(() => {
    const hydrateDraft = async () => {
      try {
        const [draft, pending] = await Promise.all([
          loadWorkoutDraft(),
          loadPendingWorkout(),
        ])

        if (draft?.notes?.trim()) {
          setNotes(draft.notes)
          skipDraftClearRef.current = true
        } else if (pending?.notes) {
          setNotes(pending.notes)
          skipDraftClearRef.current = true
        }

        if (draft?.title?.trim()) {
          setWorkoutTitle(draft.title)
          skipTitleDraftClearRef.current = true
        } else if (pending?.title) {
          setWorkoutTitle(pending.title)
          skipTitleDraftClearRef.current = true
        }
      } catch (error) {
        console.error('Error loading draft:', error)
      }
    }

    hydrateDraft()
  }, [])

  // Auto-save draft whenever notes change with debounce
  useEffect(() => {
    if (skipDraftClearRef.current) {
      skipDraftClearRef.current = false
      return
    }

    const timer = setTimeout(async () => {
      try {
        await saveWorkoutDraft({
          notes,
          title: latestTitle.current,
        })

        if (notes.trim()) {
          setShowDraftSaved(true)
          // Hide after 2 seconds
          setTimeout(() => setShowDraftSaved(false), 2000)

          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_AUTO_SAVED, {
            length: notes.trim().length,
            hasTitle: Boolean(workoutTitle.trim()),
          })
        } else {
          setShowDraftSaved(false)
        }
      } catch (error) {
        console.error('Error saving draft:', error)
      }
    }, 2500) // Wait 2500ms after user stops typing

    return () => clearTimeout(timer)
  }, [notes, trackEvent, workoutTitle])

  // Auto-save title draft whenever title changes with debounce
  useEffect(() => {
    if (skipTitleDraftClearRef.current) {
      skipTitleDraftClearRef.current = false
      return
    }

    const timer = setTimeout(async () => {
      try {
        await saveWorkoutDraft({
          notes: latestNotes.current,
          title: workoutTitle,
        })
      } catch (error) {
        console.error('Error saving title draft:', error)
      }
    }, 1200) // Wait 1200ms after user stops typing

    return () => clearTimeout(timer)
  }, [workoutTitle])

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
    ) => {
      if (!user) {
        throw new Error('User must be authenticated to submit workouts')
      }

      const trimmedNotes = notesValue.trim()
      const trimmedTitle = titleValue.trim()

      await queueWorkout({
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUri: imageUriValue,
      })

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

      skipDraftClearRef.current = true
      skipTitleDraftClearRef.current = true

      setNotes('')
      setWorkoutTitle('')
      setAttachedImageUri(null)
      blurInputs()

      showOverlay({ message, workoutNumber, weeklyTarget })
      router.replace('/(tabs)')

      setTimeout(() => {
        showPrompt(workoutNumber)
      }, 3700)
    },
    [user, queueWorkout, trackEvent, blurInputs, showOverlay, showPrompt],
  )

  const submitWorkout = async () => {
    try {
      await performSubmission(notes, workoutTitle, attachedImageUri)
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
                  await performSubmission(notes, workoutTitle, null)
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

    // Check if user is pro member
    if (!isProMember) {
      setIsLoading(false)
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'workout_logging',
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

    if (!notes.trim()) {
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateY: pageSlideAnim }],
          opacity: pageOpacityAnim,
        }}
      >
        <View style={styles.keyboardView}>
          <Pressable style={styles.header} onPress={blurInputs}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
              disabled={isLoading}
            >
              <Ionicons name="arrow-back" size={28} color={colors.text} />
            </TouchableOpacity>
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

          <ScrollView
            style={styles.inputContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            bounces={true}
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
                selectionColor={
                  Platform.OS === 'ios' ? colors.primary : undefined
                }
              />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Workout Notes Input */}
            <View style={styles.notesInputWrapper}>
              <TextInput
                ref={notesInputRef}
                style={styles.notesInput}
                placeholder="Input your workout..."
                placeholderTextColor="#999"
                multiline
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
                editable={!isRecording && !isTranscribing}
                autoFocus={false}
                cursorColor={colors.primary}
                selectionColor={
                  Platform.OS === 'ios' ? colors.primary : undefined
                }
                onFocus={() => {
                  setIsNotesFocused(true)
                }}
                onBlur={() => {
                  setIsNotesFocused(false)
                }}
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

            {/* Example Workout - shown when user has no workouts and inputs are empty */}
            {!notes.trim() && !workoutTitle.trim() && userWorkoutCount === 0 && (
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleLabel}>Example:</Text>
                <View style={styles.exampleCard}>
                  <Text style={styles.exampleTitle}>
                    {exampleWorkout.title}
                  </Text>
                  <View style={styles.exampleDivider} />
                  <Text style={styles.exampleText}>{exampleWorkout.notes}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Floating Microphone Button */}
          <TouchableOpacity
            style={[
              styles.micFab,
              isRecording && styles.micFabActive,
              {
                bottom:
                  keyboardHeight > 0 ? keyboardHeight + 56 : 32 + insets.bottom,
              },
            ]}
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
            style={[
              styles.cameraFab,
              {
                bottom:
                  keyboardHeight > 0
                    ? keyboardHeight - 24
                    : -48 + insets.bottom,
              },
            ]}
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

          {/* Paywall Modal */}
          <Paywall
            visible={showPaywall}
            onClose={() => setShowPaywall(false)}
            title="Workout Logging is Premium"
            message="Logging workouts is a premium feature. Subscribe to track unlimited workouts and unlock all features."
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
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
    },
    headerButton: {
      padding: 8,
      minWidth: 44,
      justifyContent: 'center',
      alignItems: 'center',
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
      bottom: 64,
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
      bottom: -16,
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
    },
    titleInputContainer: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    titleInput: {
      fontSize: 28,
      fontWeight: '600',
      color: colors.text,
      lineHeight: Platform.OS === 'ios' ? 34 : 32,
      paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
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
    notesOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    exampleContainer: {
      position: 'absolute',
      top: '20%',
      marginTop: 16,
      left: 0,
      right: 0,
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
