import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { EmptyState } from '@/components/EmptyState'
import { LevelBadge } from '@/components/LevelBadge'
import { ProfileDashboard } from '@/components/Profile/ProfileDashboard'
import { WeeklyStatsCard } from '@/components/Profile/WeeklyStatsCard'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useUserLevel } from '@/hooks/useUserLevel'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import {
    calculateTotalVolume,
    calculateWorkoutStats,
    formatVolume,
} from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Helper function to determine badge size based on text fontSize
const getBadgeSizeFromFontSize = (
  fontSize: number,
): 'small' | 'medium' | 'large' | 'xl' => {
  if (fontSize >= 20) return 'large'
  if (fontSize >= 15) return 'medium'
  return 'small'
}

export default function ProfileScreen() {
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const { registerScrollRef } = useScrollToTop()
  const flatListRef = useRef<FlatList>(null)
  const { level: userLevel } = useUserLevel(user?.id)
  const insets = useSafeAreaInsets()
  // const params = useLocalSearchParams() // Removed redundant param check
  // const [showPaywall, setShowPaywall] = useState(false)
  // const [isPaywallForced, setIsPaywallForced] = useState(false)

  // useEffect(() => {
  //   if (params.showPaywall === 'true') {
  //     const timer = setTimeout(() => {
  //       setShowPaywall(true)
  //       setIsPaywallForced(true)
  //     }, 400)
  //     return () => clearTimeout(timer)
  //   }
  // }, [params.showPaywall])

  const scrollY = useRef(new Animated.Value(0)).current
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])
  const [profile, setProfile] = useState<any>(null)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [workoutCount, setWorkoutCount] = useState(0)
  const [latestWeight, setLatestWeight] = useState<number | null>(null)
  const [activeRoutineName, setActiveRoutineName] = useState<string | null>(
    null,
  )

  // Workouts feed
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  )
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('grid')

  // Track if initial load has completed - prevents showing spinner on subsequent focuses
  const hasLoadedOnce = useRef(false)

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
        bodyLogResult,
        routinesData,
      ] = await Promise.all([
        database.follows.getCounts(user.id),
        database.workoutSessions.getTotalCount(user.id),
        database.workoutSessions.getThisWeekCount(user.id, startOfWeek),
        database.stats.calculateStreak(user.id),
        database.bodyLog.getEntriesPage(user.id, 0, 1),
        database.workoutRoutines.getAll(user.id),
      ])

      setFollowerCount(counts.followers)
      setFollowingCount(counts.following)
      setWorkoutCount(totalWorkouts)
      setWeeklyWorkouts(weekCount)
      setCurrentStreak(streakResult.currentStreak)

      // Set latest weight
      if (bodyLogResult.entries && bodyLogResult.entries.length > 0) {
        setLatestWeight(bodyLogResult.entries[0].weight_kg)
      }

      // Set active routine
      const activeRoutines = routinesData.filter((r) => !r.is_archived)
      if (activeRoutines.length > 0) {
        setActiveRoutineName(activeRoutines[0].name)
      }

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
      trackEvent(AnalyticsEvents.PROFILE_VIEWED, {
        is_self: true,
      })
      // Only show loading spinner on first load, silent refresh after
      const showLoading = !hasLoadedOnce.current
      loadProfileData()
      loadWorkouts(showLoading).then(() => {
        hasLoadedOnce.current = true
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackEvent]),
  )

  const renderWorkoutItem = useCallback(
    ({
      item: workout,
      index,
    }: {
      item: WorkoutSessionWithDetails
      index: number
    }) => {
      if (viewMode === 'grid') {
        const stats = calculateWorkoutStats(workout, weightUnit)
        return (
          <TouchableOpacity
            style={styles.gridItem}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/workout/[workoutId]',
                params: { workoutId: workout.id },
              })
            }
          >
            {workout.image_url ? (
              <>
                <Image
                  source={{ uri: workout.image_url }}
                  style={styles.gridItemImage}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.5)']}
                  style={styles.gridItemGradient}
                />
              </>
            ) : (
              <View style={styles.gridItemPlaceholder}>
                <Ionicons
                  name="barbell-outline"
                  size={28}
                  color={colors.textSecondary}
                  style={{ opacity: 0.5 }}
                />
              </View>
            )}
            <View style={styles.gridItemInfo}>
              <Text
                style={[
                  styles.gridItemTitle,
                  !workout.image_url && { color: colors.text },
                ]}
                numberOfLines={1}
              >
                {workout.type || workout.notes?.split('\n')[0] || 'Workout'}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text
                  style={[
                    styles.gridItemDate,
                    !workout.image_url && { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {workout.routine?.name ? (
                    <Text style={{ fontWeight: '400', fontSize: 9 }}>
                      fin. {workout.routine.name}
                    </Text>
                  ) : (
                    new Date(workout.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  )}
                </Text>
                <Text
                  style={[
                    styles.gridItemSeparator,
                    !workout.image_url && { color: colors.textSecondary },
                  ]}
                >
                  •
                </Text>
                <Text
                  style={[
                    styles.gridItemVolume,
                    !workout.image_url && { color: colors.textSecondary },
                  ]}
                >
                  {formatVolume(stats.totalVolume, weightUnit).value}{' '}
                  {weightUnit}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      }

      return (
        <AnimatedFeedCard
          key={workout.id}
          workout={workout}
          index={index}
          isNew={false}
          isDeleting={workout.id === deletingWorkoutId}
          isFirst={index === 0}
          onDelete={() => {
            if (workout.id === deletingWorkoutId) {
              setWorkouts((prev) => prev.filter((w) => w.id !== workout.id))
              setDeletingWorkoutId(null)
            } else {
              setDeletingWorkoutId(workout.id)
            }
          }}
        />
      )
    },
    [viewMode, weightUnit, deletingWorkoutId, styles, colors, router],
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
      <EmptyState
        icon="fitness-outline"
        title="No workouts yet"
        description="Start logging your training to track progress and see your stats here."
        buttonText="Log Your First Workout"
        onPress={() => router.push('/(tabs)/create-post')}
      />
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable
  }, [isLoading, colors, styles])

  const navbarBgColor = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: ['transparent', colors.background],
    extrapolate: 'clamp',
  })

  const whiteOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const themedOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  // Theme-aware starting color for navbar elements over the image
  const startColor = isDark ? '#F5F5F5' : colors.text

  // Animation interpolations for the cover photo
  const coverTranslateY = scrollY.interpolate({
    inputRange: [-400, 0, 400],
    outputRange: [-400, 0, 200], // Pin to top on pull-down, parallax on scroll-up
    extrapolateRight: 'clamp',
  })

  const coverScale = scrollY.interpolate({
    inputRange: [-400, 0],
    outputRange: [1.3, 1],
    extrapolate: 'clamp',
  })

  const coverOpacity = scrollY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.7],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.navbarContainer,
          {
            paddingTop: insets.top,
            backgroundColor: navbarBgColor,
            borderBottomWidth: 0,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <BaseNavbar
          leftContent={
            <NavbarIsland style={styles.navbarIsland}>
              <Animated.Text
                style={[
                  styles.headerTitle,
                  { color: startColor, opacity: whiteOpacity },
                ]}
              >
                Profile
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.headerTitle,
                  {
                    color: colors.text,
                    opacity: themedOpacity,
                    position: 'absolute',
                  },
                ]}
              >
                Profile
              </Animated.Text>
            </NavbarIsland>
          }
          rightContent={
            <TouchableOpacity
              onPress={() => router.push('/account-settings')}
              style={styles.navbarRightButton}
            >
              <View style={styles.iconWrapper}>
                <Animated.View style={{ opacity: whiteOpacity }}>
                  <Ionicons name="settings" size={24} color={startColor} />
                </Animated.View>
                <Animated.View
                  style={{ opacity: themedOpacity, position: 'absolute' }}
                >
                  <Ionicons
                    name="settings-outline"
                    size={24}
                    color={colors.text}
                  />
                </Animated.View>
              </View>
            </TouchableOpacity>
          }
        />
      </Animated.View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={workouts}
          renderItem={renderWorkoutItem}
          ItemSeparatorComponent={() =>
            viewMode === 'feed' ? (
              <View
                style={{
                  height: 8,
                  backgroundColor: colors.feedCardSeparator,
                }}
              />
            ) : null
          }
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.profileHeader}>
              {/* Cover Photo Section */}
              <Animated.View 
                style={[
                  styles.coverContainer,
                  {
                    transform: [
                      { translateY: coverTranslateY },
                      { scale: coverScale }
                    ],
                    opacity: coverOpacity
                  }
                ]}
              >
                {profile?.avatar_url ? (
                  <Animated.Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.coverImage}
                    blurRadius={1} // Even tinier blur
                  />
                ) : (
                  <View style={[styles.coverImage, styles.coverPlaceholder]} />
                )}
                {/* Uniform overlay */}
                <View
                  style={[
                    styles.coverGradient,
                    {
                      backgroundColor: isDark
                        ? 'rgba(0,0,0,0.7)'
                        : 'rgba(255,255,255,0.65)',
                    },
                  ]}
                />
                {/* Bottom fade to background */}
                <LinearGradient
                  colors={[
                    isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)',
                    isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                    colors.background,
                  ]}
                  locations={[0, 0.6, 1]}
                  style={styles.coverBottomGradient}
                />
              </Animated.View>

              {/* Profile Section with Avatar and Info */}
              <View style={styles.profileSection}>
                {/* Avatar and Name Row */}
                <View style={styles.profileTop}>
                  {/* Avatar */}
                  <TouchableOpacity
                    onPress={() => router.push('/edit-profile')}
                    style={styles.avatarWrapper}
                  >
                    {profile?.avatar_url ? (
                      <Image
                        source={{ uri: profile.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Ionicons
                          name="person"
                          size={42}
                          color={colors.white}
                        />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Name and Stats */}
                  <View style={styles.nameContainer}>
                    <TouchableOpacity
                      onPress={() => router.push('/edit-profile')}
                    >
                      <View style={styles.nameRow}>
                        <Text style={styles.displayName}>
                          {profile?.display_name || 'User'}
                        </Text>
                        {userLevel && (
                          <LevelBadge
                            level={userLevel}
                            size={getBadgeSizeFromFontSize(
                              styles.displayName.fontSize,
                            )}
                            style={styles.levelBadge}
                            iconOnly={true}
                          />
                        )}
                      </View>
                      {profile?.user_tag && (
                        <Text style={styles.userTag}>@{profile.user_tag}</Text>
                      )}
                    </TouchableOpacity>

                    {/* Stats Row - Compact inline style */}
                    <View style={styles.statsRow}>
                      <View style={styles.stat}>
                        <Text style={styles.statNumber}>{workoutCount}</Text>
                        <Text style={styles.statLabel}>workouts</Text>
                      </View>
                      <View style={styles.statSeparator} />
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
                        <Text style={styles.statLabel}>followers</Text>
                      </TouchableOpacity>
                      <View style={styles.statSeparator} />
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
                        <Text style={styles.statLabel}>following</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
              </View>

              {/* Dashboard Carousel Section */}
              <ProfileDashboard
                activeRoutineName={activeRoutineName}
                latestWeight={latestWeight}
              />

              <WeeklyStatsCard
                streak={currentStreak}
                workouts={weeklyWorkouts}
                volume={weeklyVolume}
                weightUnit={weightUnit}
                activity={weeklyActivity}
                onPress={() => router.push('/workout-calendar')}
              />

              {/* Workouts Header */}
              <View style={styles.workoutsHeader}>
                <Text style={styles.workoutsTitle}>Recent Activity</Text>
                <View style={styles.viewToggle}>
                  <TouchableOpacity
                    onPress={() => setViewMode('feed')}
                    style={[
                      styles.toggleButton,
                      viewMode === 'feed' && styles.toggleButtonActive,
                    ]}
                  >
                    <Ionicons
                      name="reorder-four-outline"
                      size={20}
                      color={
                        viewMode === 'feed'
                          ? colors.white
                          : colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setViewMode('grid')}
                    style={[
                      styles.toggleButton,
                      viewMode === 'grid' && styles.toggleButtonActive,
                    ]}
                  >
                    <Ionicons
                      name="apps-outline"
                      size={18}
                      color={
                        viewMode === 'grid'
                          ? colors.white
                          : colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          }
          key={viewMode}
          numColumns={viewMode === 'grid' ? 3 : 1}
          contentContainerStyle={[
            styles.feedContent,
            viewMode === 'grid' && styles.gridContent,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        />
      )}
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navbarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    navbarRightButton: {
      padding: 8,
      marginRight: -4,
    },
    navbarIsland: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconWrapper: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    feedContent: {
      flexGrow: 1,
      paddingTop: 0,
      paddingBottom: 90,
    },
    profileHeader: {
      backgroundColor: colors.background,
      position: 'relative',
      minHeight: 280,
    },
    coverContainer: {
      height: 300, // Reduced height as requested
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      overflow: 'visible',
      backgroundColor: isDark ? '#000' : '#fff',
    },
    coverImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
      opacity: isDark ? 0.7 : 0.9,
    },
    coverPlaceholder: {
      backgroundColor: colors.primary + '20',
    },
    coverGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '100%',
    },
    coverBottomGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '35%', // Adjusted for shorter image
    },
    profileSection: {
      paddingHorizontal: 14,
      paddingTop: 150,
      paddingBottom: 12, // More compact gap to next section
    },
    profileTop: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 16,
    },
    avatarWrapper: {
      borderRadius: 50,
      padding: 3,
      backgroundColor: colors.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nameContainer: {
      flex: 1, // Allow name container to take remaining space
      marginLeft: 16,
      justifyContent: 'flex-end',
      paddingBottom: 4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1, // Prevent name from pushing everything off screen
    },
    levelBadge: {
      transform: [{ scale: 0.9 }],
    },
    displayName: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 0,
      flexShrink: 1,
    },
    userTag: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: -2,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      flexWrap: 'wrap',
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    statSeparator: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.textSecondary,
      marginHorizontal: 10,
      opacity: 0.4,
    },
    statNumber: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
      textTransform: 'lowercase',
    },
    profileDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    tutorialSection: {
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    dashboardSection: {
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    dashboardCards: {
      flexDirection: 'row',
      gap: 16,
    },
    dashboardCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      height: 160,
      justifyContent: 'space-between',
      // Add shadow for contrast
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    cardLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    cardValue: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    plusButton: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    workoutsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    workoutsTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
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
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    viewToggle: {
      flexDirection: 'row',
      backgroundColor: colors.feedCardBackground,
      borderRadius: 8,
      padding: 2,
      gap: 2,
    },
    toggleButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    gridContent: {
      paddingHorizontal: 1, // Space for grid gaps
    },
    gridItem: {
      flex: 1,
      maxWidth: '33.33%',
      aspectRatio: 1,
      margin: 1,
      backgroundColor: colors.feedCardBackground,
      overflow: 'hidden',
    },
    gridItemImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
    },
    gridItemPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
    gridItemGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '50%',
    },
    gridItemInfo: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: 6,
      justifyContent: 'flex-end',
    },
    gridItemTitle: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 0,
    },
    gridItemDate: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '500',
      opacity: 0.9,
    },
    gridItemSeparator: {
      color: '#fff',
      fontSize: 9,
      opacity: 0.5,
    },
    gridItemVolume: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '500',
      opacity: 0.9,
    },
  })
