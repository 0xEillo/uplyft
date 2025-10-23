import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { Platform } from 'react-native'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'

/**
 * Type definition for audio file in FormData.
 * React Native's FormData accepts this shape for file uploads.
 */
interface AudioFileBlob {
  uri: string
  type: string
  name: string
}

interface UseAudioTranscriptionOptions {
  onTranscriptionComplete?: (text: string) => void
  onError?: (error: Error) => void
}

/**
 * Custom hook for audio recording and transcription.
 * Handles permissions, recording state, and API calls.
 *
 * @example
 * ```tsx
 * const { isRecording, isTranscribing, toggleRecording, stopRecording } = useAudioTranscription({
 *   onTranscriptionComplete: (text) => setNotes(prev => prev + text)
 * })
 * ```
 */
export function useAudioTranscription(options: UseAudioTranscriptionOptions = {}) {
  const { onTranscriptionComplete, onError } = options

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)
  const [isTranscribing, setIsTranscribing] = useState(false)

  // Setup audio permissions and mode
  useEffect(() => {
    const setupAudio = async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync()
        if (!status.granted) {
          console.log('Microphone permission not granted')
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        })
      } catch (error) {
        console.error('Error setting up audio:', error)
      }
    }

    setupAudio()
  }, [])

  /**
   * Transcribe the recorded audio using the Supabase Edge Function
   */
  const transcribeAudio = useCallback(
    async (uri: string): Promise<string> => {
      // Import at call time to avoid issues with module resolution
      const { callSupabaseFunctionWithFormData } = await import('@/lib/supabase-functions-client')
      const { supabase } = await import('@/lib/supabase')

      const formData = new FormData()
      const audioFile: AudioFileBlob = {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      }
      // FormData.append accepts Blob-like objects in React Native
      formData.append('audio', audioFile as unknown as Blob)

      // Get the session token for authentication
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await callSupabaseFunctionWithFormData('transcribe', formData, token)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to transcribe audio')
      }

      const { text } = await response.json()
      return text
    },
    [],
  )

  /**
   * Start or stop recording, and transcribe if stopping
   */
  const toggleRecording = useCallback(async () => {
    if (recorderState.isRecording) {
      // Stop recording and transcribe
      setIsTranscribing(true)
      try {
        await audioRecorder.stop()
        const uri = audioRecorder.uri

        if (!uri) {
          throw new Error('No recording URI')
        }

        const text = await transcribeAudio(uri)
        onTranscriptionComplete?.(text)
      } catch (error) {
        console.error('Error transcribing:', error)
        const errorObj = error instanceof Error ? error : new Error('Unknown error')
        onError?.(errorObj)

        Alert.alert(
          'Transcription Failed',
          'Unable to convert your audio. Please try recording again.',
          [{ text: 'OK' }],
        )
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
        Alert.alert(
          'Recording Issue',
          'Unable to start recording. Check your microphone permissions.',
          [{ text: 'OK' }],
        )
      }
    }
  }, [recorderState.isRecording, audioRecorder, transcribeAudio, onTranscriptionComplete, onError])

  /**
   * Stop recording without transcribing
   */
  const stopRecording = useCallback(async () => {
    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop()
      } catch (error) {
        console.error('Error stopping recording:', error)
      }
    }
  }, [recorderState.isRecording, audioRecorder])

  return {
    isRecording: recorderState.isRecording,
    isTranscribing,
    toggleRecording,
    stopRecording,
  }
}
