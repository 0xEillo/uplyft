import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function CreateSpeechScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    // Request permissions on mount
    ;(async () => {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone access')
      }
    })()
  }, [])

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      )
      setRecording(recording)
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      Alert.alert('Error', 'Failed to start recording')
    }
  }

  const stopRecording = async () => {
    if (!recording) return

    setIsRecording(false)
    setIsProcessing(true)

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()

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
        await database.workoutSessions.create(user.id, workout, text)
      }

      router.back()
    } catch (error) {
      console.error('Error processing recording:', error)
      Alert.alert('Error', 'Failed to process your workout. Please try again.')
    } finally {
      setRecording(null)
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    if (recording) {
      recording.stopAndUnloadAsync()
      setRecording(null)
    }
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Recording</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Recording UI */}
      <View style={styles.content}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.processingText}>Processing workout...</Text>
          </View>
        ) : (
          <>
            <View style={styles.waveformContainer}>
              <Ionicons
                name={isRecording ? 'radio-button-on' : 'mic'}
                size={120}
                color={isRecording ? '#FF6B35' : '#ccc'}
              />
              {isRecording && (
                <Text style={styles.recordingText}>Recording...</Text>
              )}
            </View>

            <View style={styles.instructions}>
              <Text style={styles.instructionsText}>
                {isRecording
                  ? 'Describe your workout. Tap stop when done.'
                  : 'Tap the button below to start recording'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={32}
                color="#fff"
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
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
    color: '#FF6B35',
    marginTop: 24,
  },
  instructions: {
    marginBottom: 48,
  },
  instructionsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: '#ff4444',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    fontSize: 17,
    color: '#666',
    marginTop: 24,
  },
})
