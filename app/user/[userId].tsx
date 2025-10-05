import { FeedCard } from '@/components/feed-card'
import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userTag, setUserTag] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const loadUserData = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const workoutData = await database.workoutSessions.getRecent(userId, 20)
      setWorkouts(workoutData)

      // Try to load profile, but don't fail if it doesn't exist
      try {
        const profileData = await database.profiles.getById(userId)
        setUserName(profileData.display_name)
        setUserTag(profileData.user_tag)
        setAvatarUrl(profileData.avatar_url)
      } catch (profileError) {
        console.error('Profile not found, using defaults:', profileError)
        setUserName('User')
        setUserTag('')
        setAvatarUrl(null)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      loadUserData()
    }, [loadUserData]),
  )

  const isOwnProfile = user?.id === userId

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons
              name="settings-outline"
              size={24}
              color={AppColors.text}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info */}
        <View style={styles.profileSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#fff" />
            </View>
          )}
          <Text style={styles.userName}>{userName}</Text>
          {userTag && <Text style={styles.userTag}>@{userTag}</Text>}
        </View>

        {/* Tab Header (Log only for other users) */}
        <View style={styles.tabHeader}>
          <Text style={styles.tabHeaderText}>Workout Log</Text>
        </View>

        {/* Workout Posts */}
        <View style={styles.logContent}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="barbell-outline"
                size={64}
                color={AppColors.textPlaceholder}
              />
              <Text style={styles.emptyText}>No workouts yet</Text>
            </View>
          ) : (
            workouts.map((workout) => (
              <AsyncPrFeedCard
                key={workout.id}
                workout={workout}
                userId={userId}
                userName={userName}
                avatarUrl={avatarUrl}
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
  userId,
  userName,
  avatarUrl,
}: {
  workout: WorkoutSessionWithDetails
  userId: string
  userName: string
  avatarUrl: string | null
}) {
  const [prs, setPrs] = useState<number>(0)
  const [isComputed, setIsComputed] = useState(false)

  const compute = useCallback(async () => {
    if (isComputed) return
    try {
      const ctx = {
        sessionId: workout.id,
        userId: userId,
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
      setIsComputed(true)
    } catch (error) {
      console.error('Error computing PRs:', error)
      setPrs(0)
    }
  }, [userId, workout, isComputed])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout)

  return (
    <FeedCard
      userName={userName}
      userAvatar={avatarUrl || ''}
      timeAgo={formatTimeAgo(workout.created_at)}
      workoutTitle={
        workout.type || workout.notes?.split('\n')[0] || 'Workout Session'
      }
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
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: AppColors.text,
  },
  placeholder: {
    width: 24,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  userTag: {
    fontSize: 15,
    fontWeight: '500',
    color: AppColors.textSecondary,
    marginTop: 4,
  },
  tabHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: AppColors.white,
    borderBottomWidth: 2,
    borderBottomColor: AppColors.primary,
  },
  tabHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.primary,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  logContent: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.textTertiary,
    marginTop: 16,
  },
})
