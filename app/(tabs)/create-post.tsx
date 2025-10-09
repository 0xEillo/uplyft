import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const DRAFT_KEY = '@workout_draft'
const PENDING_POST_KEY = '@pending_workout_post'

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
  const fadeAnim = useRef(new Animated.Value(0)).current
  const titleInputRef = useRef<TextInput>(null)
  const notesInputRef = useRef<TextInput>(null)
  const { user } = useAuth()
  const { canLogWorkout, showPaywall, isInTrial } = useSubscription()

  const blurInputs = useCallback(() => {
    const activeInput =
      typeof InteractionManager.runAfterInteractions !== 'undefined'
        ? (TextInput as any)?.State?.currentlyFocusedInput?.()
        : null

    if (activeInput) {
      ;(TextInput as any)?.State?.blurTextInput?.(activeInput)
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

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      // Blur inputs immediately on focus
      blurInputs()

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
    }, [blurInputs]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
    }
  }, [blurInputs])

  // Load saved draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(DRAFT_KEY)
        if (draft) {
          setNotes(draft)
        }
      } catch (error) {
        console.error('Error loading draft:', error)
      }
    }
    loadDraft()
  }, [])

  // Auto-save draft whenever notes change with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if (notes.trim()) {
          await AsyncStorage.setItem(DRAFT_KEY, notes)
          // Show "Draft saved" indicator
          setShowDraftSaved(true)
          // Hide after 2 seconds
          setTimeout(() => setShowDraftSaved(false), 2000)
        } else {
          await AsyncStorage.removeItem(DRAFT_KEY)
          setShowDraftSaved(false)
        }
      } catch (error) {
        console.error('Error saving draft:', error)
      }
    }, 800) // Wait 800ms after user stops typing

    return () => clearTimeout(timer)
  }, [notes])

  const handleCancel = async () => {
    if (isRecording) {
      await stopRecording()
    }
    blurInputs()
    router.back()
  }

  const submitWorkout = async () => {
    try {
      setIsLoading(true)
      // Store pending post data
      await AsyncStorage.setItem(
        PENDING_POST_KEY,
        JSON.stringify({
          notes: notes.trim(),
          title: workoutTitle.trim(),
        }),
      )

      // Clear draft since we're creating the post
      await AsyncStorage.removeItem(DRAFT_KEY)

      // Navigate to feed immediately
      setNotes('')
      setWorkoutTitle('')
      blurInputs()
      router.back()
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

    // Check if user can log workout (subscription/trial check)
    if (!canLogWorkout) {
      Alert.alert(
        isInTrial ? 'Trial Ended' : 'Subscription Required',
        isInTrial
          ? 'Your trial has ended. Subscribe to continue logging workouts!'
          : 'Start your free trial or subscribe to log workouts!',
        [
          {
            text: 'Subscribe',
            onPress: () => showPaywall(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      )
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
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
          >
            {isLoading ? (
              <Ionicons
                name="hourglass-outline"
                size={28}
                color={colors.white}
              />
            ) : (
              <Ionicons name="checkmark" size={28} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
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
            {isNotesFocused && (
              <Pressable
                style={styles.notesOverlay}
                onPress={() => {
                  notesInputRef.current?.blur()
                }}
              />
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

          {/* Example Workout - shown when both inputs are empty and preference is enabled */}
          {!notes.trim() && !workoutTitle.trim() && showExamples && (
            <View style={styles.exampleContainer}>
              <Text style={styles.exampleLabel}>Example:</Text>
              <View style={styles.exampleCard}>
                <Text style={styles.exampleTitle}>{exampleWorkout.title}</Text>
                <View style={styles.exampleDivider} />
                <Text style={styles.exampleText}>{exampleWorkout.notes}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Floating Microphone Button */}
        <TouchableOpacity
          style={[styles.micFab, isRecording && styles.micFabActive]}
          onPress={toggleRecording}
          disabled={isTranscribing || isLoading}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={28}
              color={colors.white}
            />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    micFab: {
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
  })
