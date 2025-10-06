import { ScreenHeader } from '@/components/screen-header'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CreateSpeechScreen() {
  const colors = useThemedColors()
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    ;(async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync()
      if (!status.granted) {
        Alert.alert('Permission required', 'Please grant microphone access')
      }

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      })
    })()
  }, [])

  const startRecording = async () => {
    try {
      await audioRecorder.prepareToRecordAsync()
      audioRecorder.record()
    } catch (error) {
      console.error('Failed to start recording:', error)
      Alert.alert('Error', 'Failed to start recording')
    }
  }

  const stopRecording = async () => {
    if (!recorderState.isRecording) return

    setIsProcessing(true)

    try {
      await audioRecorder.stop()
      const uri = audioRecorder.uri

      if (!uri) {
        throw new Error('No recording URI')
      }

      // Send to transcription API
      const formData = new FormData()
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'workout.m4a',
      } as any)

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!transcribeResponse.ok) {
        throw new Error('Failed to transcribe audio')
      }

      const { text } = await transcribeResponse.json()

      // Parse the transcription
      const parseResponse = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: text }),
      })

      if (!parseResponse.ok) {
        throw new Error('Failed to parse workout')
      }

      const { workout } = await parseResponse.json()

      // Save to database
      if (user) {
        try {
          await database.workoutSessions.create(user.id, workout, text)
        } catch (dbError) {
          console.error('Error saving to database:', dbError)
          throw new Error('Failed to save workout to database')
        }
      }

      router.back()
    } catch (error) {
      console.error('Error processing recording:', error)
      Alert.alert('Error', 'Failed to process your workout. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = async () => {
    if (recorderState.isRecording) {
      await audioRecorder.stop()
    }
    router.back()
  }

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Voice Recording"
        onLeftPress={handleCancel}
        leftIcon="close"
      />

      <View style={styles.content}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>Processing workout...</Text>
          </View>
        ) : (
          <>
            <View style={styles.waveformContainer}>
              <Ionicons
                name={recorderState.isRecording ? 'radio-button-on' : 'mic'}
                size={120}
                color={
                  recorderState.isRecording
                    ? colors.primary
                    : colors.textPlaceholder
                }
              />
              {recorderState.isRecording && (
                <Text style={styles.recordingText}>Recording...</Text>
              )}
            </View>

            <View style={styles.instructions}>
              <Text style={styles.instructionsText}>
                {recorderState.isRecording
                  ? 'Describe your workout. Tap stop when done.'
                  : 'Tap the button below to start recording'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.recordButton,
                recorderState.isRecording && styles.recordButtonActive,
              ]}
              onPress={
                recorderState.isRecording ? stopRecording : startRecording
              }
            >
              <Ionicons
                name={recorderState.isRecording ? 'stop' : 'mic'}
                size={32}
                color={colors.white}
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.white,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    waveformContainer: {
      alignItems: 'center',
      marginBottom: 48,
    },
    recordingText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 24,
    },
    instructions: {
      marginBottom: 48,
    },
    instructionsText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    recordButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    recordButtonActive: {
      backgroundColor: colors.primaryDark,
    },
    processingContainer: {
      alignItems: 'center',
    },
    processingText: {
      fontSize: 17,
      color: colors.textSecondary,
      marginTop: 24,
    },
  })
