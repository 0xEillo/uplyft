import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
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

  const handleCancel = () => {
    router.back()
  }

  const handlePost = () => {
    // TODO: Handle posting the workout
    console.log('Posting workout:', notes)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePost}
            style={[styles.headerButton, styles.postButton]}
          >
            <Ionicons name="checkmark" size={28} color="#fff" />
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
