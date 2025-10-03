import { ScreenHeader } from '@/components/screen-header'
import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const DRAFT_KEY = '@workout_draft'

export default function CreatePostScreen() {
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()

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

  const handleCancel = () => {
    router.back()
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
        <ScreenHeader
          onLeftPress={handleCancel}
          leftIcon="close"
          onRightPress={handlePost}
          rightIcon="checkmark"
          rightLoading={isLoading}
          rightDisabled={isLoading}
          rightStyle="primary"
          leftDisabled={isLoading}
        />

        <TextInput
          style={styles.input}
          placeholder=""
          placeholderTextColor="#999"
          multiline
          autoFocus
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
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
  input: {
    flex: 1,
    padding: 20,
    fontSize: 17,
    lineHeight: 24,
    color: AppColors.text,
  },
})
