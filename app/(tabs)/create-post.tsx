import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

export default function CreatePostScreen() {
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()

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
      await database.workoutSessions.create(user.id, workout, notes)

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            disabled={isLoading}
          >
            <Ionicons name="close" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePost}
            style={[styles.headerButton, styles.postButton]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={28} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Notes Input */}
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
    backgroundColor: '#fff',
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
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    padding: 8,
  },
  postButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    padding: 20,
    fontSize: 17,
    lineHeight: 24,
    color: '#1a1a1a',
  },
})
