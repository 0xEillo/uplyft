import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { memo, useRef, useState } from 'react'
import {
  Animated,
  LayoutAnimation,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface WorkoutStats {
  exercises: number
  sets: number
  prs: number // number of personal records achieved
}

interface SetDetail {
  reps: number
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

interface ExercisePRInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  hasCurrentPR: boolean // true if at least one PR is still current
}

interface FeedCardProps {
  userName: string
  userAvatar: string
  timeAgo: string
  workoutTitle: string
  workoutDescription?: string | null
  exercises: ExerciseDisplay[]
  stats: WorkoutStats
  userId?: string
  workoutId?: string
  onUserPress?: () => void
  onEdit?: () => void
  onDelete?: () => void
  prInfo?: ExercisePRInfo[]
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
  exercises,
  stats,
  userId,
  workoutId,
  onUserPress,
  onEdit,
  onDelete,
  prInfo = [],
}: FeedCardProps) {
  const colors = useThemedColors()
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(
    new Set(),
  )
  const [menuVisible, setMenuVisible] = useState(false)
  const rotateAnim = useRef(new Animated.Value(0)).current

  const styles = createStyles(colors)

  const PREVIEW_LIMIT = 3 // Show first 3 exercises when collapsed
  const hasMoreExercises = exercises.length > PREVIEW_LIMIT
  const displayedExercises = isExpanded
    ? exercises
    : exercises.slice(0, PREVIEW_LIMIT)

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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName[0]}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Workout Title */}
      {workoutTitle && <Text style={styles.workoutTitle}>{workoutTitle}</Text>}

      {/* Workout Description */}
      {workoutDescription && (
        <Text style={styles.workoutDescription}>{workoutDescription}</Text>
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
            Wt (kg)
          </Text>
        </View>
        <View style={styles.headerDivider} />

        {/* Table Rows */}
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
                onPress={
                  exercise.hasVariedSets
                    ? () => toggleExerciseExpand(index)
                    : undefined
                }
                activeOpacity={exercise.hasVariedSets ? 0.7 : 1}
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
                    styles.tableCell,
                    styles.exerciseCol,
                    styles.variedCell,
                  ]}
                >
                  <Text
                    style={[styles.exerciseName, styles.exerciseNameText]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {exercise.name}
                  </Text>
                  {hasPR && (
                    <View
                      style={[
                        styles.prBadge,
                        !exercisePR?.hasCurrentPR && styles.prBadgeHistorical,
                      ]}
                    >
                      <Text style={styles.prBadgeText}>PR</Text>
                    </View>
                  )}
                  {exercise.hasVariedSets && (
                    <Ionicons
                      name={isExerciseExpanded ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={colors.textSecondary}
                    />
                  )}
                </View>
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
              </TouchableOpacity>

              {/* Expanded set details */}
              {isExerciseExpanded && exercise.setDetails && (
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
                          {set.reps} reps
                        </Text>
                        <Text style={styles.setDetailWeight}>
                          {set.weight ? `${set.weight}` : 'BW'}
                        </Text>
                        <View style={styles.prBadgeContainer}>
                          {setHasPR && (
                            <View style={styles.prBadgeSmall}>
                              <Text style={styles.prBadgeTextSmall}>PR</Text>
                            </View>
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
      </View>

      {/* Actions */}
      {hasMoreExercises && (
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
      borderRadius: 4,
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
      borderRadius: 3,
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
  })
