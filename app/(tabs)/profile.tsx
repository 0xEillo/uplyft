import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { LevelBadge } from '@/components/LevelBadge'
import { ProfileRoutines } from '@/components/Profile/ProfileRoutines'
import { useAuth } from '@/contexts/auth-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useUserLevel } from '@/hooks/useUserLevel'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { calculateTotalVolume } from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ProfileScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const { registerScrollRef } = useScrollToTop()
  const flatListRef = useRef<FlatList>(null)
  const { level: userLevel } = useUserLevel(user?.id)

  const styles = useMemo(() => createStyles(colors), [colors])
  const [profile, setProfile] = useState<any>(null)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [workoutCount, setWorkoutCount] = useState(0)

  // Workouts feed
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  )

  // Register FlatList ref for scroll-to-top functionality
  useEffect(() => {
    registerScrollRef('profile', flatListRef)
  }, [registerScrollRef])

  // This week stats
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0)
  const [weeklyVolume, setWeeklyVolume] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [weeklyActivity, setWeeklyActivity] = useState<boolean[]>(
    new Array(7).fill(false),
  )

  const loadProfileData = useCallback(async () => {
    if (!user) return

    try {
      // Load profile - signInAnonymously should have created one for anonymous users
      const profileData = await database.profiles.getByIdOrNull(user.id)

      if (!profileData) {
        console.error('[Profile] Profile not found for user:', user.id)
        return
      }

      setProfile(profileData)

      // Calculate start of week (Sunday)
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // Load stats
      const [
        counts,
        totalWorkouts,
        weekCount,
        streakResult,
      ] = await Promise.all([
        database.follows.getCounts(user.id),
        database.workoutSessions.getTotalCount(user.id),
        database.workoutSessions.getThisWeekCount(user.id, startOfWeek),
        database.stats.calculateStreak(user.id),
      ])

      setFollowerCount(counts.followers)
      setFollowingCount(counts.following)
      setWorkoutCount(totalWorkouts)
      setWeeklyWorkouts(weekCount)
      setCurrentStreak(streakResult.currentStreak)

      // Calculate weekly volume and activity
      const weekWorkouts = await database.workoutSessions.getRecent(
        user.id,
        100,
      )
      const weeklyWorkoutsList = weekWorkouts.filter((w) => {
        const workoutDate = new Date(w.date)
        return workoutDate >= startOfWeek
      })

      // Sum up all volume (weight * reps) for this week
      let totalVolume = 0
      const activity = new Array(7).fill(false)

      weeklyWorkoutsList.forEach((workout) => {
        totalVolume += calculateTotalVolume(workout, 'kg')
        const dayIndex = new Date(workout.date).getDay()
        activity[dayIndex] = true
      })

      setWeeklyVolume(totalVolume)
      setWeeklyActivity(activity)
    } catch (error) {
      console.error('Error loading profile data:', error)
    }
  }, [user])

  const loadWorkouts = useCallback(
    async (showLoading = false, loadMore = false) => {
      if (!user) return

      // Prevent concurrent load-more operations
      if (loadMore && isLoadingMore) {
        return
      }

      try {
        if (loadMore) {
          setIsLoadingMore(true)
        } else if (showLoading) {
          setIsLoading(true)
        }

        const currentOffset = loadMore ? offset : 0
        const limit = 10
        const data = await database.workoutSessions.getRecent(
          user.id,
          limit,
          currentOffset,
        )

        // Check if we have more workouts to load
        const hasMoreWorkouts = data.length === limit

        if (loadMore) {
          // Append new workouts to existing list
          setWorkouts((prev) => {
            // Deduplicate: only add workouts that aren't already in the list
            const existingIds = new Set(prev.map((w) => w.id))
            const newWorkouts = data.filter((w) => !existingIds.has(w.id))
            return [...prev, ...newWorkouts]
          })
          setOffset(currentOffset + data.length)
          setHasMore(hasMoreWorkouts)
        } else {
          // Initial load or refresh
          setWorkouts(data)
          setOffset(data.length)
          setHasMore(hasMoreWorkouts)
        }
      } catch (error) {
        console.error('Error loading workouts:', error)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [user, isLoadingMore, offset],
  )

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      loadWorkouts(false, true)
    }
  }, [isLoadingMore, hasMore, isLoading, loadWorkouts])

  useFocusEffect(
    useCallback(() => {
      loadProfileData()
      loadWorkouts(true)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  const renderWorkoutItem = useCallback(
    ({
      item: workout,
      index,
    }: {
      item: WorkoutSessionWithDetails
      index: number
    }) => (
      <View style={[index === 0 && { marginTop: -12 }]}>
        <AnimatedFeedCard
          key={workout.id}
          workout={workout}
          index={index}
          isNew={false}
          isDeleting={workout.id === deletingWorkoutId}
          onDelete={() => {
            if (workout.id === deletingWorkoutId) {
              setWorkouts((prev) => prev.filter((w) => w.id !== workout.id))
              setDeletingWorkoutId(null)
            } else {
              setDeletingWorkoutId(workout.id)
            }
          }}
        />
      </View>
    ),
    [deletingWorkoutId],
  )

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }, [isLoadingMore, colors.primary, styles])

  const renderEmptyState = useCallback(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="barbell-outline"
          size={64}
          color={colors.textPlaceholder}
        />
        <Text style={styles.emptyText}>No workouts yet</Text>
        <Text style={styles.emptySubtext}>
          Start logging to see your progress!
        </Text>
      </View>
    )
  }, [isLoading, colors, styles])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <Text style={styles.headerTitle}>Profile</Text>
          </NavbarIsland>
        }
        rightContent={
          <TouchableOpacity
            onPress={() => router.push('/account-settings')}
            style={{ padding: 4 }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={workouts}
          renderItem={renderWorkoutItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.profileHeader}>
              {/* Profile Section with Avatar and Info */}
              <View style={styles.profileSection}>
                {/* Avatar and Name Row */}
                <View style={styles.profileTop}>
                  {/* Avatar */}
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={42} color={colors.white} />
                    </View>
                  )}

                  {/* Name */}
                  <View style={styles.nameContainer}>
                    <View style={styles.nameRow}>
                      <Text style={styles.displayName}>
                        {profile?.display_name || 'User'}
                      </Text>
                      {userLevel && (
                        <LevelBadge
                          level={userLevel}
                          size="small"
                          style={styles.levelBadge}
                        />
                      )}
                    </View>
                    {profile?.user_tag && (
                      <Text style={styles.userTag}>@{profile.user_tag}</Text>
                    )}
                  </View>
                </View>

                {/* Stats Row - Below Avatar */}
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statNumber}>{workoutCount}</Text>
                    <Text style={styles.statLabel}>Workouts</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stat}
                    onPress={() => {
                      if (user?.id) {
                        router.push({
                          pathname: '/followers/[userId]',
                          params: { userId: user.id },
                        })
                      }
                    }}
                  >
                    <Text style={styles.statNumber}>{followerCount}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stat}
                    onPress={() => {
                      if (user?.id) {
                        router.push({
                          pathname: '/following/[userId]',
                          params: { userId: user.id },
                        })
                      }
                    }}
                  >
                    <Text style={styles.statNumber}>{followingCount}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </TouchableOpacity>
                </View>

                {/* Profile Description */}
                {profile?.profile_description ? (
                  <Text
                    style={styles.profileDescription}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    {profile.profile_description}
                  </Text>
                ) : null}

                {/* Edit Profile Button */}
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push('/edit-profile')}
                >
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>

              {/* Routines Section */}
              {user && <ProfileRoutines userId={user.id} />}

              {/* This Week Stats Section */}
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>CALENDAR</Text>
              </View>
              <TouchableOpacity
                style={styles.weeklyStatsSection}
                onPress={() => router.push('/workout-calendar')}
                activeOpacity={0.7}
              >
                <View style={styles.weeklyStatsHeader}>
                  <Text style={styles.weeklyStatsTitle}>THIS WEEK</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>

                <View style={styles.weeklyStats}>
                  <View style={styles.weeklyStat}>
                    <Text style={styles.weeklyStatNumber}>{currentStreak}</Text>
                    <Text style={styles.weeklyStatLabel}>Streak</Text>
                  </View>
                  <View style={styles.weeklyStatDivider} />
                  <View style={styles.weeklyStat}>
                    <Text style={styles.weeklyStatNumber}>
                      {weeklyWorkouts}
                    </Text>
                    <Text style={styles.weeklyStatLabel}>Workouts</Text>
                  </View>
                  <View style={styles.weeklyStatDivider} />
                  <View style={styles.weeklyStat}>
                    <Text style={styles.weeklyStatNumber}>
                      {(weightUnit === 'lb'
                        ? (weeklyVolume * 2.20462) / 1000
                        : weeklyVolume / 1000
                      ).toFixed(1)}
                      k
                    </Text>
                    <Text style={styles.weeklyStatLabel}>
                      Volume ({weightUnit})
                    </Text>
                  </View>
                </View>

                <View style={styles.weekDaysRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                    const isToday = new Date().getDay() === index
                    return (
                      <View key={index} style={styles.dayColumn}>
                        <View
                          style={[
                            styles.activityDot,
                            weeklyActivity[index] && styles.activityDotActive,
                            !weeklyActivity[index] &&
                              isToday &&
                              styles.activityDotToday,
                          ]}
                        />
                        <Text
                          style={[
                            styles.dayLabel,
                            (isToday || weeklyActivity[index]) &&
                              styles.dayLabelActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </TouchableOpacity>

              {/* Workouts Header */}
              <View style={styles.workoutsHeader}>
                <Text style={styles.workoutsTitle}>RECENT ACTIVITY</Text>
              </View>
            </View>
          }
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    feedContent: {
      flexGrow: 1,
      paddingTop: 0,
      paddingBottom: 2,
    },
    profileHeader: {
      backgroundColor: colors.feedCardBackground,
    },
    profileSection: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 20,
    },
    profileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nameContainer: {
      marginLeft: 16,
      justifyContent: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    levelBadge: {
      transform: [{ scale: 0.85 }],
    },
    displayName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    userTag: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 16,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    statNumber: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    profileDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    editButton: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingVertical: 7,
      alignItems: 'center',
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    calendarHeader: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    calendarTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    weeklyStatsSection: {
      backgroundColor: colors.backgroundLight,
      marginHorizontal: 20,
      marginBottom: 0,
      borderRadius: 12,
      padding: 16,
    },
    weeklyStatsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    weeklyStatsTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    weeklyStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    weeklyStat: {
      flex: 1,
    },
    weeklyStatNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    weeklyStatLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    weeklyStatDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    weekDaysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    dayColumn: {
      alignItems: 'center',
      gap: 6,
    },
    activityDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.border,
    },
    activityDotActive: {
      backgroundColor: colors.primary,
    },
    activityDotToday: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    dayLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    dayLabelActive: {
      color: colors.text,
      fontWeight: '700',
    },
    workoutsHeader: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 12,
      backgroundColor: colors.feedCardBackground,
      zIndex: 10,
    },
    workoutsTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    divider: {
      height: 4,
      backgroundColor: colors.background,
    },
    loadingMoreContainer: {
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      paddingTop: 60,
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })
