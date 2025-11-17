import { FeedCard } from '@/components/feed-card'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database, PrivacyError } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import {
  FollowRelationshipStatus,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()
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
        const weekCount = workoutData.filter((w) => {
          const workoutDate = new Date(w.date)
          return workoutDate >= startOfWeek
        }).length

        let totalVolume = 0
        workoutData.forEach((workout) => {
          const workoutDate = new Date(workout.date)
          if (workoutDate >= startOfWeek) {
            workout.workout_exercises?.forEach((exercise) => {
              exercise.sets?.forEach((set) => {
                if (set.weight && set.reps) {
                  totalVolume += set.weight * set.reps
                }
              })
            })
          }
        })

        setWeeklyWorkouts(weekCount)
        setWeeklyVolume(totalVolume)
      } catch (workoutError) {
        if (workoutError instanceof PrivacyError) {
          setPrivacyLocked(true)
          setWorkouts([])
          setWeeklyWorkouts(0)
          setWeeklyVolume(0)
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
  ])

  useFocusEffect(
    useCallback(() => {
      loadUserData()
      loadRelationship()
      loadFollowCounts()
    }, [loadUserData, loadRelationship, loadFollowCounts]),
  )

  const styles = createStyles(colors)
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

  return (
    <SlideInView
      style={{ flex: 1 }}
      enabled={shouldAnimateEntry}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Status bar background */}
        <View style={[styles.statusBarBackground, { height: insets.top }]} />
        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {/* Back Button */}
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            {/* Profile Section with Avatar and Info */}
            <View style={styles.profileSection}>
              {/* Avatar and Name Row */}
              <View style={styles.profileTop}>
                {/* Avatar */}
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={36} color={colors.white} />
                  </View>
                )}

                {/* Name */}
                <View style={styles.nameContainer}>
                  <Text style={styles.displayName}>{userName || 'User'}</Text>
                  {userTag && <Text style={styles.userTag}>@{userTag}</Text>}
                </View>
              </View>

              {/* Stats Row - Below Avatar */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{workouts.length}</Text>
                  <Text style={styles.statLabel}>Workouts</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{followerCount}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{followingCount}</Text>
                  <Text style={styles.statLabel}>Following</Text>
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

            {/* This Week Stats Section */}
            <View style={styles.weeklyStatsSection}>
              <View style={styles.weeklyStatsHeader}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.text}
                />
                <Text style={styles.weeklyStatsTitle}>This Week</Text>
              </View>
              <View style={styles.weeklyStats}>
                <View style={styles.weeklyStat}>
                  <Text style={styles.weeklyStatNumber}>{weeklyWorkouts}</Text>
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
            </View>

            {/* Workouts Divider */}
            <View style={styles.divider} />
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
          ) : (
            <>
              {/* Workout Posts */}
              <View style={styles.logContent}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : workouts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="barbell-outline"
                      size={64}
                      color={colors.textPlaceholder}
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
                      onNavigateAway={markNextFocusAsChildReturn}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SlideInView>
  )
}

function AsyncPrFeedCard({
  workout,
  userId,
  userName,
  avatarUrl,
  onNavigateAway,
}: {
  workout: WorkoutSessionWithDetails
  userId: string
  userName: string
  avatarUrl: string | null
  onNavigateAway?: () => void
}) {
  const { user } = useAuth()
  const [prs, setPrs] = useState<number>(0)
  const [prInfo, setPrInfo] = useState<any[]>([])
  const [isComputed, setIsComputed] = useState(false)
  const { weightUnit } = useWeightUnits()
  const router = useRouter()
  const pathname = usePathname()

  // Social interaction states
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)

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

      // Build PR info for the feed card
      const prData = result.perExercise.map((exPr) => ({
        exerciseName: exPr.exerciseName,
        prSetIndices: new Set(exPr.prs.flatMap((pr) => pr.setIndices || [])),
        prLabels: exPr.prs.map((pr) => pr.label),
        prDetails: exPr.prs.map((pr) => ({
          label: pr.label,
          weight: pr.weight,
          previousReps: pr.previousReps,
          currentReps: pr.currentReps,
          isCurrent: pr.isCurrent,
        })),
        hasCurrentPR: exPr.prs.some((pr) => pr.isCurrent),
      }))
      setPrInfo(prData)
      setIsComputed(true)
    } catch (error) {
      console.error('Error computing PRs:', error)
      setPrs(0)
      setPrInfo([])
    }
  }, [userId, workout, isComputed])

  // Fetch social stats
  React.useEffect(() => {
    if (!user || !workout.id) return

    const fetchSocialStats = async () => {
      try {
        const [
          likeCountResult,
          hasLikedResult,
          commentCountResult,
        ] = await Promise.all([
          database.workoutLikes.getCount(workout.id),
          database.workoutLikes.hasLiked(workout.id, user.id),
          database.workoutComments.getCount(workout.id),
        ])

        setLikeCount(likeCountResult)
        setIsLiked(hasLikedResult)
        setCommentCount(commentCountResult)
      } catch (error) {
        console.error('Error fetching social stats:', error)
      }
    }

    fetchSocialStats()
  }, [user, workout.id])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout, weightUnit)

  // Handle like toggle
  const handleLike = useCallback(async () => {
    if (!user || !workout.id) return

    try {
      if (isLiked) {
        await database.workoutLikes.unlike(workout.id, user.id)
        setIsLiked(false)
        setLikeCount((prev) => Math.max(0, prev - 1))
      } else {
        await database.workoutLikes.like(workout.id, user.id)
        setIsLiked(true)
        setLikeCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }, [user, workout.id, isLiked])

  // Handle comment - navigate to comments screen
  const handleComment = useCallback(() => {
    onNavigateAway?.()
    router.push(`/workout-comments/${workout.id}`)
  }, [workout.id, router, onNavigateAway])

  const handleCreateRoutine = useCallback(() => {
    onNavigateAway?.()
    router.push(`/create-routine?from=${workout.id}`)
  }, [workout.id, router, onNavigateAway])

  const handleCardPress = useCallback(() => {
    onNavigateAway?.()
    router.push({
      pathname: '/workout/[workoutId]',
      params: {
        workoutId: workout.id,
        returnTo: pathname,
      },
    })
  }, [workout.id, router, pathname, onNavigateAway])

  return (
    <FeedCard
      userName={userName}
      userAvatar={avatarUrl || ''}
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
        durationSeconds: workout.duration ?? undefined,
        volume:
          workout.workout_exercises?.reduce(
            (sum, we) =>
              sum +
              (we.sets?.reduce(
                (setSum, set) => setSum + (set.weight || 0) * (set.reps || 0),
                0,
              ) || 0),
            0,
          ) || 0,
      }}
      workout={workout}
      onCardPress={handleCardPress}
      onCreateRoutine={handleCreateRoutine}
      prInfo={prInfo}
      likeCount={likeCount}
      commentCount={commentCount}
      isLiked={isLiked}
      onLike={handleLike}
      onComment={handleComment}
    />
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    statusBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.white,
      zIndex: 0,
    },
    profileHeader: {
      backgroundColor: colors.white,
    },
    backButton: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    profileSection: {
      paddingHorizontal: 20,
      paddingTop: 12,
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
    profileDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 6,
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
    followButtonContainer: {
      marginTop: 0,
    },
    weeklyStatsSection: {
      backgroundColor: colors.backgroundLight,
      marginHorizontal: 20,
      marginBottom: 4,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    weeklyStatsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    weeklyStatsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    weeklyStats: {
      flexDirection: 'row',
      alignItems: 'center',
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
    divider: {
      height: 0,
      backgroundColor: colors.background,
    },
    followActionButton: {
      width: '100%',
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 6,
      paddingVertical: 7,
      alignItems: 'center',
    },
    followActionButtonFollowing: {
      backgroundColor: colors.white,
      borderColor: colors.border,
    },
    followActionButtonPending: {
      backgroundColor: colors.backgroundLight,
      borderColor: colors.border,
    },
    followActionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
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
      backgroundColor: colors.white,
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
    emptyState: {
      paddingVertical: 80,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 16,
    },
  })
