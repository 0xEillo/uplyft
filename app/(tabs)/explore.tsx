import { FeedCard } from '@/components/feed-card'
import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { Profile, WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { router } from 'expo-router'
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

type TabType = 'progress' | 'log'

export default function ProfileScreen() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('progress')
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  const loadProfile = useCallback(async () => {
    if (!user?.email) return

    try {
      const data = await database.profiles.getOrCreate(user.id, user.email)
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }, [user])

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

  useFocusEffect(
    useCallback(() => {
      loadProfile()
      if (activeTab === 'log') {
        loadWorkouts()
      }
    }, [loadProfile, loadWorkouts, activeTab]),
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={AppColors.text} />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info */}
        <View style={styles.profileSection}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#fff" />
            </View>
          )}
          <Text style={styles.userName}>
            {profile?.display_name || user?.email?.split('@')[0] || 'User'}
          </Text>
          {profile?.user_tag && (
            <Text style={styles.userTag}>@{profile.user_tag}</Text>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
            onPress={() => setActiveTab('progress')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'progress' && styles.activeTabText,
              ]}
            >
              Progress
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'log' && styles.activeTab]}
            onPress={() => setActiveTab('log')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'log' && styles.activeTabText,
              ]}
            >
              Log
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'progress' ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="analytics-outline"
              size={64}
              color={AppColors.textPlaceholder}
            />
            <Text style={styles.emptyText}>Analytics Coming Soon</Text>
          </View>
        ) : (
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
                <AsyncPrFeedCard key={workout.id} workout={workout} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function AsyncPrFeedCard({ workout }: { workout: WorkoutSessionWithDetails }) {
  const { user } = useAuth()
  const [prs, setPrs] = useState<number>(0)
  const [isComputed, setIsComputed] = useState(false)

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
      setIsComputed(true)
    } catch (error) {
      console.error('Error computing PRs:', error)
      setPrs(0)
    }
  }, [user, workout, isComputed])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout)

  return (
    <FeedCard
      userName="You"
      userAvatar=""
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
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.text,
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
    marginBottom: 4,
  },
  userTag: {
    fontSize: 15,
    fontWeight: '500',
    color: AppColors.textSecondary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: AppColors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  activeTabText: {
    color: AppColors.primary,
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
