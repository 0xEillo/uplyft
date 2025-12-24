import { AsyncPrFeedCard } from '@/components/async-pr-feed-card'
import { BaseNavbar } from '@/components/base-navbar'
import { EmptyState } from '@/components/EmptyState'
import { LevelBadge } from '@/components/LevelBadge'
import { ProfileRoutines } from '@/components/Profile/ProfileRoutines'
import { WeeklyStatsCard } from '@/components/Profile/WeeklyStatsCard'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useUserLevel } from '@/hooks/useUserLevel'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database, PrivacyError } from '@/lib/database'
import { calculateTotalVolume, formatVolume } from '@/lib/utils/workout-stats'
import {
    FollowRelationshipStatus,
    WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

// Helper function to determine badge size based on text fontSize
const getBadgeSizeFromFontSize = (
  fontSize: number,
): 'small' | 'medium' | 'large' | 'xl' => {
  if (fontSize >= 20) return 'large'
  if (fontSize >= 15) return 'medium'
  return 'small'
}

let skipNextProfileEntryAnimation = false

const markProfileEntrySkipFlag = () => {
  skipNextProfileEntryAnimation = true
}

const consumeProfileEntrySkipFlag = () => {
  const shouldSkip = skipNextProfileEntryAnimation
  skipNextProfileEntryAnimation = false
  return shouldSkip
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { user, isAnonymous } = useAuth()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('grid')
  const insets = useSafeAreaInsets()
  const { level: userLevel } = useUserLevel(userId)

  const scrollY = useRef(new Animated.Value(0)).current
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userTag, setUserTag] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileDescription, setProfileDescription] = useState<string | null>(
    null,
  )
  const [privacyLocked, setPrivacyLocked] = useState(false)
  const [
    relationship,
    setRelationship,
  ] = useState<FollowRelationshipStatus | null>(null)
  const [relationshipBusy, setRelationshipBusy] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const shouldSkipNextEntryRef = useRef<boolean>(consumeProfileEntrySkipFlag())
  const isInitialFocusRef = useRef(true)
  const [shouldExit, setShouldExit] = useState(false)
  const [shouldAnimateEntry, setShouldAnimateEntry] = useState(
    !shouldSkipNextEntryRef.current,
  )
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0)
  const [weeklyVolume, setWeeklyVolume] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [weeklyActivity, setWeeklyActivity] = useState<boolean[]>(
    new Array(7).fill(false),
  )

  useEffect(() => {
    return () => {
      shouldSkipNextEntryRef.current = false
      isInitialFocusRef.current = true
    }
  }, [userId])

  const loadUserData = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    try {
      try {
        const profileData = await database.profiles.getById(userId)
        if (profileData) {
          setUserName(profileData.display_name)
          setUserTag(profileData.user_tag)
          setAvatarUrl(profileData.avatar_url)
          setProfileDescription(profileData.profile_description || null)
        } else {
          setUserName('User')
          setUserTag('')
          setAvatarUrl(null)
          setProfileDescription(null)
        }
      } catch (profileError) {
        console.error('Profile not found, using defaults:', profileError)
        setUserName('User')
        setUserTag('')
        setAvatarUrl(null)
        setProfileDescription(null)
      }

      try {
        // Calculate start of week (Sunday)
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const workoutData = await database.workoutSessions.getRecent(userId, 20)
        setWorkouts(workoutData)
        setPrivacyLocked(false)

        // Calculate weekly stats
        const weeklyWorkoutsList = workoutData.filter((w) => {
          const workoutDate = new Date(w.date)
          return workoutDate >= startOfWeek
        })

        const weekCount = weeklyWorkoutsList.length

        let totalVolume = 0
        const activity = new Array(7).fill(false)

        weeklyWorkoutsList.forEach((workout) => {
          totalVolume += calculateTotalVolume(workout, 'kg')
          const dayIndex = new Date(workout.date).getDay()
          activity[dayIndex] = true
        })

        setWeeklyWorkouts(weekCount)
        setWeeklyVolume(totalVolume)
        setWeeklyActivity(activity)

        // Calculate streak
        const streakResult = await database.stats.calculateStreak(userId)
        setCurrentStreak(streakResult.currentStreak)
      } catch (workoutError) {
        if (workoutError instanceof PrivacyError) {
          setPrivacyLocked(true)
          setWorkouts([])
          setWeeklyWorkouts(0)
          setWeeklyVolume(0)
          setCurrentStreak(0)
          setWeeklyActivity(new Array(7).fill(false))
        } else {
          throw workoutError
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const loadRelationship = useCallback(async () => {
    if (!user || !userId || user.id === userId) {
      setRelationship(null)
      return
    }

    try {
      const [status] = await database.relationships.getStatuses(user.id, [
        userId,
      ])
      setRelationship(status ?? null)
    } catch (error) {
      console.error('Error loading relationship status:', error)
    }
  }, [user, userId])

  const loadFollowCounts = useCallback(async () => {
    if (!userId) return

    try {
      const counts = await database.follows.getCounts(userId)
      setFollowerCount(counts.followers)
      setFollowingCount(counts.following)
    } catch (error) {
      console.error('Error loading follow counts:', error)
    }
  }, [userId])

  const handleFollowAction = useCallback(async () => {
    if (!user || !userId || relationshipBusy) return
    if (!relationship) return

    // Block social features for guest users
    if (isAnonymous) {
      router.push('/(auth)/create-account')
      return
    }

    try {
      setRelationshipBusy(true)
      if (relationship.is_following) {
        await database.follows.unfollow(user.id, userId)
        setRelationship((prev) =>
          prev
            ? {
                ...prev,
                is_following: false,
              }
            : prev,
        )
        // Reload follow counts after unfollowing
        await loadFollowCounts()
      } else {
        const result = await database.follows.follow(user.id, userId)
        if (
          result.status === 'following' ||
          result.status === 'already_following'
        ) {
          setRelationship((prev) =>
            prev
              ? {
                  ...prev,
                  is_following: true,
                  has_pending_request: false,
                  request_id: null,
                }
              : prev,
          )
          // Reload user data and follow counts after following
          await loadUserData()
          await loadFollowCounts()
        } else {
          setRelationship((prev) =>
            prev
              ? {
                  ...prev,
                  has_pending_request: true,
                  request_id: result.requestId ?? null,
                }
              : prev,
          )
        }
      }
    } catch (error) {
      console.error('Error updating follow state:', error)
      Alert.alert('Error', 'Unable to update follow status right now.')
    } finally {
      setRelationshipBusy(false)
    }
  }, [
    user,
    userId,
    relationship,
    relationshipBusy,
    loadUserData,
    loadFollowCounts,
    isAnonymous,
    router,
  ])

  useFocusEffect(
    useCallback(() => {
      loadUserData()
      loadRelationship()
      loadFollowCounts()
    }, [loadUserData, loadRelationship, loadFollowCounts]),
  )

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])
  const isOwnProfile = user?.id === userId

  useFocusEffect(
    useCallback(() => {
      if (shouldSkipNextEntryRef.current) {
        setShouldAnimateEntry(false)
        shouldSkipNextEntryRef.current = false
        isInitialFocusRef.current = false
      } else if (isInitialFocusRef.current) {
        setShouldAnimateEntry(true)
        isInitialFocusRef.current = false
      }
    }, [shouldSkipNextEntryRef]),
  )

  const markNextFocusAsChildReturn = useCallback(() => {
    markProfileEntrySkipFlag()
    shouldSkipNextEntryRef.current = true
  }, [shouldSkipNextEntryRef])

  const handleBack = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const renderFollowButton = () => {
    if (isOwnProfile) return null

    if (!user) {
      return (
        <TouchableOpacity
          style={[styles.followActionButton, styles.followActionButtonPending]}
          onPress={() => router.push('/(auth)/welcome')}
        >
          <Text
            style={[
              styles.followActionButtonText,
              styles.followActionButtonTextPending,
            ]}
          >
            Sign in to follow
          </Text>
        </TouchableOpacity>
      )
    }

    const isFollowing = relationship?.is_following ?? false
    const isPending = relationship?.has_pending_request ?? false
    const hasIncoming = relationship?.has_incoming_request ?? false
    const isPrivate = relationship?.is_private ?? false
    const label = hasIncoming
      ? 'Requested you'
      : isPending
      ? 'Pending'
      : isFollowing
      ? 'Following'
      : isPrivate
      ? 'Request to follow'
      : 'Follow'

    const buttonStyles = [
      styles.followActionButton,
      isFollowing && styles.followActionButtonFollowing,
      (isPending || hasIncoming) && styles.followActionButtonPending,
    ]

    const textStyles = [
      styles.followActionButtonText,
      isFollowing && styles.followActionButtonTextFollowing,
      (isPending || hasIncoming) && styles.followActionButtonTextPending,
    ]

    return (
      <TouchableOpacity
        style={buttonStyles}
        onPress={() => {
          if (hasIncoming) {
            markNextFocusAsChildReturn()
            router.push('/follow-requests')
            return
          }
          if (isPending) {
            return
          }
          handleFollowAction()
        }}
        disabled={relationshipBusy || isPending}
      >
        {relationshipBusy && !isFollowing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={textStyles}>{label}</Text>
        )}
      </TouchableOpacity>
    )
  }

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

  const startColor = isDark ? '#F5F5F5' : colors.text

  return (
    <SlideInView
      style={{ flex: 1 }}
      enabled={shouldAnimateEntry}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.navbarContainer,
            {
              paddingTop: insets.top,
              backgroundColor: navbarBgColor,
              borderBottomWidth: scrollY.interpolate({
                inputRange: [0, 100],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              borderBottomColor: colors.border,
            },
          ]}
        >
          <BaseNavbar
            leftContent={
              <View style={styles.navbarLeft}>
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.navbarBackAction}
                >
                  <View style={styles.iconWrapper}>
                    <Animated.View style={{ opacity: whiteOpacity }}>
                      <Ionicons
                        name="arrow-back"
                        size={24}
                        color={startColor}
                      />
                    </Animated.View>
                    <Animated.View
                      style={{ opacity: themedOpacity, position: 'absolute' }}
                    >
                      <Ionicons
                        name="arrow-back"
                        size={24}
                        color={colors.text}
                      />
                    </Animated.View>
                  </View>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>

        {/* Scrollable Content */}
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {/* Cover Photo Section */}
            <View style={styles.coverContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.coverImage} />
              ) : (
                <View style={[styles.coverImage, styles.coverPlaceholder]} />
              )}
              {/* Uniform overlay */}
              <View
                style={[
                  styles.coverGradient,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0,0,0,0.45)'
                      : 'rgba(255,255,255,0.55)',
                  },
                ]}
              />
              {/* Bottom fade to background */}
              <LinearGradient
                colors={[
                  isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)',
                  colors.background,
                ]}
                style={styles.coverBottomGradient}
              />
            </View>

            {/* Profile Section with Avatar and Info */}
            <View style={styles.profileSection}>
              {/* Avatar and Name Row */}
              <View style={styles.profileTop}>
                {/* Avatar */}
                <View style={styles.avatarWrapper}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={36} color={colors.white} />
                    </View>
                  )}
                </View>

                {/* Name and Stats */}
                <View style={styles.nameContainer}>
                  <View style={styles.nameRow}>
                    <Text style={styles.displayName}>{userName || 'User'}</Text>
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
                  {userTag && <Text style={styles.userTag}>@{userTag}</Text>}

                  {/* Stats Row - Compact inline style */}
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statNumber}>{workouts.length}</Text>
                      <Text style={styles.statLabel}>workouts</Text>
                    </View>
                    <View style={styles.statSeparator} />
                    <TouchableOpacity
                      style={styles.stat}
                      onPress={() =>
                        router.push({
                          pathname: '/followers/[userId]',
                          params: { userId, returnTo: `/user/${userId}` },
                        })
                      }
                    >
                      <Text style={styles.statNumber}>{followerCount}</Text>
                      <Text style={styles.statLabel}>followers</Text>
                    </TouchableOpacity>
                    <View style={styles.statSeparator} />
                    <TouchableOpacity
                      style={styles.stat}
                      onPress={() =>
                        router.push({
                          pathname: '/following/[userId]',
                          params: { userId, returnTo: `/user/${userId}` },
                        })
                      }
                    >
                      <Text style={styles.statNumber}>{followingCount}</Text>
                      <Text style={styles.statLabel}>following</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {profileDescription ? (
                <Text
                  style={styles.profileDescription}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {profileDescription}
                </Text>
              ) : null}

              {/* Follow Button */}
              {!isOwnProfile && !privacyLocked && (
                <View style={styles.followButtonContainer}>
                  {renderFollowButton()}
                </View>
              )}
            </View>

            {/* Routines Section */}
            {(!privacyLocked || isOwnProfile) && (
              <ProfileRoutines userId={userId} />
            )}

            {/* Weekly Stats Card */}
            {!privacyLocked && (
              <WeeklyStatsCard
                streak={currentStreak}
                workouts={weeklyWorkouts}
                volume={weeklyVolume}
                weightUnit={weightUnit}
                activity={weeklyActivity}
                onPress={() => {
                  // Navigate to workout calendar if needed
                }}
                showChevron={false}
              />
            )}

            {/* Workouts Header */}
            {!privacyLocked && (
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
            )}
          </View>
          {privacyLocked && !isOwnProfile ? (
            <View style={styles.lockedCard}>
              <Ionicons
                name="lock-closed-outline"
                size={48}
                color={colors.primary}
                style={styles.lockedIcon}
              />
              <Text style={styles.lockedTitle}>This athlete is private</Text>
              <Text style={styles.lockedMessage}>
                Request to follow to unlock their workouts and stats.
              </Text>
              {renderFollowButton()}
            </View>
          ) : viewMode === 'grid' ? (
            <View style={styles.gridContent}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : workouts.length === 0 ? (
                <EmptyState
                  icon="fitness-outline"
                  title="No workouts posted"
                  description="This user hasn't logged any public workouts yet."
                />
              ) : (
                <View style={styles.gridContainer}>
                  {workouts.map((workout) => (
                    <TouchableOpacity
                      key={workout.id}
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
                            style={{ opacity: 0.2 }}
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
                          {workout.type ||
                            workout.notes?.split('\n')[0] ||
                            'Workout'}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Text
                            style={[
                              styles.gridItemDate,
                              !workout.image_url && {
                                color: colors.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {workout.routine?.name ? (
                              <Text style={{ fontWeight: '400', fontSize: 9 }}>
                                fin. {workout.routine.name}
                              </Text>
                            ) : (
                              new Date(workout.date).toLocaleDateString(
                                undefined,
                                {
                                  month: 'short',
                                  day: 'numeric',
                                },
                              )
                            )}
                          </Text>
                          <Text
                            style={[
                              styles.gridItemSeparator,
                              !workout.image_url && {
                                color: colors.textSecondary,
                              },
                            ]}
                          >
                            •
                          </Text>
                          <Text
                            style={[
                              styles.gridItemVolume,
                              !workout.image_url && {
                                color: colors.textSecondary,
                              },
                            ]}
                          >
                            {
                              formatVolume(
                                calculateTotalVolume(workout),
                                weightUnit,
                              ).value
                            }{' '}
                            {weightUnit}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.logContent}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : workouts.length === 0 ? (
                <EmptyState
                  icon="fitness-outline"
                  title="No workouts posted"
                  description="This user hasn't logged any public workouts yet."
                />
              ) : (
                workouts.map((workout, index) => (
                  <AsyncPrFeedCard
                    key={workout.id}
                    workout={workout}
                    onDelete={() => {
                      setWorkouts((prev) =>
                        prev.filter((w) => w.id !== workout.id),
                      )
                    }}
                    isFirst={index === 0}
                  />
                ))
              )}
            </View>
          )}
        </Animated.ScrollView>
      </View>
    </SlideInView>
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
    navbarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    navbarBackAction: {
      padding: 8,
      marginLeft: -8, // Adjusted to compensate for BaseNavbar's paddingHorizontal: 20
      marginRight: 4,
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
      fontSize: 22,
      fontWeight: '700',
    },
    profileHeader: {
      backgroundColor: colors.background,
      position: 'relative',
    },
    coverContainer: {
      height: 300,
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      overflow: 'hidden',
      backgroundColor: isDark ? '#000' : '#fff',
    },
    coverImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
      opacity: 0.85,
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
      height: '25%',
    },
    profileSection: {
      paddingHorizontal: 20,
      paddingTop: 150,
      paddingBottom: 12,
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
      flex: 1,
      marginLeft: 16,
      justifyContent: 'flex-end',
      paddingBottom: 4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
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
    followButtonContainer: {
      marginTop: 8,
    },
    workoutsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    workoutsTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    followActionButton: {
      width: '100%',
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 6,
      paddingVertical: 10,
      alignItems: 'center',
    },
    followActionButtonFollowing: {
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    followActionButtonPending: {
      backgroundColor: colors.backgroundLight,
      borderColor: colors.border,
    },
    followActionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    followActionButtonTextFollowing: {
      color: colors.text,
    },
    followActionButtonTextPending: {
      color: colors.textSecondary,
    },
    lockedCard: {
      margin: 20,
      padding: 32,
      borderRadius: 16,
      backgroundColor: colors.feedCardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    lockedIcon: {
      marginBottom: 16,
    },
    lockedTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    lockedMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
      paddingHorizontal: 8,
    },
    scrollView: {
      flex: 1,
    },
    logContent: {
      paddingTop: 0,
    },
    loadingContainer: {
      paddingVertical: 64,
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingHorizontal: 1,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    gridItem: {
      width: (width - 8) / 3,
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
      backgroundColor: colors.feedCardBackground,
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
