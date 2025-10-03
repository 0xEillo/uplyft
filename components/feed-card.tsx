import { AppColors } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { useRef, useState } from 'react'
import {
  Animated,
  LayoutAnimation,
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

interface FeedCardProps {
  userName: string
  userAvatar: string
  timeAgo: string
  workoutTitle: string
  exercises: ExerciseDisplay[]
  stats: WorkoutStats
  likes: number
  comments: number
  userId?: string
  onUserPress?: () => void
}

export function FeedCard({
  userName,
  userAvatar,
  timeAgo,
  workoutTitle,
  exercises,
  stats,
  likes,
  comments,
  userId,
  onUserPress,
}: FeedCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(
    new Set(),
  )
  const rotateAnim = useRef(new Animated.Value(0)).current

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
        <TouchableOpacity>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={AppColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Workout Title */}
      {workoutTitle && (
        <Text style={styles.workoutTitle}>{workoutTitle}</Text>
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
            Weight
          </Text>
        </View>

        {/* Table Rows */}
        {displayedExercises.map((exercise, index) => {
          const isExerciseExpanded = expandedExercises.has(index)

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
                    style={styles.exerciseName}
                    numberOfLines={1}
                  >
                    {exercise.name}
                  </Text>
                  {exercise.hasVariedSets && (
                    <Ionicons
                      name={
                        isExerciseExpanded ? 'chevron-up' : 'chevron-down'
                      }
                      size={12}
                      color={AppColors.textSecondary}
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
                  {exercise.setDetails.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setDetailRow}>
                      <Text style={styles.setDetailLabel}>
                        Set {setIndex + 1}
                      </Text>
                      <Text style={styles.setDetailReps}>{set.reps} reps</Text>
                      <Text style={styles.setDetailWeight}>
                        {set.weight ? `${set.weight} lbs` : 'BW'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.exercises}</Text>
          <Text style={styles.statLabel}>exercises</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.sets}</Text>
          <Text style={styles.statLabel}>sets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {stats.prs > 0 ? stats.prs : '-'}
          </Text>
          <Text style={styles.statLabel}>PRs</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="heart-outline"
              size={22}
              color={AppColors.textSecondary}
            />
            <Text style={styles.actionText}>{likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={AppColors.textSecondary}
            />
            <Text style={styles.actionText}>{comments}</Text>
          </TouchableOpacity>
        </View>
        {hasMoreExercises && (
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
              <Ionicons
                name="chevron-down"
                size={16}
                color={AppColors.link}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: AppColors.shadow,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  timeAgo: {
    fontSize: 13,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 12,
  },
  exercisesContainer: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: AppColors.backgroundLight,
    borderRadius: 6,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  tableCell: {
    fontSize: 14,
    color: AppColors.text,
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
  },
  variedCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setDetailsContainer: {
    backgroundColor: AppColors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  setDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  setDetailLabel: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  setDetailReps: {
    fontSize: 13,
    color: AppColors.text,
    flex: 1,
    textAlign: 'center',
  },
  setDetailWeight: {
    fontSize: 13,
    color: AppColors.text,
    flex: 1,
    textAlign: 'right',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 12,
    backgroundColor: AppColors.backgroundLight,
    borderRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: AppColors.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
    textTransform: 'lowercase',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetails: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.link,
  },
})
