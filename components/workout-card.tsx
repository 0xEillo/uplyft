import { Ionicons } from '@expo/vector-icons'
import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ParsedWorkoutDisplay, getExerciseIcon } from '@/lib/ai/workoutParsing'
import { useThemedColors } from '@/hooks/useThemedColors'

interface WorkoutCardProps {
  workout: ParsedWorkoutDisplay
  onStartWorkout?: () => void
  onSaveRoutine?: () => void
}

export function WorkoutCard({
  workout,
  onStartWorkout,
  onSaveRoutine,
}: WorkoutCardProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const [isWorkoutExpanded, setIsWorkoutExpanded] = useState(false)
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState<
    number[]
  >([])

  return (
    <View style={styles.container}>
      <Text style={styles.workoutDescription}>{workout.description}</Text>

      <View style={styles.workoutCard}>
        <View style={styles.workoutCardHeader}>
          <Text style={styles.workoutCardTitle}>{workout.title}</Text>
          <View style={styles.workoutDuration}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.workoutDurationText}>{workout.duration}</Text>
          </View>
        </View>

        <View style={styles.workoutDivider} />

        {(isWorkoutExpanded ? workout.exercises : workout.exercises.slice(0, 4))
          .map((exercise, index) => {
            const warmupSets = exercise.sets.filter(
              (s) => s.type === 'warmup',
            ).length
            const totalSets = exercise.sets.length
            const isExpanded = expandedExerciseIndices.includes(index)

            return (
              <TouchableOpacity
                key={index}
                style={styles.exerciseItemContainer}
                activeOpacity={0.7}
                onPress={() => {
                  setExpandedExerciseIndices((prev) =>
                    prev.includes(index)
                      ? prev.filter((i) => i !== index)
                      : [...prev, index],
                  )
                }}
              >
                <View style={styles.exerciseItem}>
                  <View style={styles.exerciseIconContainer}>
                    <Ionicons
                      name={getExerciseIcon(exercise.name)}
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseSets}>
                      {totalSets} sets
                      {warmupSets > 0 ? ` (${warmupSets} warmup)` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>

                {isExpanded && (
                  <View style={styles.exerciseDetails}>
                    {exercise.sets.map((set, setIndex) => (
                      <View key={setIndex} style={styles.setDetailRow}>
                        <View style={styles.setNumberContainer}>
                          <Text style={styles.setNumberText}>
                            {setIndex + 1}
                          </Text>
                          {set.type === 'warmup' && (
                            <View style={styles.warmupBadge}>
                              <Text style={styles.warmupText}>W</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.setMainInfo}>
                          <Text style={styles.setDetailText}>
                            {set.weight ? `${set.weight} x ` : ''}
                            {set.reps} reps
                          </Text>
                        </View>
                        {set.rest && (
                          <View style={styles.restInfo}>
                            <Ionicons
                              name="timer-outline"
                              size={14}
                              color={colors.textSecondary}
                            />
                            <Text style={styles.restText}>{set.rest}s</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            )
          })}

        {workout.exercises.length > 4 && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setIsWorkoutExpanded(!isWorkoutExpanded)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isWorkoutExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {(onStartWorkout || onSaveRoutine) && (
        <View style={styles.actionButtonsContainer}>
          {onStartWorkout && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onStartWorkout}
              activeOpacity={0.7}
            >
              <Ionicons name="barbell" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>Start Workout</Text>
            </TouchableOpacity>
          )}
          {onSaveRoutine && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryActionButton]}
              onPress={onSaveRoutine}
              activeOpacity={0.7}
            >
              <Ionicons
                name="albums-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.secondaryActionButtonText}>
                Save as Routine
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      paddingVertical: 4,
    },
    workoutDescription: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    workoutCard: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 20,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    workoutCardHeader: {
      marginBottom: 12,
    },
    workoutCardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    workoutDuration: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    workoutDurationText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    workoutDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    exerciseItemContainer: {
      borderBottomWidth: 1,
      borderBottomColor: `${colors.border}80`,
    },
    exerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    exerciseDetails: {
      paddingLeft: 58,
      paddingRight: 16,
      paddingBottom: 12,
    },
    setDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    setNumberContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 40,
    },
    setNumberText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    warmupBadge: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      marginLeft: 4,
    },
    warmupText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '700',
    },
    setMainInfo: {
      flex: 1,
    },
    setDetailText: {
      fontSize: 14,
      color: colors.text,
    },
    restInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    restText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    exerciseIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    exerciseSets: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    expandButton: {
      alignItems: 'center',
      paddingTop: 12,
      marginTop: 4,
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    secondaryActionButton: {
      backgroundColor: colors.backgroundWhite,
      borderWidth: 1,
      borderColor: colors.primary,
      shadowOpacity: 0.05,
    },
    actionButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
    secondaryActionButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  })


