import { ImagePickerModal } from '@/components/ImagePickerModal'
import { Paywall } from '@/components/paywall'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import { useImageTranscription } from '@/hooks/useImageTranscription'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { uploadWorkoutImage } from '@/lib/utils/image-upload'
import {
  generateWorkoutMessage,
  parseCommitment,
} from '@/lib/utils/workout-messages'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
import { SafeAreaView } from 'react-native-safe-area-context'

const DRAFT_KEY = '@workout_draft'
const TITLE_DRAFT_KEY = '@workout_title_draft'
const PENDING_POST_KEY = '@pending_workout_post'
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
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [exampleWorkout, setExampleWorkout] = useState({ title: '', notes: '' })
  const [showExamples, setShowExamples] = useState(true)
  const [showDraftSaved, setShowDraftSaved] = useState(false)
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)

  // Image attachment states
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  const { showOverlay } = useSuccessOverlay()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const spinValue = useRef(new Animated.Value(0)).current
  const buttonScaleAnim = useRef(new Animated.Value(1)).current
  const imageOpacity = useRef(new Animated.Value(0)).current

  // Page opening animation - like lifting a notepad or opening a book
  const pageSlideAnim = useRef(new Animated.Value(100)).current // Start below screen
  const pageScaleAnim = useRef(new Animated.Value(0.94)).current // Start slightly smaller
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
      pageScaleAnim.setValue(0.94)
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
        // Scale up to full size
        Animated.spring(pageScaleAnim, {
          toValue: 1,
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

      trackEvent('Workout Create Started', {
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

      // Load user preference for showing examples
      const loadPreference = async () => {
        try {
          const value = await AsyncStorage.getItem('@show_workout_examples')
          if (value !== null) {
            setShowExamples(value === 'true')
          }
        } catch (error) {
          console.error('Error loading preference:', error)
        }
      }
      loadPreference()

      return () => {
        clearTimeout(timeoutId)
        interactionHandle.cancel?.()
        blurInputs()
      }
    }, [blurInputs, trackEvent, pageSlideAnim, pageScaleAnim, pageOpacityAnim]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
    }
  }, [blurInputs])

  useEffect(() => {
    latestNotes.current = notes
  }, [notes])

  useEffect(() => {
    latestTitle.current = workoutTitle
  }, [workoutTitle])

  // Load saved draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const [draft, titleDraft, pendingRaw] = await Promise.all([
          AsyncStorage.getItem(DRAFT_KEY),
          AsyncStorage.getItem(TITLE_DRAFT_KEY),
          AsyncStorage.getItem(PENDING_POST_KEY),
        ])

        let pending: { notes?: string; title?: string } | null = null
        if (pendingRaw) {
          try {
            pending = JSON.parse(pendingRaw)
          } catch (parseError) {
            console.error('Error parsing pending workout data:', parseError)
          }
        }

        if (draft) {
          setNotes(draft)
          skipDraftClearRef.current = true
        } else if (pending?.notes) {
          setNotes(pending.notes)
          skipDraftClearRef.current = true
        }

        if (titleDraft) {
          setWorkoutTitle(titleDraft)
          skipTitleDraftClearRef.current = true
        } else if (pending?.title) {
          setWorkoutTitle(pending.title)
          skipTitleDraftClearRef.current = true
        }
      } catch (error) {
        console.error('Error loading draft:', error)
      }
    }
    loadDraft()
  }, [])

  // Auto-save draft whenever notes change with debounce
  useEffect(() => {
    if (skipDraftClearRef.current) {
      skipDraftClearRef.current = false
      return
    }

    const timer = setTimeout(async () => {
      try {
        if (notes.trim()) {
          await AsyncStorage.setItem(DRAFT_KEY, notes)
          // Show "Draft saved" indicator
          setShowDraftSaved(true)
          // Hide after 2 seconds
          setTimeout(() => setShowDraftSaved(false), 2000)

          trackEvent('Workout Create Saved', {
            length: notes.trim().length,
            hasTitle: Boolean(workoutTitle.trim()),
          })
        } else {
          await AsyncStorage.removeItem(DRAFT_KEY)
          setShowDraftSaved(false)
        }
      } catch (error) {
        console.error('Error saving draft:', error)
      }
    }, 2500) // Wait 2500ms after user stops typing

    return () => clearTimeout(timer)
  }, [notes, workoutTitle, trackEvent])

  // Auto-save title draft whenever title changes with debounce
  useEffect(() => {
    if (skipTitleDraftClearRef.current) {
      skipTitleDraftClearRef.current = false
      return
    }

    const timer = setTimeout(async () => {
      try {
        if (workoutTitle.trim()) {
          await AsyncStorage.setItem(TITLE_DRAFT_KEY, workoutTitle)
        } else {
          if (!skipTitleDraftClearRef.current) {
            await AsyncStorage.removeItem(TITLE_DRAFT_KEY)
          }
        }
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

  const submitWorkout = async () => {
    try {
      setIsLoading(true)

      // Dismiss keyboard before starting animation
      blurInputs()

      // Haptic feedback for button press
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Animate button press
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

      // Upload image if attached
      let imageUrl: string | null = null
      if (attachedImageUri) {
        try {
          imageUrl = await uploadWorkoutImage(attachedImageUri, user!.id)
        } catch (error) {
          console.error('Error uploading image:', error)
          Alert.alert(
            'Image Upload Failed',
            'Unable to upload your workout photo. Would you like to continue without it?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsLoading(false)
                  return
                },
              },
              {
                text: 'Continue',
                onPress: async () => {
                  // Continue without image
                  setAttachedImageUri(null)
                },
              },
            ],
          )
          throw error // Stop submission if upload fails
        }
      }

      // Store pending post data
      await AsyncStorage.setItem(
        PENDING_POST_KEY,
        JSON.stringify({
          notes: notes.trim(),
          title: workoutTitle.trim(),
          imageUrl,
        }),
      )

      trackEvent('Workout Create Saved', {
        status: 'pending_saved',
        hasTitle: Boolean(workoutTitle.trim()),
        length: notes.trim().length,
      })

      // Don't clear draft yet - keep it until workout successfully posts
      // This way if submission fails, user can edit and retry

      // Generate motivational message based on weekly progress
      let message = 'Well done on completing another workout!'
      let workoutNumber = 1
      let weeklyTarget = 3
      try {
        // Get user profile for commitment/target
        const profile = await database.profiles.getById(user!.id)

        // Calculate start of week (Sunday)
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        // Count workouts this week (including this one)
        const workoutsThisWeek = await database.workoutSessions.getThisWeekCount(
          user!.id,
          startOfWeek,
        )
        workoutNumber = workoutsThisWeek + 1 // +1 for the one being submitted

        // Parse target and generate message
        weeklyTarget = parseCommitment(profile.commitment)
        message = generateWorkoutMessage({
          workoutNumber,
          weeklyTarget,
        })
      } catch (error) {
        console.error('Error generating workout message:', error)
        // Fall back to default message
      }

      // Haptic success feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Clear form and navigate to feed immediately
      setNotes('')
      setWorkoutTitle('')
      setAttachedImageUri(null)
      blurInputs()

      // Show overlay and navigate to feed
      showOverlay({ message, workoutNumber, weeklyTarget })
      router.replace('/(tabs)')
    } catch (error) {
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
    // Check if user is pro member
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent('Paywall Shown', {
        feature: 'workout_logging',
      })
      return
    }

    if (!workoutTitle.trim()) {
      Alert.alert(
        'Title Required',
        'Give your workout a title so you can find it later.',
        [{ text: 'OK' }],
      )
      return
    }

    if (!notes.trim()) {
      Alert.alert(
        'Workout Details Missing',
        'Add your exercises, sets, and reps to track your progress.',
        [{ text: 'OK' }],
      )
      return
    }

    if (!user) {
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

    trackEvent('Workout Create Submitted', {
      hasTitle: Boolean(workoutTitle.trim()),
      length: notes.trim().length,
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateY: pageSlideAnim }, { scale: pageScaleAnim }],
          opacity: pageOpacityAnim,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
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
          </View>

          <ScrollView
            style={styles.inputContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="never"
            showsVerticalScrollIndicator={false}
          >
            {/* Title Input */}
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
            />

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

            {/* Example Workout - shown when both inputs are empty and preference is enabled */}
            {!notes.trim() && !workoutTitle.trim() && showExamples && (
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
            style={styles.cameraFab}
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
        </KeyboardAvoidingView>
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
    titleInput: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      fontSize: 28,
      fontWeight: '600',
      color: colors.text,
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
      top: '35%',
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
