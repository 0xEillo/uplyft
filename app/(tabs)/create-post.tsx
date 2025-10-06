import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [exampleWorkout, setExampleWorkout] = useState({ title: '', notes: '' })
  const [showExamples, setShowExamples] = useState(true)
  const { user } = useAuth()
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)

  const styles = createStyles(colors)

  // Randomize example each time screen is focused
  useFocusEffect(
    useCallback(() => {
      const randomExample =
        EXAMPLE_WORKOUTS[Math.floor(Math.random() * EXAMPLE_WORKOUTS.length)]
      setExampleWorkout(randomExample)

      // Load preference
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
    }, []),
  )

  // Setup audio permissions
  useEffect(() => {
    ;(async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync()
      if (!status.granted) {
        console.log('Microphone permission not granted')
      }

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      })
    })()
  }, [])

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

  // Auto-save draft whenever notes change
  useEffect(() => {
    const saveDraft = async () => {
      try {
        if (notes.trim()) {
          await AsyncStorage.setItem(DRAFT_KEY, notes)
        } else {
          await AsyncStorage.removeItem(DRAFT_KEY)
        }
      } catch (error) {
        console.error('Error saving draft:', error)
      }
    }
    saveDraft()
  }, [notes])

  const handleCancel = async () => {
    if (recorderState.isRecording) {
      await audioRecorder.stop()
    }
    router.back()
  }

  const toggleRecording = async () => {
    if (recorderState.isRecording) {
      // Stop recording and transcribe
      setIsTranscribing(true)
      try {
        await audioRecorder.stop()
        const uri = audioRecorder.uri

        if (!uri) {
          throw new Error('No recording URI')
        }

        // Send to transcription API
        const formData = new FormData()
        formData.append('audio', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          type: 'audio/m4a',
          name: 'workout.m4a',
        } as any)

        const transcribeResponse = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        if (!transcribeResponse.ok) {
          throw new Error('Failed to transcribe audio')
        }

        const { text } = await transcribeResponse.json()

        // Append transcribed text to notes
        setNotes((prev) => (prev ? `${prev}\n${text}` : text))
      } catch (error) {
        console.error('Error transcribing:', error)
        Alert.alert('Error', 'Failed to transcribe audio. Please try again.')
      } finally {
        setIsTranscribing(false)
      }
    } else {
      // Start recording
      try {
        await audioRecorder.prepareToRecordAsync()
        audioRecorder.record()
      } catch (error) {
        console.error('Failed to start recording:', error)
        Alert.alert('Error', 'Failed to start recording')
      }
    }
  }

  const handlePost = async () => {
    if (!workoutTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your workout')
      return
    }

    if (!notes.trim()) {
      Alert.alert('Error', 'Please enter your workout notes')
      return
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to post')
      return
    }

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
      router.back()
    } catch (error) {
      console.error('Error saving pending post:', error)
      Alert.alert('Error', 'Failed to prepare workout post')
    } finally {
      setIsLoading(false)
    }
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
          <TouchableOpacity
            onPress={handlePost}
            style={[styles.headerButton, styles.primaryButton]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="checkmark" size={28} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          {/* Title Input */}
          <TextInput
            style={styles.titleInput}
            placeholder="Workout Title"
            placeholderTextColor="#999"
            value={workoutTitle}
            onChangeText={setWorkoutTitle}
            editable={!recorderState.isRecording && !isTranscribing}
            maxLength={50}
          />

          {/* Divider */}
          <View style={styles.divider} />

          {/* Workout Notes Input */}
          <TextInput
            style={styles.notesInput}
            placeholder="Input your workout..."
            placeholderTextColor="#999"
            multiline
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
            editable={!recorderState.isRecording && !isTranscribing}
          />

          {/* Example Workout - shown when both inputs are empty and preference is enabled */}
          {!notes.trim() && !workoutTitle.trim() && showExamples && (
            <View style={styles.exampleContainer}>
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
          style={[
            styles.micFab,
            recorderState.isRecording && styles.micFabActive,
          ]}
          onPress={toggleRecording}
          disabled={isTranscribing || isLoading}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons
              name={recorderState.isRecording ? 'stop' : 'mic'}
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
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
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
    notesInput: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      fontSize: 17,
      lineHeight: 24,
      color: colors.text,
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
