import { ScreenHeader } from '@/components/screen-header'
import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const DRAFT_KEY = '@workout_draft'

export default function CreatePostScreen() {
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const { user } = useAuth()
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)

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
    if (!notes.trim()) {
      Alert.alert('Error', 'Please enter your workout notes')
      return
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to post')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse workout')
      }

      const data = await response.json()
      const { workout } = data

      // Save to database
      try {
        await database.workoutSessions.create(user.id, workout, notes)
      } catch (dbError) {
        console.error('Error saving to database:', dbError)
        throw new Error('Failed to save workout to database')
      }

      // Clear draft after successful post
      await AsyncStorage.removeItem(DRAFT_KEY)
      setNotes('')
      router.back()
    } catch (error) {
      console.error('Error posting workout:', error)
      Alert.alert('Error', 'Failed to post workout. Please try again.')
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
            <Ionicons name="close" size={28} color={AppColors.text} />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[
                styles.micHeaderButton,
                recorderState.isRecording && styles.micHeaderButtonActive,
              ]}
              onPress={toggleRecording}
              disabled={isTranscribing || isLoading}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={AppColors.white} />
              ) : (
                <Ionicons
                  name={recorderState.isRecording ? 'stop' : 'mic'}
                  size={20}
                  color={AppColors.white}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              style={[styles.headerButton, styles.primaryButton]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={AppColors.white} />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={28}
                  color={AppColors.white}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Describe your workout..."
          placeholderTextColor="#999"
          multiline
          autoFocus
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
          editable={!recorderState.isRecording && !isTranscribing}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.white,
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
    borderBottomColor: AppColors.border,
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  micHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micHeaderButtonActive: {
    backgroundColor: AppColors.primaryDark,
  },
  input: {
    flex: 1,
    padding: 20,
    fontSize: 17,
    lineHeight: 24,
    color: AppColors.text,
  },
})
