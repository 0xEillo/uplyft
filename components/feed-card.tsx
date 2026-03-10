import { Ionicons } from '@expo/vector-icons'
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { Image } from 'expo-image'

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import { WorkoutSongPreview } from '@/components/workout-song-preview'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { toggleMusicPreview } from '@/lib/music-preview-player'
import type { Profile, WorkoutSessionWithDetails } from '@/types/database.types'
import type { WorkoutSong } from '@/types/music'

import type { StrengthLevel } from '@/lib/strength-standards'
import { ExerciseMediaThumbnail } from './ExerciseMedia'
import { LevelBadge } from './LevelBadge'
import { PrTooltip } from './pr-tooltip'
import { PostWorkoutCelebration } from '@/components/post-workout-celebration'

// Helper functions for compact formatting
function formatDurationCompact(seconds: number): string {
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

function formatVolumeCompact(
  volumeKg: number,
  targetUnit: 'kg' | 'lb',
): string {
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
  gifUrl?: string | null
  sets: number
  reps: string
  weight: string
  hasVariedSets: boolean
  isCustom?: boolean // True if exercise was created by a user
  setDetails?: SetDetail[]
}

interface PrDetailForDisplay {
  kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
  label: string // e.g., "1RM", "11 reps @ 65kg"
  value: number
  previousValue?: number
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

export interface CommentPreview {
  id: string
  username: string
  userAvatar?: string | null
  text: string
  timeAgo: string
}

export interface FeedCardProps {
  userName: string
  userAvatar: string
  userLevel?: StrengthLevel | null
  timeAgo: string
  workoutTitle: string
  workoutDescription?: string | null
  workoutImageUrl?: string | null
  workoutSong?: WorkoutSong | null
  exercises: ExerciseDisplay[]
  stats: WorkoutStats
  userId?: string
  workoutId?: string
  workout?: WorkoutSessionWithDetails // Full workout object for sharing
  onUserPress?: () => void
  onCardPress?: () => void // Navigate to workout detail
  prInfo?: ExercisePRInfo[]
  isPending?: boolean // Flag to show skeleton while workout is being parsed
  isProcessingPending?: boolean // Flag to indicate actively processing vs just queued
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
  recentLikers?: Partial<Profile>[]
  latestComment?: CommentPreview | null
}

/**
 * Feed card component for displaying workout sessions.
 * Memoized to prevent unnecessary re-renders when parent re-renders.
 */
export const FeedCard = memo(function FeedCard({
  userName,
  userAvatar,
  userLevel,
  timeAgo,
  workoutTitle,
  workoutDescription,
  workoutImageUrl,
  workoutSong: workoutSongProp,
  exercises,
  stats,
  userId,
  workoutId,
  workout,
  onUserPress,
  onCardPress,
  prInfo = [],
  isPending = false,
  isProcessingPending = false,
  isFirst = false,
  likeCount = 0,
  commentCount = 0,
  isLiked = false,
  onLike,
  onComment,
  onEdit,
  onDelete,
  onCreateRoutine,
  routine,
  onRoutinePress,
  recentLikers = [],
  latestComment,
}: FeedCardProps): ReactElement {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { weightUnit } = useWeightUnits()
  const { width: windowWidth } = useWindowDimensions()

  const displayRoutine = routine || workout?.routine
  const workoutSong = workoutSongProp ?? workout?.song ?? null

  const coverImageUrl =
    workoutImageUrl ||
    (workoutSong?.artworkUrl100
      ? workoutSong.artworkUrl100.replace('100x100', '600x600')
      : null)

  const mediaFirst = !!workoutImageUrl

  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [
    selectedExercisePR,
    setSelectedExercisePR,
  ] = useState<ExercisePRInfo | null>(null)
  const [descriptionTruncated, setDescriptionTruncated] = useState(false)
  useEffect(() => {
    setDescriptionTruncated(false)
  }, [workoutDescription])
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [infoHeight, setInfoHeight] = useState(0)
  const [workoutCountThisWeek, setWorkoutCountThisWeek] = useState(1)

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.()
          },
        },
      ],
    )
  }

  const handleOptionsPress = () => {
    if (Platform.OS !== 'ios') {
      // Fallback for Android (simple alert for now as ActionSheet is iOS only)
      Alert.alert('Options', 'Select an action', [
        ...(onEdit ? [{ text: 'Edit Workout', onPress: onEdit }] : []),
        ...(onCreateRoutine
          ? [{ text: 'Save as Routine', onPress: onCreateRoutine }]
          : []),
        ...(onDelete
          ? [{ text: 'Delete Workout', onPress: handleDelete, style: 'destructive' as const }]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }

    const options = ['Cancel']
    const actions: (() => void)[] = [() => {}] // No-op for cancel

    if (onEdit) {
      options.push('Edit Workout')
      actions.push(onEdit)
    }
    if (onCreateRoutine) {
      options.push('Save as Routine')
      actions.push(onCreateRoutine)
    }
    if (onDelete) {
      options.push('Delete Workout')
      actions.push(handleDelete)
    }

    const destructiveButtonIndex = onDelete ? options.length - 1 : -1

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 0,
        destructiveButtonIndex,
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      (buttonIndex) => {
        actions[buttonIndex]?.()
      },
    )
  }

  // Calculate carousel width (screen width - card padding * 2)
  // Card padding is 14 horizontal
  const cardPadding = 14
  const carouselWidth = windowWidth - cardPadding * 2

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

  // Skeleton shimmer animation for pending state
  const shimmerAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0)).current
  const exercisesFadeAnim = useRef(new Animated.Value(isPending ? 0 : 1))
    .current
  const [analyzingDots, setAnalyzingDots] = useState('')

  const styles = createStyles(colors, isDark)
  const songOverlayStyle = {
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.9)',
  }

  const PREVIEW_LIMIT = 5
  const SKELETON_ROW_WIDTHS = [60, 80, 70, 75, 65]
  const skeletonRowWidths = Array.from(
    { length: PREVIEW_LIMIT },
    (_, index) => SKELETON_ROW_WIDTHS[index % SKELETON_ROW_WIDTHS.length],
  )
  const ROW_HEIGHT = 60 // 48 (thumb) + 12 (padding)
  const MIN_CONTENT_HEIGHT = ROW_HEIGHT * PREVIEW_LIMIT
  const hasMoreExercises = exercises.length > PREVIEW_LIMIT
  const displayedExercises = exercises.slice(0, PREVIEW_LIMIT)

  // Shimmer animation for skeleton rows (only when actively processing)
  useEffect(() => {
    if (isPending && isProcessingPending) {
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
      shimmerAnim.setValue(0.5) // Static opacity when queued
    }
  }, [isPending, isProcessingPending, shimmerAnim])

  // Pulse animation for analyzing badge (only when actively processing)
  useEffect(() => {
    if (isPending && isProcessingPending) {
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
  }, [isPending, isProcessingPending, pulseAnim])

  // Animated dots for "Analyzing..." text (only when actively processing)
  useEffect(() => {
    if (!isPending || !isProcessingPending) {
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
  }, [isPending, isProcessingPending])

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

  useEffect(() => {
    setImageLoading(Boolean(coverImageUrl))
    setFullscreenImageLoading(true)
  }, [coverImageUrl])

  const handleCloseShareScreen = () => {
    setShowShareScreen(false)
  }

  // Memoize stats section to keep it fixed
  const statsContent = useMemo(
    () => {
      if (isPending) return null
      return (
        <Pressable
          onPress={onCardPress}
          disabled={!onCardPress}
          style={styles.statsContainer}
        >
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>
              {formatDurationCompact(stats.durationSeconds || 0)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>
              {formatVolumeCompact(stats.volume || 0, weightUnit)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Records</Text>
            <Text style={styles.statValue}>{stats.prs}</Text>
          </View>
        </Pressable>
      )
    },
    [
      isPending,
      onCardPress,
      styles.statsContainer,
      styles.statItem,
      styles.statLabel,
      styles.statValue,
      stats.durationSeconds,
      stats.volume,
      weightUnit,
      stats.prs,
    ],
  )

  // Memoize info content (now just exercises) to prevent unnecessary re-layouts
  const infoContent = useMemo(
    () => (
      <>
        {/* Exercises List */}
        <Pressable
          onPress={onCardPress}
          disabled={!onCardPress || isPending}
          style={[styles.exercisesContainer, { minHeight: MIN_CONTENT_HEIGHT }]}
        >
          {/* Skeleton Rows (when pending) */}
          {isPending && (
            <>
              {skeletonRowWidths.map((width, index) => (
                <View key={`skeleton-${index}`} style={styles.exerciseRow}>
                  <View style={styles.exerciseNameContainer}>
                    <Animated.View
                      style={[
                        styles.exerciseThumbnail,
                        {
                          opacity: shimmerOpacity,
                          backgroundColor: isDark ? '#444' : '#eee',
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.skeletonBar,
                        styles.skeletonBarExercise,
                        { opacity: shimmerOpacity, width: `${width}%` },
                      ]}
                    />
                  </View>
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
                return (
                  <View key={index} style={styles.exerciseRow}>
                    <View style={styles.exerciseNameContainer}>
                      <ExerciseMediaThumbnail
                        gifUrl={exercise.gifUrl}
                        style={styles.exerciseThumbnail}
                        isCustom={exercise.isCustom}
                      />
                      <View
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text
                          style={styles.exerciseNameSimple}
                          numberOfLines={1}
                        >
                          {exercise.name}
                        </Text>
                      </View>
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
                    color={colors.brandPrimary}
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
              {isProcessingPending
                ? 'Parsing your workout and identifying exercises...'
                : 'Waiting for internet connection to upload your workout.'}
            </Text>
          </View>
        )}
      </>
    ),

    [
      isPending,
      isProcessingPending,
      onCardPress,
      shimmerOpacity,
      exercisesFadeAnim,
      displayedExercises,
      hasMoreExercises,
      colors.brandPrimary,
      isDark,
      exercises.length,
      styles,
      PREVIEW_LIMIT,
      skeletonRowWidths,
      MIN_CONTENT_HEIGHT,
    ],
  )

  const mediaSlide = coverImageUrl ? (
    <View style={{ width: carouselWidth }}>
      <TouchableOpacity
        style={styles.workoutImageContainer}
        onPress={() => setImageModalVisible(true)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: coverImageUrl }}
          style={styles.workoutImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          onLoadStart={() => setImageLoading(true)}
          onLoad={() => setImageLoading(false)}
          onError={(error) => {
            console.error('Failed to load workout image:', error)
            setImageLoading(false)
          }}
        />
        {imageLoading && (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.brandPrimary} />
          </View>
        )}
        {workoutSong && (
          <View style={styles.songOverlayContainer}>
            <WorkoutSongPreview
              song={workoutSong}
              containerStyle={songOverlayStyle}
              artworkSize={52}
            />
          </View>
        )}
      </TouchableOpacity>
    </View>
  ) : null

  const infoSlide = (
    <View
      style={{ width: carouselWidth, alignSelf: 'flex-start' }}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout
        if (Math.abs(height - infoHeight) > 2) {
          setInfoHeight(height)
        }
      }}
    >
      {infoContent}
    </View>
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
            <Image
              source={{ uri: userAvatar }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={100}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName[0]}</Text>
            </View>
          )}
          <View style={styles.userTextContainer}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {userName}
              </Text>
              {userLevel && !isPending && (
                <LevelBadge
                  level={userLevel}
                  size="xs"
                  showTooltipOnPress
                  style={styles.lifterBadge}
                />
              )}
            </View>
            {(displayRoutine || (workoutSong && !isPending)) && (
              <View style={styles.headerSubtitle}>
                {displayRoutine && (
                  <Text
                    style={styles.routineLink}
                    numberOfLines={1}
                    onPress={onRoutinePress}
                  >
                    {displayRoutine.name} ›
                  </Text>
                )}
                {displayRoutine && workoutSong && !isPending && (
                  <Text style={styles.subtitleSeparator}> • </Text>
                )}
                {workoutSong && !isPending && (
                  <TouchableOpacity
                    style={styles.headerMusicContainer}
                    onPress={() => toggleMusicPreview(workoutSong)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="musical-note"
                      size={12}
                      color={colors.textPrimary}
                    />
                    <Text style={styles.headerMusicText} numberOfLines={1}>
                      {workoutSong.artistName} • {workoutSong.trackName}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {isPending ? (
          <Animated.View
            style={[
              styles.analyzingBadge,
              isProcessingPending
                ? { opacity: pulseOpacity }
                : styles.queuedBadge,
            ]}
          >
            <Text style={styles.analyzingText}>
              {isProcessingPending ? `Analyzing${analyzingDots}` : 'Queued'}
            </Text>
          </Animated.View>
        ) : (
          (onEdit || onDelete || onCreateRoutine) && (
            <View style={{ zIndex: 10 }}>
              <TouchableOpacity
                onPress={handleOptionsPress}
                style={styles.menuButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )
        )}
      </View>

      <Pressable
        onPress={onCardPress}
        disabled={!onCardPress || isPending}
        style={({ pressed }) => [
          styles.titleRowContainer,
          !workoutDescription && styles.titleRowContainerNoDescription,
          pressed && onCardPress && styles.titleContainerPressed,
        ]}
      >
        <View style={styles.titleContent}>
          {workoutTitle && (
            <Text
              style={[
                styles.workoutTitle,
                !workoutDescription && styles.workoutTitleNoDescription,
              ]}
              numberOfLines={2}
            >
              {workoutTitle}
            </Text>
          )}
          {workoutDescription && (
            <>
              <Text
                style={styles.workoutDescription}
                numberOfLines={2}
                ellipsizeMode="tail"
                onTextLayout={(e) => {
                  const { lines } = e.nativeEvent
                  if (lines.length === 0) return
                  const lastLine = lines[lines.length - 1]
                  const lastLineText = lastLine?.text ?? ''
                  const endsWithEllipsis =
                    lastLineText.endsWith('...') || lastLineText.endsWith('…')
                  const renderedText = lines.map((l) => l.text).join('')
                  const wasTruncated =
                    endsWithEllipsis ||
                    renderedText.length < workoutDescription.length - 3
                  setDescriptionTruncated(wasTruncated)
                }}
              >
                {workoutDescription}
              </Text>
              {descriptionTruncated && (
                <Text style={styles.readMore}>Read more...</Text>
              )}
            </>
          )}
        </View>

        {workoutSong && !coverImageUrl && !workoutSong.artworkUrl100 && (
          <View style={styles.songPreviewWrapper}>
            <WorkoutSongPreview song={workoutSong} artworkSize={52} />
          </View>
        )}
      </Pressable>

      {/* Stats + Music row */}
      {(statsContent || (workoutSong && !isPending && workoutSong.artworkUrl100)) && (
      <View style={styles.statsRowWrapper}>
        {statsContent}

      </View>
      )}

      {/* Carousel or Exercises */}
      {coverImageUrl ? (
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
            {mediaFirst ? (
              <>
                {mediaSlide}
                {infoSlide}
              </>
            ) : (
              <>
                {infoSlide}
                {mediaSlide}
              </>
            )}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {[0, 1].map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activeSlide
                    ? { backgroundColor: colors.brandPrimary, width: 20 }
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
        <View>
          <View style={styles.socialActionsBar}>
            {/* Like Button */}
            <TouchableOpacity
              style={styles.socialActionButton}
              onPress={onLike}
              disabled={!onLike}
            >
              <Ionicons
                name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={22}
                color={isLiked ? colors.brandPrimary : colors.textPrimary}
                style={{
                  textShadowColor: isLiked
                    ? colors.brandPrimary
                    : colors.textSecondary,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 0.5,
                }}
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
                size={22}
                color={colors.textPrimary}
                style={{
                  textShadowColor: colors.textSecondary,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 0.5,
                }}
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
                  size={22}
                  color={colors.textPrimary}
                  style={{
                    textShadowColor: colors.textSecondary,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 0.5,
                  }}
                />
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />
            <Text style={styles.bottomTimeAgo}>{timeAgo}</Text>
          </View>

          {/* Liked By Section */}
          {recentLikers.length > 0 && (
            <View style={styles.likedByContainer}>
              <View style={styles.likedByAvatars}>
                {recentLikers.slice(0, 3).map((liker, index) => (
                  <View
                    key={liker.id}
                    style={[
                      styles.likedByAvatarContainer,
                      {
                        zIndex: 3 - index,
                        marginLeft: index > 0 ? -10 : 0,
                        borderColor: colors.bg,
                      },
                    ]}
                  >
                    {liker.avatar_url ? (
                      <Image
                        source={{ uri: liker.avatar_url }}
                        style={styles.likedByAvatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={100}
                      />
                    ) : (
                      <View
                        style={[
                          styles.likedByAvatar,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <Text style={styles.likedByAvatarFallback}>
                          {liker.display_name?.[0] || liker.user_tag?.[0] || '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <Text style={styles.likedByText} numberOfLines={1}>
                Liked by{' '}
                <Text style={styles.likedByBold}>
                  {recentLikers[0].display_name || recentLikers[0].user_tag}
                </Text>
                {likeCount > 1
                  ? ' and others'
                  : ''}
              </Text>
            </View>
          )}

          {/* Comment Preview Section */}
          {latestComment && (
            <View style={styles.commentPreviewContainer}>
              {latestComment.userAvatar ? (
                <Image
                  source={{ uri: latestComment.userAvatar }}
                  style={styles.commentAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={100}
                />
              ) : (
                <View style={styles.commentAvatarPlaceholder}>
                  <Text style={styles.commentAvatarPlaceholderText}>
                    {latestComment.username[0]}
                  </Text>
                </View>
              )}
              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentUsername}>
                    {latestComment.username}
                  </Text>
                  <Text style={styles.commentTime}>{latestComment.timeAgo}</Text>
                </View>
                <Text style={styles.commentText} numberOfLines={2}>
                  {latestComment.text}
                </Text>
              </View>
              <TouchableOpacity style={styles.commentLikeButton}>
                <Ionicons
                  name="heart-outline"
                  size={14}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Image Fullscreen Modal */}
      {coverImageUrl && (
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
              <Image
                source={{ uri: coverImageUrl }}
                style={styles.fullscreenImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={220}
                onLoadStart={() => setFullscreenImageLoading(true)}
                onLoad={() => setFullscreenImageLoading(false)}
                onError={(error) => {
                  console.error('Failed to load fullscreen image:', error)
                  setFullscreenImageLoading(false)
                }}
              />
              {fullscreenImageLoading && (
                <View style={styles.fullscreenLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.surface} />
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
        <PostWorkoutCelebration
          visible={showShareScreen}
          data={{
            workout,
            workoutTitle,
            workoutCountThisWeek,
          }}
          onClose={handleCloseShareScreen}
        />
      )}
    </View>
  )
})

function createStyles(
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bg,
      paddingHorizontal: 14,
      paddingTop: 18,
      paddingBottom: 0,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    userTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    avatar: {
      width: 41,
      height: 41,
      borderRadius: 21,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.surface,
      fontSize: 18,
      fontWeight: '600',
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    lifterBadge: {
      marginLeft: 2,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    timeAgo: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },
    bottomTimeAgo: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '400',
    },
    headerMusicContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 1,
    },
    headerSubtitle: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      flexWrap: 'nowrap',
    },
    subtitleSeparator: {
      fontSize: 12,
      color: colors.textTertiary,
      marginHorizontal: 2,
    },
    headerMusicText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    routineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    actionText: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    routineLink: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    titleRowContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 12, // Moved from contents to ensure player matches height correctly
    },
    titleRowContainerNoDescription: {
      marginBottom: 4,
    },
    titleContent: {
      flex: 1,
    },
    titleContainer: {
      // Container for clickable title/description area
    },
    titleContainerPressed: {
      opacity: 0.6,
    },
    workoutTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    workoutTitleNoDescription: {
      marginBottom: 0,
    },
    workoutDescription: {
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: 0,
      marginBottom: 0,
      lineHeight: 21,
    },
    songPreviewWrapper: {
      marginBottom: 12,
    },
    songOverlayContainer: {
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 10,
    },
    exercisesContainer: {
      marginBottom: 0,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.bg,
      position: 'relative',
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.surfaceSubtle,
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
      backgroundColor: colors.surfaceSubtle,
    },
    tableRowWithPR: {
      backgroundColor: colors.brandPrimarySoft,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    prBadge: {
      backgroundColor: colors.brandPrimary,
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
      color: colors.surface,
      letterSpacing: 0.5,
    },
    prBadgeSmall: {
      backgroundColor: colors.brandPrimary,
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
      color: colors.surface,
      letterSpacing: 0.5,
    },
    tableCell: {
      fontSize: 14,
      color: colors.textPrimary,
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
      color: colors.textPrimary,
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
      backgroundColor: colors.brandPrimarySoft,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fullExerciseName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
    },
    setDetailLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
      flex: 1,
    },
    setDetailReps: {
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    setDetailWeight: {
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'right',
    },
    workoutImageContainer: {
      width: '100%',
      aspectRatio: 1,
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    workoutImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
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
    headerMusicIndicator: {
      aspectRatio: 1,
      minHeight: 41,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    headerArtwork: {
      width: '100%',
      height: '100%',
    },
    headerMusicIconOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    analyzingBadge: {
      backgroundColor: colors.brandPrimarySoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    queuedBadge: {
      backgroundColor: colors.surfaceSubtle,
      opacity: 1,
    },
    analyzingText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    exerciseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    exerciseNameContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginRight: 12,
    },
    exerciseThumbnail: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#f0f0f0', // Keep light background for white GIFs even in dark mode
    },
    exerciseNameSimple: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
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
      paddingVertical: 8,
      backgroundColor: colors.bg,
    },
    seeMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brandPrimary,
      letterSpacing: -0.2,
    },
    statsRowWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
      marginBottom: 10,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: 28,
      paddingVertical: 10,
      paddingHorizontal: 0,
    },
    statsRowMusic: {
      width: 52,
      height: 52,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    statsRowArtwork: {
      width: '100%',
      height: '100%',
    },
    statItem: {
      alignItems: 'flex-start',
      gap: 4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
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
    socialActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    socialActionCount: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 4,
      marginBottom: 4, // reduced margin as social bar has top margin
      gap: 6,
    },
    socialActionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 16,
      paddingVertical: 10,
      paddingHorizontal: 4,
      marginTop: 4,
    },
    commentPreviewContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 4,
      marginTop: 8,
      marginBottom: 4,
      gap: 10,
    },
    commentAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
    },
    commentAvatarPlaceholder: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentAvatarPlaceholderText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    commentContent: {
      flex: 1,
      justifyContent: 'center',
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    commentUsername: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    commentTime: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    commentText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    commentLikeButton: {
      padding: 4,
    },
    likedByContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 0,
      marginBottom: 12,
      paddingHorizontal: 8,
    },
    likedByAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 8,
    },
    likedByAvatarContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      overflow: 'hidden',
    },
    likedByAvatar: {
      width: '100%',
      height: '100%',
    },
    likedByAvatarFallback: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    likedByText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    likedByBold: {
      fontWeight: '600',
    },
    menuButton: {
      padding: 4,
    },
    paginationDot: {
      height: 6,
      width: 6,
      borderRadius: 3,
    },
    readMore: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
      fontWeight: '500',
    },
  })
}
