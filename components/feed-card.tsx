import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { database } from '@/lib/database'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { memo, useEffect, useMemo, useRef, useState } from 'react'

import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { PrTooltip } from './pr-tooltip'
import { WorkoutShareScreen } from './workout-share-screen'

// Constants
const IMAGE_FADE_DURATION = 200 // Duration for thumbnail image fade-in
const FULLSCREEN_FADE_DURATION = 300 // Duration for fullscreen image fade-in

// Helper functions for compact formatting
const formatDurationCompact = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatVolumeCompact = (volumeKg: number, targetUnit: 'kg' | 'lb') => {
  if (targetUnit === 'lb') {
    const volumeLb = Math.round(volumeKg * 2.20462)
    return `${volumeLb.toLocaleString()} lb`
  }
  return `${Math.round(volumeKg).toLocaleString()} kg`
}

interface WorkoutStats {
  exercises: number
  sets: number
  prs: number // number of personal records achieved
  durationSeconds?: number
  volume?: number // in kg
}

interface SetDetail {
  reps: number | null
  weight: number | null
}

interface ExerciseDisplay {
  id: string // exercise ID for navigation
  name: string
  sets: number
  reps: string
  weight: string
  hasVariedSets: boolean
  setDetails?: SetDetail[]
}

interface PrDetailForDisplay {
  label: string // e.g., "1RM", "11 reps @ 65kg"
  weight: number // the weight for this PR
  previousReps?: number // previous max reps at this weight
  currentReps: number // current max reps at this weight
  isCurrent: boolean // true if this is still the all-time PR
}

export interface ExercisePRInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[] // Full PR details for tooltip
  hasCurrentPR: boolean // true if at least one PR is still current
}

export interface FeedCardProps {
  userName: string
  userAvatar: string
  timeAgo: string
  workoutTitle: string
  workoutDescription?: string | null
  workoutImageUrl?: string | null
  exercises: ExerciseDisplay[]
  stats: WorkoutStats
  userId?: string
  workoutId?: string
  workout?: WorkoutSessionWithDetails // Full workout object for sharing
  onUserPress?: () => void
  onCardPress?: () => void // Navigate to workout detail
  prInfo?: ExercisePRInfo[]
  isPending?: boolean // Flag to show skeleton while workout is being parsed
  isFirst?: boolean // Hide top border for first card
  // Social stats
  likeCount?: number
  commentCount?: number
  isLiked?: boolean
  onLike?: () => void
  onComment?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onCreateRoutine?: () => void
  routine?: { id: string; name: string } | null
  onRoutinePress?: () => void
}

/**
 * Feed card component for displaying workout sessions.
 * Memoized to prevent unnecessary re-renders when parent re-renders.
 */
export const FeedCard = memo(function FeedCard({
  userName,
  userAvatar,
  timeAgo,
  workoutTitle,
  workoutDescription,
  workoutImageUrl,
  exercises,
  stats,
  userId,
  workoutId,
  workout,
  onUserPress,
  onCardPress,
  prInfo = [],
  isPending = false,
  isFirst = false,
  likeCount = 0,
  commentCount = 0,
  isLiked = false,
  onLike,
  onComment,
  routine,
  onRoutinePress,
}: FeedCardProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { weightUnit } = useWeightUnits()
  const { shareWorkoutWidget } = useWorkoutShare()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  const displayRoutine = routine || workout?.routine

  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [
    selectedExercisePR,
    setSelectedExercisePR,
  ] = useState<ExercisePRInfo | null>(null)
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [infoHeight, setInfoHeight] = useState(0)
  const [workoutCountThisWeek, setWorkoutCountThisWeek] = useState(1)

  // Calculate carousel width (screen width - card padding * 2)
  // Card padding is 20 horizontal
  const cardPadding = 20
  const carouselWidth = windowWidth - cardPadding * 2
  // Max height for the image to prevent it from growing too large (infinity zoom effect)
  const MAX_IMAGE_HEIGHT = Math.min(windowHeight * 0.6, 500)

  const handleCarouselScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / carouselWidth)
    if (slide !== activeSlide) {
      setActiveSlide(slide)
    }
  }

  // Image loading states and animations
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(true)
  const imageOpacity = useRef(new Animated.Value(0)).current
  const fullscreenOpacity = useRef(new Animated.Value(0)).current

  // Skeleton shimmer animation for pending state
  const shimmerAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0)).current
  const exercisesFadeAnim = useRef(new Animated.Value(isPending ? 0 : 1))
    .current
  const [analyzingDots, setAnalyzingDots] = useState('')

  const styles = createStyles(colors, isDark)

  // Show more exercises if image exists to match height (up to 8), otherwise just 3
  const PREVIEW_LIMIT = workoutImageUrl ? 10 : 3
  const hasMoreExercises = exercises.length > PREVIEW_LIMIT
  const displayedExercises = exercises.slice(0, PREVIEW_LIMIT)

  // Shimmer animation for skeleton rows
  useEffect(() => {
    if (isPending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ).start()
    } else {
      shimmerAnim.setValue(0)
    }
  }, [isPending, shimmerAnim])

  // Pulse animation for analyzing badge
  useEffect(() => {
    if (isPending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ).start()
    } else {
      pulseAnim.setValue(0)
    }
  }, [isPending, pulseAnim])

  // Animated dots for "Analyzing..." text
  useEffect(() => {
    if (!isPending) {
      setAnalyzingDots('')
      return
    }

    const dots = ['', '.', '..', '...']
    let currentIndex = 0

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % dots.length
      setAnalyzingDots(dots[currentIndex])
    }, 500)

    return () => clearInterval(interval)
  }, [isPending])

  // Load workout count for the week
  useEffect(() => {
    if (!workout?.date || !userId || !workoutId) {
      return
    }

    const fetchCount = async () => {
      try {
        const count = await database.workoutSessions.getWeeklyWorkoutCount(
          userId,
          new Date(workout.date),
          workoutId,
        )
        setWorkoutCountThisWeek(count)
      } catch (error) {
        console.error('Error fetching workout count:', error)
      }
    }

    fetchCount()
  }, [workout?.date, workoutId, userId])

  // Fade in exercises when data loads
  useEffect(() => {
    if (!isPending && exercises.length > 0) {
      Animated.timing(exercisesFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    } else if (isPending) {
      exercisesFadeAnim.setValue(0)
    }
  }, [isPending, exercises.length, exercisesFadeAnim])

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  })

  const handleCloseShareScreen = () => {
    setShowShareScreen(false)
  }

  const handleShareWidget = async (
    widgetIndex: number,
    shareType: 'instagram' | 'general',
    widgetRef: View,
  ) => {
    await shareWorkoutWidget(widgetRef, shareType)
  }

  // Memoize info content to prevent unnecessary re-layouts
  const infoContent = useMemo(
    () => (
      <>
        {/* Stats Summary */}
        {!isPending && (
          <Pressable
            onPress={onCardPress}
            disabled={!onCardPress}
            style={styles.statsContainer}
          >
            {stats.durationSeconds !== undefined && stats.durationSeconds > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Duration</Text>
                <Text style={styles.statValue}>
                  {formatDurationCompact(stats.durationSeconds)}
                </Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Sets</Text>
              <Text style={styles.statValue}>{stats.sets}</Text>
            </View>
            {stats.volume !== undefined && stats.volume > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Volume</Text>
                <Text style={styles.statValue}>
                  {formatVolumeCompact(stats.volume, weightUnit)}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* Exercises List */}
        <Pressable
          onPress={onCardPress}
          disabled={!onCardPress || isPending}
          style={styles.exercisesContainer}
        >
          {/* Skeleton Rows (when pending) */}
          {isPending && (
            <>
              {[60, 80, 70].map((width, index) => (
                <View key={`skeleton-${index}`} style={styles.exerciseRow}>
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      styles.skeletonBarExercise,
                      { opacity: shimmerOpacity, width: `${width}%` },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      styles.skeletonBarSets,
                      { opacity: shimmerOpacity },
                    ]}
                  />
                </View>
              ))}
            </>
          )}

          {/* Real Exercise Rows (fade in when loaded) */}
          {!isPending && (
            <Animated.View style={{ opacity: exercisesFadeAnim }}>
              {displayedExercises.map((exercise, index) => {
                const exercisePR = prInfo.find(
                  (pr) => pr.exerciseName === exercise.name,
                )
                const hasPR = exercisePR && exercisePR.prSetIndices.size > 0

                return (
                  <View
                    key={index}
                    style={[
                      styles.exerciseRow,
                      index === displayedExercises.length - 1 &&
                        styles.lastExerciseRow,
                    ]}
                  >
                    <View style={styles.exerciseNameContainer}>
                      <Text style={styles.exerciseNameSimple} numberOfLines={1}>
                        {exercise.name}
                      </Text>
                      {hasPR && exercisePR && (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedExercisePR(exercisePR)
                            setTooltipVisible(true)
                          }}
                          activeOpacity={0.7}
                          style={[
                            styles.prBadge,
                            !exercisePR.hasCurrentPR &&
                              styles.prBadgeHistorical,
                          ]}
                        >
                          <Text style={styles.prBadgeText}>PR</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.setsText}>
                      {exercise.sets} {exercise.sets === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>
                )
              })}
              {hasMoreExercises && (
                <TouchableOpacity
                  onPress={onCardPress}
                  activeOpacity={0.7}
                  style={styles.seeMoreButton}
                >
                  <Text style={styles.seeMoreText}>
                    See {exercises.length - PREVIEW_LIMIT} more{' '}
                    {exercises.length - PREVIEW_LIMIT === 1
                      ? 'exercise'
                      : 'exercises'}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </Pressable>

        {/* Footer message for pending state */}
        {isPending && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Parsing your workout and identifying exercises...
            </Text>
          </View>
        )}
      </>
    ),
    [
      isPending,
      onCardPress,
      stats,
      shimmerOpacity,
      exercisesFadeAnim,
      displayedExercises,
      hasMoreExercises,
      prInfo,
      weightUnit,
      colors.primary,
      exercises.length,
      styles,
      PREVIEW_LIMIT,
    ],
  )

  return (
    <View style={[styles.card, isFirst && { borderTopWidth: 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={onUserPress}
          disabled={!onUserPress}
          activeOpacity={onUserPress ? 0.7 : 1}
        >
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName[0]}</Text>
            </View>
          )}
          <View>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{userName}</Text>
            </View>
            {displayRoutine ? (
              <View style={styles.routineContainer}>
                <Text style={styles.actionText}>finished </Text>
                <TouchableOpacity
                  onPress={onRoutinePress}
                  disabled={!onRoutinePress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.routineLink}>
                    {displayRoutine.name} ›
                  </Text>
                </TouchableOpacity>
                <Text style={styles.timeAgo}> • {timeAgo}</Text>
              </View>
            ) : (
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            )}
          </View>
        </TouchableOpacity>
        {isPending && (
          <Animated.View
            style={[styles.analyzingBadge, { opacity: pulseOpacity }]}
          >
            <Text style={styles.analyzingText}>Analyzing{analyzingDots}</Text>
          </Animated.View>
        )}
      </View>

      {/* Workout Title - Clickable to navigate to detail */}
      <Pressable
        onPress={onCardPress}
        disabled={!onCardPress || isPending}
        style={({ pressed }) => [
          styles.titleContainer,
          pressed && onCardPress && styles.titleContainerPressed,
        ]}
      >
        {workoutTitle && (
          <Text style={styles.workoutTitle}>{workoutTitle}</Text>
        )}
        {workoutDescription && (
          <Text style={styles.workoutDescription}>{workoutDescription}</Text>
        )}
      </Pressable>

      {/* Carousel or Info */}
      {workoutImageUrl ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleCarouselScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={carouselWidth}
            contentContainerStyle={{ width: carouselWidth * 2 }}
          >
            {/* Slide 1: Image */}
            <View style={{ width: carouselWidth }}>
              <TouchableOpacity
                style={[
                  styles.workoutImageContainer,
                  infoHeight > 0 && {
                    height: infoHeight,
                    aspectRatio: undefined,
                    maxHeight: undefined,
                  },
                ]}
                onPress={() => setImageModalVisible(true)}
                activeOpacity={0.9}
              >
                <Animated.Image
                  source={{ uri: workoutImageUrl }}
                  style={[styles.workoutImage, { opacity: imageOpacity }]}
                  resizeMode="cover"
                  onLoadStart={() => setImageLoading(true)}
                  onLoad={() => {
                    setImageLoading(false)
                    Animated.timing(imageOpacity, {
                      toValue: 1,
                      duration: IMAGE_FADE_DURATION,
                      useNativeDriver: true,
                    }).start()
                  }}
                  onError={(error) => {
                    console.error(
                      'Failed to load workout image:',
                      error.nativeEvent.error,
                    )
                    setImageLoading(false)
                  }}
                />
                {imageLoading && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Slide 2: Info */}
            <View
              style={{ width: carouselWidth }}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout
                // Update height if it differs by more than 2 pixels to avoid loops
                // Also cap at MAX_IMAGE_HEIGHT to prevent runaway growth
                if (Math.abs(height - infoHeight) > 2) {
                  const newHeight = Math.min(height, MAX_IMAGE_HEIGHT)
                  setInfoHeight(newHeight)
                }
              }}
            >
              {infoContent}
            </View>
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {[0, 1].map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activeSlide
                    ? { backgroundColor: colors.primary, width: 20 }
                    : { backgroundColor: colors.textSecondary, opacity: 0.3 },
                ]}
              />
            ))}
          </View>
        </View>
      ) : (
        <View>{infoContent}</View>
      )}

      {/* Social Actions Bar */}
      {!isPending && (
        <View style={styles.socialActionsBar}>
          {/* Like Button */}
          <TouchableOpacity
            style={styles.socialActionButton}
            onPress={onLike}
            disabled={!onLike}
          >
            <Ionicons
              name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={20}
              color={isLiked ? colors.primary : colors.textSecondary}
            />
            {likeCount > 0 && (
              <Text style={styles.socialActionCount}>{likeCount}</Text>
            )}
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity
            style={styles.socialActionButton}
            onPress={onComment}
            disabled={!onComment}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.textSecondary}
            />
            {commentCount > 0 && (
              <Text style={styles.socialActionCount}>{commentCount}</Text>
            )}
          </TouchableOpacity>

          {/* Share Button */}
          {workout && (
            <TouchableOpacity
              style={styles.socialActionButton}
              onPress={() => setShowShareScreen(true)}
            >
              <Ionicons
                name="share-outline"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Image Fullscreen Modal */}
      {workoutImageUrl && (
        <Modal
          visible={imageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <Pressable
            style={styles.imageModalOverlay}
            onPress={() => setImageModalVisible(false)}
          >
            <View style={styles.imageModalContent}>
              <Animated.Image
                source={{ uri: workoutImageUrl }}
                style={[styles.fullscreenImage, { opacity: fullscreenOpacity }]}
                resizeMode="contain"
                onLoadStart={() => setFullscreenImageLoading(true)}
                onLoad={() => {
                  setFullscreenImageLoading(false)
                  Animated.timing(fullscreenOpacity, {
                    toValue: 1,
                    duration: FULLSCREEN_FADE_DURATION,
                    useNativeDriver: true,
                  }).start()
                }}
                onError={(error) => {
                  console.error(
                    'Failed to load fullscreen image:',
                    error.nativeEvent.error,
                  )
                  setFullscreenImageLoading(false)
                }}
              />
              {fullscreenImageLoading && (
                <View style={styles.fullscreenLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.white} />
                </View>
              )}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* PR Tooltip */}
      {selectedExercisePR && (
        <PrTooltip
          visible={tooltipVisible}
          onClose={() => {
            setTooltipVisible(false)
            setSelectedExercisePR(null)
          }}
          prDetails={selectedExercisePR.prDetails}
          exerciseName={selectedExercisePR.exerciseName}
        />
      )}

      {/* Workout Share Screen Modal */}
      {workout && showShareScreen && (
        <WorkoutShareScreen
          visible={showShareScreen}
          workout={workout}
          weightUnit={weightUnit}
          workoutCountThisWeek={workoutCountThisWeek}
          workoutTitle={workoutTitle}
          onClose={handleCloseShareScreen}
          onShare={handleShareWidget}
        />
      )}
    </View>
  )
})

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 0,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 41,
      height: 41,
      borderRadius: 21,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.white,
      fontSize: 18,
      fontWeight: '600',
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    timeAgo: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },
    routineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      flexWrap: 'wrap',
    },
    actionText: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    routineLink: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    titleContainer: {
      // Container for clickable title/description area
    },
    titleContainerPressed: {
      opacity: 0.6,
    },
    workoutTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    workoutDescription: {
      fontSize: 16,
      lineHeight: 20,
      color: colors.text,
      marginBottom: 12,
    },
    exercisesContainer: {
      marginBottom: 12,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
    },
    tableHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundLight,
    },
    tableRowWithPR: {
      backgroundColor: colors.primaryLight,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    prBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 9999,
      marginLeft: 6,
    },
    prBadgeHistorical: {
      backgroundColor: colors.textPlaceholder,
    },
    prBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 0.5,
    },
    prBadgeSmall: {
      backgroundColor: colors.primary,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 9999,
    },
    prBadgeSmallHistorical: {
      backgroundColor: colors.textPlaceholder,
    },
    prBadgeContainer: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prBadgeTextSmall: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 0.5,
    },
    tableCell: {
      fontSize: 14,
      color: colors.text,
    },
    exerciseCol: {
      flex: 3,
    },
    expandedExerciseCol: {
      flex: 1,
      maxWidth: '100%',
    },
    setsCol: {
      flex: 1,
      textAlign: 'center',
    },
    repsCol: {
      flex: 1.5,
      textAlign: 'center',
    },
    weightCol: {
      flex: 1.5,
      textAlign: 'right',
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      paddingTop: 0,
      paddingBottom: 0,
      marginTop: 0,
    },
    expandButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      letterSpacing: -0.2,
    },
    exerciseName: {
      fontWeight: '600',
      color: colors.text,
    },
    exerciseNameText: {
      flex: 1,
      minWidth: 0,
    },
    variedCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    setDetailsContainer: {
      backgroundColor: colors.primaryLight,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fullExerciseName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    setDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 16,
    },
    setDetailRowWithPR: {
      backgroundColor: colors.white,
    },
    setDetailLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
      flex: 1,
    },
    setDetailReps: {
      fontSize: 13,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    setDetailWeight: {
      fontSize: 13,
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    workoutImageContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      marginBottom: 12,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      maxHeight: 400,
    },
    workoutImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
    imageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalContent: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenImage: {
      width: '100%',
      height: '100%',
    },
    fullscreenLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    analyzingBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    analyzingText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    exerciseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundLight,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastExerciseRow: {
      borderBottomWidth: 0,
    },
    exerciseNameContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginRight: 12,
    },
    exerciseNameSimple: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    setsText: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    seeMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      backgroundColor: colors.backgroundLight,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    seeMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      letterSpacing: -0.2,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.white,
    },
    statItem: {
      alignItems: 'center',
      gap: 4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    skeletonBar: {
      height: 14,
      backgroundColor: isDark ? '#555555' : '#999999',
      borderRadius: 6,
    },
    skeletonBarExercise: {
      flex: 1,
      maxWidth: '60%',
    },
    skeletonBarSets: {
      width: 60,
    },
    footer: {
      paddingTop: 8,
      paddingBottom: 12,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    socialActionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 12,
    },
    socialActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    socialActionCount: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 4, // reduced margin as social bar has top margin
      gap: 6,
    },
    paginationDot: {
      height: 6,
      width: 6,
      borderRadius: 3,
    },
  })
