import { useThemedColors } from '@/hooks/useThemedColors'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { WeightUnit } from '@/contexts/unit-context'
import { ExercisePRInfo } from './feed-card'
import { Image, Platform, StyleSheet, Text, View } from 'react-native'

interface ShareWorkoutCardProps {
  workout: WorkoutSessionWithDetails
  userName: string
  userAvatar: string | null
  workoutTitle: string
  workoutDescription: string | null
  timeAgo: string
  weightUnit: WeightUnit
  prInfo?: ExercisePRInfo[]
}

/**
 * ShareWorkoutCard component renders a beautifully styled workout card
 * that looks exactly like the feed card, but optimized for sharing.
 * This component is designed to be captured as an image using react-native-view-shot.
 */
export function ShareWorkoutCard({
  workout,
  userName,
  userAvatar,
  workoutTitle,
  workoutDescription,
  timeAgo,
  weightUnit,
  prInfo = [],
}: ShareWorkoutCardProps) {
  const colors = useThemedColors()
  const exercises = formatWorkoutForDisplay(workout, weightUnit)

  // Dynamic scale factor based on workout complexity
  // Reduce scale for longer workouts to prevent capture failures
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0)
  const SCALE = totalSets > 30 ? 2 : totalSets > 20 ? 2.5 : 3

  // Limit exercises to prevent view from being too tall to capture
  const MAX_EXERCISES = 8
  const displayExercises = exercises.slice(0, MAX_EXERCISES)
  const hasMoreExercises = exercises.length > MAX_EXERCISES

  const styles = createStyles(colors, SCALE)

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header - Same as feed card */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
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
          </View>
        </View>

        {/* Workout Title */}
        {workoutTitle && <Text style={styles.workoutTitle}>{workoutTitle}</Text>}

        {/* Workout Description */}
        {workoutDescription && (
          <Text style={styles.workoutDescription} numberOfLines={4}>
            {workoutDescription}
          </Text>
        )}

        {/* Exercises Table - Exact same as feed card */}
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

          {/* Exercise Rows - All Expanded */}
          {displayExercises.map((exercise, index) => {
            const exercisePR = prInfo.find(
              (pr) => pr.exerciseName === exercise.name,
            )
            const hasPR = exercisePR && exercisePR.prSetIndices.size > 0

            return (
              <View key={index}>
                {/* Exercise Header Row */}
                <View
                  style={[
                    styles.tableRow,
                    hasPR && styles.tableRowWithPR,
                  ]}
                >
                  <View style={[styles.exerciseCol, styles.exerciseNameContainer]}>
                    <Text style={styles.exerciseName}>
                      {exercise.name}
                    </Text>
                    {hasPR && exercisePR && (
                      <View
                        style={[
                          styles.prBadge,
                          !exercisePR.hasCurrentPR && styles.prBadgeHistorical,
                        ]}
                      >
                        <Text style={styles.prBadgeText}>PR</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Expanded Set Details */}
                {exercise.setDetails && exercise.setDetails.length > 0 && (
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
                              <View
                                style={[
                                  styles.prBadgeSmall,
                                  !exercisePR.hasCurrentPR &&
                                    styles.prBadgeSmallHistorical,
                                ]}
                              >
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

          {/* More exercises indicator */}
          {hasMoreExercises && (
            <View style={styles.moreExercisesRow}>
              <Text style={styles.moreExercisesText}>
                +{exercises.length - MAX_EXERCISES} more{' '}
                {exercises.length - MAX_EXERCISES === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>
          )}
        </View>

        {/* Rep AI Branding Footer */}
        <View style={styles.footer}>
          <View style={styles.brandingRow}>
            <Image
              source={require('@/llm/repai-logo-black.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>Rep AI</Text>
          </View>
          <Text style={styles.cta}>Track your workouts with Rep AI</Text>
        </View>
      </View>
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  scale: number,
) =>
  StyleSheet.create({
    container: {
      width: 360 * scale, // Standard mobile width scaled up
      backgroundColor: colors.background,
      padding: 16 * scale,
      flexShrink: 0,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 12 * scale,
      padding: 16 * scale,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 * scale },
      shadowOpacity: 0.1,
      shadowRadius: 4 * scale,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12 * scale,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12 * scale,
    },
    avatar: {
      width: 41 * scale,
      height: 41 * scale,
      borderRadius: 21 * scale,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.white,
      fontSize: 18 * scale,
      fontWeight: '600',
    },
    userName: {
      fontSize: 16 * scale,
      fontWeight: '600',
      color: colors.text,
    },
    timeAgo: {
      fontSize: 13 * scale,
      color: colors.textTertiary,
      marginTop: 2 * scale,
    },
    workoutTitle: {
      fontSize: 16 * scale,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8 * scale,
    },
    workoutDescription: {
      fontSize: 14 * scale,
      lineHeight: 20 * scale,
      color: colors.text,
      marginBottom: 12 * scale,
    },
    exercisesContainer: {
      marginBottom: 12 * scale,
      borderRadius: 8 * scale,
      overflow: 'hidden',
      borderWidth: 1 * scale,
      borderColor: colors.border,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8 * scale,
      paddingHorizontal: 4 * scale,
      backgroundColor: colors.backgroundLight,
    },
    tableHeaderText: {
      fontSize: 11 * scale,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerDivider: {
      height: 1 * scale,
      backgroundColor: colors.border,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10 * scale,
      paddingHorizontal: 4 * scale,
      borderBottomWidth: 1 * scale,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundLight,
    },
    tableRowWithPR: {
      backgroundColor: colors.primaryLight,
    },
    lastRow: {
      borderBottomWidth: 0,
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
    exerciseNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4 * scale,
    },
    exerciseName: {
      fontSize: 14 * scale,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    tableCell: {
      fontSize: 14 * scale,
      color: colors.text,
    },
    prBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 6 * scale,
      paddingVertical: 2 * scale,
      borderRadius: 4 * scale,
    },
    prBadgeHistorical: {
      backgroundColor: colors.textPlaceholder,
    },
    prBadgeText: {
      fontSize: 10 * scale,
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 0.5,
    },
    prBadgeSmall: {
      backgroundColor: colors.primary,
      paddingHorizontal: 4 * scale,
      paddingVertical: 1 * scale,
      borderRadius: 3 * scale,
    },
    prBadgeSmallHistorical: {
      backgroundColor: colors.textPlaceholder,
    },
    prBadgeContainer: {
      width: 32 * scale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prBadgeTextSmall: {
      fontSize: 9 * scale,
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 0.5,
    },
    setDetailsContainer: {
      backgroundColor: colors.primaryLight,
      paddingVertical: 8 * scale,
      paddingHorizontal: 12 * scale,
      borderBottomWidth: 1 * scale,
      borderBottomColor: colors.border,
    },
    setDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6 * scale,
      paddingHorizontal: 16 * scale,
    },
    setDetailRowWithPR: {
      backgroundColor: colors.white,
    },
    setDetailLabel: {
      fontSize: 13 * scale,
      color: colors.textSecondary,
      fontWeight: '600',
      flex: 1,
    },
    setDetailReps: {
      fontSize: 13 * scale,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    setDetailWeight: {
      fontSize: 13 * scale,
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    moreExercisesRow: {
      paddingVertical: 12 * scale,
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      borderTopWidth: 1 * scale,
      borderTopColor: colors.border,
    },
    moreExercisesText: {
      fontSize: 13 * scale,
      fontWeight: '600',
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    footer: {
      alignItems: 'center',
      paddingTop: 16 * scale,
      borderTopWidth: 1 * scale,
      borderTopColor: colors.border,
    },
    brandingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8 * scale,
      gap: 2 * scale,
    },
    logo: {
      width: 24 * scale,
      height: 24 * scale,
    },
    brandText: {
      fontSize: 18 * scale,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    cta: {
      fontSize: 12 * scale,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })
