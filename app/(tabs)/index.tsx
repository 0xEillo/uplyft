import { FeedCard } from '@/components/feed-card'
import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const PENDING_POST_KEY = '@pending_workout_post'
const DRAFT_KEY = '@workout_draft'

export default function FeedScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadWorkouts = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      const data = await database.workoutSessions.getRecent(user.id, 20)
      setWorkouts(data)
    } catch (error) {
      console.error('Error loading workouts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const handlePendingPost = useCallback(async () => {
    if (!user) return

    try {
      const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
      if (!pendingData) return

      const { notes, title } = JSON.parse(pendingData)

      // Parse workout
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

      // Override type with user-provided title
      workout.type = title

      // Save to database
      await database.workoutSessions.create(user.id, workout, notes)

      // Clear pending post on success
      await AsyncStorage.removeItem(PENDING_POST_KEY)

      // Reload workouts to show new post
      await loadWorkouts()
    } catch (error) {
      console.error('Error creating post:', error)

      // Restore notes to draft for user to retry
      try {
        const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
        if (pendingData) {
          const { notes } = JSON.parse(pendingData)
          await AsyncStorage.setItem(DRAFT_KEY, notes)
          await AsyncStorage.removeItem(PENDING_POST_KEY)
        }
      } catch (restoreError) {
        console.error('Error restoring draft:', restoreError)
      }

      Alert.alert('Error', 'Failed to create workout post. Please try again.')
      router.push('/(tabs)/create-post')
    }
  }, [user, loadWorkouts, router])

  useFocusEffect(
    useCallback(() => {
      handlePendingPost().then(() => loadWorkouts())
    }, [handlePendingPost, loadWorkouts]),
  )

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Flex AI</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feed Posts */}
        <View style={styles.feed}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="barbell-outline"
                size={64}
                color={AppColors.textPlaceholder}
              />
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to log your first workout
              </Text>
            </View>
          ) : (
            workouts.map((workout) => (
              <AsyncPrFeedCard
                key={workout.id}
                workout={workout}
                onDelete={loadWorkouts}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function AsyncPrFeedCard({
  workout,
  onDelete,
}: {
  workout: WorkoutSessionWithDetails
  onDelete: () => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [prs, setPrs] = useState<number>(0)
  const [prInfo, setPrInfo] = useState<any[]>([])
  const [isComputed, setIsComputed] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [editedTitle, setEditedTitle] = useState(workout.type || '')
  const [editedNotes, setEditedNotes] = useState(workout.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const compute = useCallback(async () => {
    if (!user || isComputed) return
    try {
      const ctx = {
        sessionId: workout.id,
        userId: user.id,
        createdAt: workout.created_at,
        exercises: (workout.workout_exercises || []).map((we) => ({
          exerciseId: we.exercise_id,
          exerciseName: we.exercise?.name || 'Exercise',
          sets: (we.sets || []).map((s) => ({
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      }
      const result = await PrService.computePrsForSession(ctx)
      setPrs(result.totalPrs)

      // Build PR info for the feed card
      const prData = result.perExercise.map((exPr) => ({
        exerciseName: exPr.exerciseName,
        prSetIndices: new Set(exPr.prs.flatMap((pr) => pr.setIndices || [])),
        prLabels: exPr.prs.map((pr) => pr.label),
        hasCurrentPR: exPr.prs.some((pr) => pr.isCurrent),
      }))
      setPrInfo(prData)
      setIsComputed(true)
    } catch (error) {
      console.error('Error computing PRs:', error)
      setPrs(0)
      setPrInfo([])
    }
  }, [user, workout, isComputed])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout)

  const handleUserPress = () => {
    if (workout.user_id && workout.user_id !== user?.id) {
      router.push(`/user/${workout.user_id}`)
    }
  }

  const handleEdit = () => {
    setEditedTitle(workout.type || '')
    setEditedNotes(workout.notes || '')
    setIsEditModalVisible(true)
  }

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true)
      await database.workoutSessions.update(workout.id, {
        type: editedTitle.trim() || undefined,
        notes: editedNotes.trim() || undefined,
      })
      setIsEditModalVisible(false)
      onDelete() // Refresh the feed
    } catch (error) {
      console.error('Error updating workout:', error)
      Alert.alert('Error', 'Failed to update workout. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.workoutSessions.delete(workout.id)
              onDelete()
            } catch (error) {
              console.error('Error deleting workout:', error)
              Alert.alert(
                'Error',
                'Failed to delete workout. Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  return (
    <>
      <FeedCard
        userName="You"
        userAvatar=""
        timeAgo={formatTimeAgo(workout.created_at)}
        workoutTitle={
          workout.type || workout.notes?.split('\n')[0] || 'Workout Session'
        }
        workoutDescription={workout.notes}
        exercises={exercises}
        stats={{
          exercises: (workout.workout_exercises || []).length,
          sets:
            workout.workout_exercises?.reduce(
              (sum, we) => sum + (we.sets?.length || 0),
              0,
            ) || 0,
          prs,
        }}
        likes={0}
        comments={0}
        userId={workout.user_id}
        workoutId={workout.id}
        onUserPress={workout.user_id !== user?.id ? handleUserPress : undefined}
        onEdit={handleEdit}
        onDelete={handleDelete}
        prInfo={prInfo}
      />

      {/* Edit Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Workout</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.editModalBody}>
              <Text style={styles.editLabel}>Title</Text>
              <TextInput
                style={styles.editInput}
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Workout Title"
                placeholderTextColor={AppColors.textPlaceholder}
                maxLength={50}
              />

              <Text style={styles.editLabel}>Notes</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="Workout notes..."
                placeholderTextColor={AppColors.textPlaceholder}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.editSaveButton,
                  isSaving && styles.editSaveButtonDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={AppColors.white} />
                ) : (
                  <Text style={styles.editSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  content: {
    flex: 1,
  },
  feed: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.textTertiary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: AppColors.textLight,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: AppColors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  closeButton: {
    padding: 4,
  },
  editModalBody: {
    padding: 20,
  },
  editLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: AppColors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: AppColors.text,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 16,
  },
  editTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  editCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: AppColors.backgroundLight,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  editSaveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
  },
  editSaveButtonDisabled: {
    opacity: 0.5,
  },
  editSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
})
