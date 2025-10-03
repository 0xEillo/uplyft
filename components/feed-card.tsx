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

interface ExerciseDisplay {
  name: string
  sets: number
  reps: string // e.g., "5, 5, 5, 5, 5" or "5×5"
  weight: string // e.g., "225 lbs" or "Bodyweight"
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
}: FeedCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const rotateAnim = useRef(new Animated.Value(0)).current

  const PREVIEW_LIMIT = 3 // Show first 3 exercises when collapsed
  const hasMoreExercises = exercises.length > PREVIEW_LIMIT
  const displayedExercises = isExpanded
    ? exercises
    : exercises.slice(0, PREVIEW_LIMIT)

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
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName[0]}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </View>
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
        {displayedExercises.map((exercise, index) => (
          <View
            key={index}
            style={[
              styles.tableRow,
              index === displayedExercises.length - 1 && styles.lastRow,
            ]}
          >
            <Text
              style={[styles.tableCell, styles.exerciseCol, styles.exerciseName]}
              numberOfLines={1}
            >
              {exercise.name}
            </Text>
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
          </View>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.exercises}</Text>
          <Text style={styles.statLabel}>Exercises</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.sets}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
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
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="share-outline"
              size={22}
              color={AppColors.textSecondary}
            />
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
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: AppColors.textTertiary,
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
