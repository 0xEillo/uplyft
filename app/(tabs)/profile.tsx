import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { FeedEmptyState } from '@/components/FeedEmptyState'
import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { ProfileDashboard } from '@/components/Profile/ProfileDashboard'
import { WeeklyStatsCard } from '@/components/Profile/WeeklyStatsCard'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import { useBottomAccessoryVisibility } from '@/contexts/bottom-accessory-visibility-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useUserLevel } from '@/hooks/useUserLevel'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { reuseUnchangedItems } from '@/lib/utils/reuse-unchanged-items'
import { calculateWorkoutStats, formatVolume } from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { FlashList, FlashListRef } from '@shopify/flash-list'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const workoutKeyExtractor = (item: WorkoutSessionWithDetails) => item.id

// Stable component type so FlashList doesn't remount separators every render.
const FeedSeparator = memo(function FeedSeparator() {
  const colors = useThemedColors()
  return <View style={{ height: 8, backgroundColor: colors.separator }} />
})

const getStartOfWeek = () => {
  // Start of week (Sunday), local time
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

export default function ProfileScreen() {
  const { user } = useAuth()
  const { profile: contextProfile } = useProfile()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const { registerScrollRef } = useScrollToTop()
  const bottomAccessoryVisibility = useBottomAccessoryVisibility()
  const flatListRef = useRef<FlashListRef<WorkoutSessionWithDetails>>(null)
  const { level: userLevel, score: userScore, scoreDelta } = useUserLevel(
    user?.id,
  )
  const [showLevelSheet, setShowLevelSheet] = useState(false)

  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y
      scrollY.setValue(y)
      bottomAccessoryVisibility?.reportScrollY(y)
    },
    [scrollY, bottomAccessoryVisibility],
  )
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])
  // Seeded from the already-loaded profile context so the header renders
  // immediately; refreshed from the server on focus.
  const [profile, setProfile] = useState<any>(contextProfile ?? null)
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
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed')

  // Track if initial load has completed - prevents showing spinner on subsequent focuses
  const hasLoadedOnce = useRef(false)

  // Register FlatList ref for scroll-to-top functionality
  useEffect(() => {
    registerScrollRef('profile', flatListRef)
  }, [registerScrollRef])

  // This week stats
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [weeklyActivity, setWeeklyActivity] = useState<boolean[]>(
    new Array(7).fill(false),
  )

  const loadProfileData = useCallback(async () => {
    if (!user) return

    try {
      const startOfWeek = getStartOfWeek()

      // One parallel wave. Previously the profile was fetched first, then the
      // stats, then the last 100 full workouts (every exercise and set) just
      // to work out which days this week had a workout.
      const [
        profileData,
        counts,
        totalWorkouts,
        weekDates,
        streakResult,
        latestRoutineName,
      ] = await Promise.all([
        database.profiles.getByIdOrNull(user.id),
        database.follows.getCounts(user.id),
        database.workoutSessions.getTotalCount(user.id),
        database.workoutSessions.getDatesSince(user.id, startOfWeek),
        database.stats.calculateStreak(user.id),
        database.workoutRoutines.getLatestActiveName(user.id),
      ])

      if (!profileData) {
        console.error('[Profile] Profile not found for user:', user.id)
        return
      }

      setProfile(profileData)
      setFollowerCount(counts.followers)
      setFollowingCount(counts.following)
      setWorkoutCount(totalWorkouts)
      setWeeklyWorkouts(weekDates.length)
      setCurrentStreak(streakResult.currentStreak)
      setLatestWeight(profileData.weight_kg ?? null)
      setActiveRoutineName(latestRoutineName)

      const activity = new Array(7).fill(false)
      weekDates.forEach((date) => {
        activity[new Date(date).getDay()] = true
      })
      setWeeklyActivity((prev) =>
        prev.every((value, index) => value === activity[index]) ? prev : activity,
      )
    } catch (error) {
      console.error('Error loading profile data:', error)
    }
  }, [user])

  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const isLoadingMoreRef = useRef(false)

  const loadWorkouts = useCallback(
    async (showLoading = false, loadMore = false) => {
      if (!user) return

      // Prevent concurrent load-more operations
      if (loadMore && isLoadingMoreRef.current) {
        return
      }

      try {
        if (loadMore) {
          isLoadingMoreRef.current = true
          setIsLoadingMore(true)
        } else if (showLoading) {
          setIsLoading(true)
        }

        const currentOffset = loadMore ? offsetRef.current : 0
        const limit = 10
        // Includes like/comment counts, so cards show real social stats and
        // skip the comment-preview request when a workout has no comments.
        const data = await database.workoutSessions.getProfileFeed(
          user.id,
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
          // Initial load or refresh. Keep unchanged workouts' object identity
          // so re-focusing the tab doesn't re-render every card.
          setWorkouts((prev) => reuseUnchangedItems(prev, data))
          setOffset(data.length)
          setHasMore(hasMoreWorkouts)
        }
      } catch (error) {
        console.error('Error loading workouts:', error)
      } finally {
        if (loadMore) isLoadingMoreRef.current = false
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [user],
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

  // Stable callback so memoized feed cards don't all re-render whenever the
  // screen does. Mirrors deletingWorkoutId in a ref to stay stable.
  const deletingWorkoutIdRef = useRef<string | null>(null)
  const handleDeleteWorkout = useCallback((workoutId: string) => {
    if (deletingWorkoutIdRef.current === workoutId) {
      deletingWorkoutIdRef.current = null
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId))
      setDeletingWorkoutId(null)
    } else {
      deletingWorkoutIdRef.current = workoutId
      setDeletingWorkoutId(workoutId)
    }
  }, [])

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
                  !workout.image_url && { color: colors.textPrimary },
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
          onDeleteWorkout={handleDeleteWorkout}
        />
      )
    },
    [
      viewMode,
      weightUnit,
      deletingWorkoutId,
      styles,
      colors,
      router,
      handleDeleteWorkout,
    ],
  )

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    )
  }, [isLoadingMore, colors.brandPrimary, styles])

  const renderEmptyState = useCallback(() => {
    if (isLoading) return null
    return <FeedEmptyState />
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable
  }, [isLoading, colors, styles])

  // Animation interpolations for the cover photo. Memoized: creating new
  // interpolation nodes every render re-attaches the animated styles.
  const coverAnimatedStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: scrollY.interpolate({
            inputRange: [-400, 0, 400],
            outputRange: [-400, 0, 200], // Pin to top on pull-down, parallax on scroll-up
            extrapolateRight: 'clamp',
          }),
        },
        {
          scale: scrollY.interpolate({
            inputRange: [-400, 0],
            outputRange: [1.3, 1],
            extrapolate: 'clamp',
          }),
        },
      ],
      opacity: scrollY.interpolate({
        inputRange: [0, 300],
        outputRange: [1, 0.7],
        extrapolate: 'clamp',
      }),
    }),
    [scrollY],
  )

  const openWorkoutCalendar = useCallback(
    () => router.push('/workout-calendar'),
    [router],
  )

  // Memoized: rebuilding this tree on every screen render (scroll-driven
  // state, load-more spinner, delete animation) was wasted work.
  const listHeader = useMemo(
    () => (
      <View style={styles.profileHeader}>
        {/* Cover Photo Section */}
        <Animated.View
          style={[styles.coverContainer, coverAnimatedStyle]}
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
              colors.bg,
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
                    color={colors.surface}
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
                    {profile?.display_name || (profile?.user_tag ? `@${profile.user_tag}` : 'User')}
                  </Text>
                  {userLevel && (
                    <LevelBadge
                      level={userLevel}
                      size="medium"
                      style={styles.levelBadge}
                      onPress={() => setShowLevelSheet(true)}
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* Stats Row - title above number, all on one line */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Workouts</Text>
                  <Text style={styles.statNumber}>{workoutCount}</Text>
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
                  <Text style={styles.statLabel}>Followers</Text>
                  <Text style={styles.statNumber}>{followerCount}</Text>
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
                  <Text style={styles.statLabel}>Following</Text>
                  <Text style={styles.statNumber}>{followingCount}</Text>
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
          activity={weeklyActivity}
          onPress={openWorkoutCalendar}
          showChevron={false}
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
                    ? colors.surface
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
                    ? colors.surface
                    : colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [
      styles,
      coverAnimatedStyle,
      profile,
      isDark,
      colors,
      router,
      userLevel,
      workoutCount,
      followerCount,
      followingCount,
      user?.id,
      activeRoutineName,
      latestWeight,
      currentStreak,
      weeklyWorkouts,
      weeklyActivity,
      openWorkoutCalendar,
      viewMode,
    ],
  )

  const renderSeparator = viewMode === 'feed' ? FeedSeparator : undefined
  const getItemType = useCallback(() => viewMode, [viewMode])
  const contentContainerStyle = useMemo(
    () => [styles.feedContent, viewMode === 'grid' && styles.gridContent],
    [styles, viewMode],
  )

  return (
    <View collapsable={false} style={styles.container}>
      <BlurredHeader style={styles.navbarContainer}>
        <BaseNavbar
          leftContent={
            <Text
              style={[styles.headerTitle, { marginLeft: 6 }]}
              numberOfLines={1}
            >
              {profile?.user_tag ? `@${profile.user_tag}` : 'Profile'}
            </Text>
          }
          rightContent={
            <NavbarIsland style={styles.actionsIsland}>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => router.push('/edit-profile')}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name="create-outline"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/account-settings')}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name="settings-outline"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>
            </NavbarIsland>
          }
        />
      </BlurredHeader>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlashList<WorkoutSessionWithDetails>
          ref={flatListRef}
          data={workouts}
          renderItem={renderWorkoutItem}
          getItemType={getItemType}
          ItemSeparatorComponent={renderSeparator}
          keyExtractor={workoutKeyExtractor}
          ListHeaderComponent={listHeader}
          key={viewMode}
          numColumns={viewMode === 'grid' ? 3 : 1}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}
      <LifterLevelsSheet
        isVisible={showLevelSheet}
        onClose={() => setShowLevelSheet(false)}
        currentLevel={userLevel || 'Beginner'}
        score={userScore}
        scoreDelta={scoreDelta}
      />
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
      backgroundColor: colors.bg,
    },
    navbarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    actionsIsland: {
      height: 44,
      borderRadius: 22,
      paddingHorizontal: 10,
      width: 'auto',
      minWidth: 0,
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
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
      color: colors.textPrimary,
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
      backgroundColor: colors.bg,
      position: 'relative',
      minHeight: 280,
    },
    coverContainer: {
      height: 260,
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
      backgroundColor: colors.brandPrimary + '20',
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
      paddingTop: 75,
      paddingBottom: 12,
    },
    profileTop: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
    },
    avatarPlaceholder: {
      backgroundColor: colors.brandPrimary,
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
      color: colors.textPrimary,
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
      marginTop: 4,
      flexWrap: 'nowrap',
    },
    stat: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      paddingHorizontal: 0,
    },
    statSeparator: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.textSecondary,
      marginHorizontal: 7,
      opacity: 0.4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '400',
      lineHeight: 14,
      paddingBottom: 0,
    },
    statNumber: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
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
      marginBottom: 8,
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
      backgroundColor: colors.bg,
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
      backgroundColor: colors.bg,
    },
    workoutsTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    divider: {
      height: 4,
      backgroundColor: colors.bg,
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
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.brandPrimary,
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
      backgroundColor: colors.surfaceCard,
      borderRadius: 12,
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
      backgroundColor: colors.brandPrimary,
    },
    gridContent: {
      paddingHorizontal: 1, // Space for grid gaps
    },
    gridItem: {
      width: '100%',
      aspectRatio: 1,
      margin: 1,
      backgroundColor: colors.surfaceCard,
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
      backgroundColor: colors.surfaceCard,
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
