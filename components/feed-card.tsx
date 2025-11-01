import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { memo, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutAnimation,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { PrTooltip } from './pr-tooltip'
import { ShareWorkoutCard } from './share-workout-card'

// Constants
const IMAGE_FADE_DURATION = 200 // Duration for thumbnail image fade-in
const FULLSCREEN_FADE_DURATION = 300 // Duration for fullscreen image fade-in

interface WorkoutStats {
  exercises: number
  sets: number
  prs: number // number of personal records achieved
}

interface SetDetail {
  reps: number | null
  weight: number | null
}

interface ExerciseDisplay {
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
  onEdit?: () => void
  onDelete?: () => void
  prInfo?: ExercisePRInfo[]
  isPending?: boolean // Flag to show skeleton while workout is being parsed
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
  onEdit,
  onDelete,
  prInfo = [],
  isPending = false,
}: FeedCardProps) {
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const { shareWorkout, isSharing } = useWorkoutShare()
  const shareCardRef = useRef<View>(null)

  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(
    new Set(),
  )
  const [menuVisible, setMenuVisible] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [
    selectedExercisePR,
    setSelectedExercisePR,
  ] = useState<ExercisePRInfo | null>(null)

  // Image loading states and animations
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(true)
  const rotateAnim = useRef(new Animated.Value(0)).current
  const imageOpacity = useRef(new Animated.Value(0)).current
  const fullscreenOpacity = useRef(new Animated.Value(0)).current

  // Skeleton shimmer animation for pending state
  const shimmerAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0)).current
  const exercisesFadeAnim = useRef(new Animated.Value(isPending ? 0 : 1)).current
  const [analyzingDots, setAnalyzingDots] = useState('')

  const styles = createStyles(colors)

  const PREVIEW_LIMIT = 3 // Show first 3 exercises when collapsed
  const hasMoreExercises = exercises.length > PREVIEW_LIMIT
  const displayedExercises = isExpanded
    ? exercises
    : exercises.slice(0, PREVIEW_LIMIT)

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

  const toggleExerciseExpand = (index: number) => {
    setExpandedExercises((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start()

    setIsExpanded(!isExpanded)
  }

  const handleShare = async () => {
    setMenuVisible(false)
    if (workout && shareCardRef.current) {
      await shareWorkout(workout, workoutTitle, shareCardRef.current)
    }
  }

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  return (
    <View style={styles.card}>
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
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </TouchableOpacity>
        {isPending ? (
          <Animated.View
            style={[styles.analyzingBadge, { opacity: pulseOpacity }]}
          >
            <Text style={styles.analyzingText}>Analyzing{analyzingDots}</Text>
          </Animated.View>
        ) : (
          <TouchableOpacity onPress={() => setMenuVisible(true)}>
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Workout Title */}
      {workoutTitle && <Text style={styles.workoutTitle}>{workoutTitle}</Text>}

      {/* Workout Description */}
      {workoutDescription && (
        <Text style={styles.workoutDescription}>{workoutDescription}</Text>
      )}

      {/* Workout Image */}
      {workoutImageUrl && (
        <TouchableOpacity
          style={styles.workoutImageContainer}
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
      )}

      {/* Exercises Table */}
      <View style={styles.exercisesContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.exerciseCol]}>
            Exercise
          </Text>
          <Text style={[styles.tableHeaderText, styles.setsCol]}>Sets</Text>
          <Text style={[styles.tableHeaderText, styles.repsCol]}>Reps</Text>
          <Text style={[styles.tableHeaderText, styles.weightCol]}>
            {`Wt (${weightUnit})`}
          </Text>
        </View>
        <View style={styles.headerDivider} />

        {/* Skeleton Rows (when pending) */}
        {isPending && (
          <>
            {[60, 80, 70].map((width, index) => (
              <View key={`skeleton-${index}`} style={styles.skeletonRow}>
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    styles.skeletonBarLong,
                    { opacity: shimmerOpacity, width: `${width}%` },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    styles.skeletonBarShort,
                    { opacity: shimmerOpacity },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    styles.skeletonBarShort,
                    { opacity: shimmerOpacity },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    styles.skeletonBarShort,
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
          const isExerciseExpanded = expandedExercises.has(index)
          const exercisePR = prInfo.find(
            (pr) => pr.exerciseName === exercise.name,
          )
          const hasPR = exercisePR && exercisePR.prSetIndices.size > 0

          return (
            <View key={index}>
              {/* Main exercise row */}
              <TouchableOpacity
                onPress={() => toggleExerciseExpand(index)}
                activeOpacity={0.7}
                style={[
                  styles.tableRow,
                  hasPR && styles.tableRowWithPR,
                  !isExerciseExpanded &&
                    index === displayedExercises.length - 1 &&
                    styles.lastRow,
                ]}
              >
                <View
                  style={[
                    isExerciseExpanded
                      ? styles.expandedExerciseCol
                      : styles.exerciseCol,
                    styles.variedCell,
                  ]}
                >
                  <Text
                    key={`${index}-${isExerciseExpanded}`}
                    style={[
                      styles.exerciseName,
                      !isExerciseExpanded && styles.exerciseNameText,
                    ]}
                    numberOfLines={isExerciseExpanded ? undefined : 1}
                    ellipsizeMode="tail"
                  >
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
                        !exercisePR.hasCurrentPR && styles.prBadgeHistorical,
                      ]}
                    >
                      <Text style={styles.prBadgeText}>PR</Text>
                    </TouchableOpacity>
                  )}
                  <Ionicons
                    name={isExerciseExpanded ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={colors.textSecondary}
                  />
                </View>
                {!isExerciseExpanded && (
                  <>
                    <Text style={[styles.tableCell, styles.setsCol]}>
                      {exercise.sets}
                    </Text>
                    <Text
                      style={[styles.tableCell, styles.repsCol]}
                      numberOfLines={1}
                    >
                      {exercise.reps}
                    </Text>
                    <Text
                      style={[styles.tableCell, styles.weightCol]}
                      numberOfLines={1}
                    >
                      {exercise.weight}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Expanded set details */}
              {isExerciseExpanded &&
                exercise.setDetails &&
                exercise.setDetails.length > 0 && (
                  <View style={styles.setDetailsContainer}>
                    {exercise.setDetails.map((set, setIndex) => {
                      const setHasPR = exercisePR?.prSetIndices.has(setIndex)
                      return (
                        <View
                          key={setIndex}
                          style={[
                            styles.setDetailRow,
                            setHasPR && styles.setDetailRowWithPR,
                          ]}
                        >
                          <Text style={styles.setDetailLabel}>
                            Set {setIndex + 1}
                          </Text>
                          <Text style={styles.setDetailReps}>
                            {set.reps != null ? `${set.reps} reps` : '--'}
                          </Text>
                          <Text style={styles.setDetailWeight}>
                            {set.weight
                              ? `${set.weight.toFixed(
                                  weightUnit === 'kg' ? 1 : 0,
                                )}`
                              : 'BW'}
                          </Text>
                          <View style={styles.prBadgeContainer}>
                            {setHasPR && exercisePR && (
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedExercisePR(exercisePR)
                                  setTooltipVisible(true)
                                }}
                                activeOpacity={0.7}
                                style={[
                                  styles.prBadgeSmall,
                                  !exercisePR.hasCurrentPR &&
                                    styles.prBadgeSmallHistorical,
                                ]}
                              >
                                <Text style={styles.prBadgeTextSmall}>PR</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )}
            </View>
          )
        })}
          </Animated.View>
        )}
      </View>

      {/* Footer message for pending state */}
      {isPending && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Parsing your workout and identifying exercises...
          </Text>
        </View>
      )}

      {/* Actions */}
      {!isPending && hasMoreExercises && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={toggleExpand}
            style={styles.viewDetailsButton}
          >
            <Text style={styles.viewDetails}>
              {isExpanded ? 'Show Less' : 'View Details'}
            </Text>
            <Animated.View
              style={{ transform: [{ rotate: rotateInterpolate }] }}
            >
              <Ionicons name="chevron-down" size={16} color={colors.link} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            {workout && !isPending && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="share-outline" size={20} color={colors.text} />
                )}
                <Text style={styles.menuItemText}>
                  {isSharing ? 'Sharing...' : 'Share Workout'}
                </Text>
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  onEdit()
                }}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={styles.menuItemText}>Edit Workout</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false)
                onDelete?.()
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={styles.menuItemTextDelete}>Delete Workout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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

      {/* Hidden Share Card for Image Capture - Must be rendered but hidden */}
      {workout && !isPending && (
        <View
          style={{
            position: 'absolute',
            left: -50000,
            top: 0,
          }}
        >
          <View
            ref={shareCardRef}
            collapsable={false}
          >
            <ShareWorkoutCard
              workout={workout}
              userName={userName}
              userAvatar={userAvatar}
              workoutTitle={workoutTitle}
              workoutDescription={workoutDescription || null}
              timeAgo={timeAgo}
              weightUnit={weightUnit}
              prInfo={prInfo}
            />
          </View>
        </View>
      )}
    </View>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
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
    workoutTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    workoutDescription: {
      fontSize: 14,
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
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
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
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    viewDetailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    viewDetails: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.link,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuContainer: {
      backgroundColor: colors.white,
      borderRadius: 12,
      minWidth: 200,
      padding: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    menuItemText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    menuItemTextDelete: {
      fontSize: 16,
      color: colors.error,
      fontWeight: '500',
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
    skeletonRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
      gap: 8,
    },
    skeletonBar: {
      height: 12,
      backgroundColor: colors.border,
      borderRadius: 6,
    },
    skeletonBarLong: {
      flex: 3,
    },
    skeletonBarShort: {
      flex: 1,
      minWidth: 30,
    },
    footer: {
      paddingTop: 8,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  })
