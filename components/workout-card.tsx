import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { ParsedWorkoutDisplay, getExerciseIcon } from '@/lib/ai/workoutParsing'
import { findExerciseByName } from '@/lib/utils/exercise-matcher'

interface WorkoutCardProps {
  workout: ParsedWorkoutDisplay
  coachImage?: ImageSourcePropType
  onStartWorkout?: () => void
  onSaveRoutine?: () => void
  hideInfoButton?: boolean
}

export function WorkoutCard({
  workout,
  coachImage,
  onStartWorkout,
  onSaveRoutine,
  hideInfoButton = false,
}: WorkoutCardProps) {
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const styles = createStyles(colors, isDark)
  const [isWorkoutExpanded, setIsWorkoutExpanded] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState<
    number[]
  >([])

  // Determine which exercises to show based on expansion state
  const visibleExercises = isWorkoutExpanded
    ? workout.exercises
    : workout.exercises.slice(0, 4)


  const hasMoreExercises = workout.exercises.length > 4

  return (
    <View style={styles.container}>
      {/* Coach attribution */}
      {coachImage && (
        <View style={styles.coachRow}>
          <Image source={coachImage} style={styles.coachAvatar} />
          <Text style={styles.coachLabel}>
            Here's what I put together for you
          </Text>
        </View>
      )}
      
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{workout.title}</Text>
        <View style={styles.durationBadge}>
          <Ionicons name="time-outline" size={14} color={colors.brandPrimary} />
          <Text style={styles.durationText}>{workout.duration}</Text>
        </View>
      </View>

      {/* Expandable description */}
      {workout.description ? (() => {
        // Show expand option if description is likely to need more than 2 lines (~120 chars)
        const needsExpand = workout.description.length > 120
        return (
          <TouchableOpacity 
            onPress={() => needsExpand && setIsDescriptionExpanded(!isDescriptionExpanded)}
            activeOpacity={needsExpand ? 0.7 : 1}
            disabled={!needsExpand}
          >
            <Text 
              style={[styles.description, !needsExpand && { marginBottom: 20 }]} 
              numberOfLines={isDescriptionExpanded ? undefined : 2}
            >
              {workout.description}
            </Text>
            {needsExpand && (
              <Text style={styles.descriptionMoreText}>
                {isDescriptionExpanded ? 'less' : 'more'}
              </Text>
            )}
          </TouchableOpacity>
        )
      })() : null}

      <View style={styles.exerciseList}>
        {visibleExercises.map((exercise, index) => {
          const isLast = index === visibleExercises.length - 1 && !hasMoreExercises
          const isExpanded = expandedExerciseIndices.includes(index)
          const setSummary = `${exercise.sets.length} sets`
          
          // Get exercise ID for navigation
          const exerciseMatch = findExerciseByName(exercise.name)
          const canNavigate = !!exerciseMatch?.id
          
          const handleNavigateToExercise = () => {
            if (exerciseMatch?.id) {
              router.push(`/exercise/${exerciseMatch.id}`)
            }
          }

          return (
            <View key={index} style={styles.timelineRow}>
              {/* Timeline Connector */}
              <View style={styles.timelineColumn}>
                <View style={styles.timelineLineTop} />
                <TouchableOpacity 
                  style={[styles.timelineNode, exercise.gifUrl ? styles.timelineNodeImage : null]}
                  onPress={handleNavigateToExercise}
                  disabled={!canNavigate || hideInfoButton}
                  activeOpacity={canNavigate && !hideInfoButton ? 0.7 : 1}
                >
                   {exercise.gifUrl ? (
                      <ExerciseMediaThumbnail
                        gifUrl={exercise.gifUrl}
                        style={styles.thumbnailImage}
                      />
                    ) : (
                       <Ionicons
                        name={getExerciseIcon(exercise.name)}
                        size={18}
                        color={colors.textSecondary}
                      />
                    )}
                </TouchableOpacity>
                {/* Draw line to next item unless it's the very last one */}
                 {!isLast && <View style={styles.timelineLineBottom} />}
              </View>

              {/* Content */}
              <View style={styles.contentColumn}>
                <TouchableOpacity
                  style={styles.exerciseItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setExpandedExerciseIndices((prev) =>
                      prev.includes(index)
                        ? prev.filter((i) => i !== index)
                        : [...prev, index],
                    )
                  }}
                >
                  <View style={styles.exerciseHeader}>
                    <View style={styles.exerciseHeaderText}>
                      <View style={styles.exerciseNameRow}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        {canNavigate && !hideInfoButton && (
                          <TouchableOpacity 
                            onPress={handleNavigateToExercise}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.infoButton}
                          >
                            <Ionicons
                              name="information-circle-outline"
                              size={18}
                              color={colors.textTertiary}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.setSummaryContainer}>
                         <Text style={styles.setSummaryText}>{setSummary}</Text>
                          <Ionicons
                            name="chevron-forward"
                            size={12}
                            color={colors.textTertiary}
                            style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }]}}
                          />
                      </View>
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.setsDetailContainer}>
                      {(() => {
                        let workingSetNumber = 0
                        return exercise.sets.map((set, setIndex) => {
                          const isWarmup = set.type === 'warmup'
                          if (!isWarmup) workingSetNumber++
                          const displayLabel = isWarmup ? 'W' : workingSetNumber
                          
                          return (
                            <View key={setIndex} style={styles.setRow}>
                              <View style={[styles.setBadge, isWarmup && styles.warmupBadge]}>
                                <Text style={[styles.setText, isWarmup && styles.warmupText]}>
                                  {displayLabel}
                                </Text>
                              </View>
                              <Text style={styles.setDetailText}>
                                {set.reps} reps {set.weight ? `@ ${set.weight}` : ''}
                              </Text>
                            </View>
                          )
                        })
                      })()}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )
        })}

        {hasMoreExercises && (
           <TouchableOpacity
            style={styles.expandFooter}
            onPress={() => setIsWorkoutExpanded(!isWorkoutExpanded)}
            activeOpacity={0.7}
          >
             <Ionicons
              name={isWorkoutExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
             <Text style={styles.expandText}>
               {isWorkoutExpanded ? 'Show Less' : `${workout.exercises.length - 4} more exercises`}
             </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      {(onStartWorkout || onSaveRoutine) && (
        <View style={styles.actionsContainer}>
          {onStartWorkout && (
             <TouchableOpacity style={styles.primaryButton} onPress={onStartWorkout} activeOpacity={0.8}>
               <Text style={styles.primaryButtonText}>Start Workout</Text>
               <Ionicons name="arrow-forward" size={18} color={colors.surface} />
             </TouchableOpacity>
          )}
           {onSaveRoutine && (
             <TouchableOpacity style={styles.secondaryButton} onPress={onSaveRoutine} activeOpacity={0.7}>
               <Text style={styles.secondaryButtonText}>Save Routine</Text>
             </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#1C1C1E' : colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      marginVertical: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: isDark ? 0 : 1,
      borderColor: colors.border,
    },
    coachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 0,
      gap: 10,
    },
    coachAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceSubtle,
    },
    coachLabel: {
      fontSize: 13,
      color: isDark ? '#A0A0A0' : colors.textSecondary,
      fontWeight: '500',
    },
    cardHeader: {
      paddingHorizontal: 20,
      paddingTop: 12, 
      paddingBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : colors.textPrimary,
      flex: 1,
      marginRight: 12,
      lineHeight: 28,
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : `${colors.brandPrimary}15`,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    durationText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    description: {
      fontSize: 15,
      color: isDark ? '#A0A0A0' : colors.textSecondary,
      lineHeight: 22,
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    descriptionMoreText: {
      fontSize: 13,
      color: colors.textTertiary,
      paddingHorizontal: 20,
      marginBottom: 20,
      marginTop: -16,
    },
    exerciseList: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      gap: 8,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : colors.surfaceSubtle, 
      borderRadius: 16,
      padding: 12,
      minHeight: 72,
    },
    timelineColumn: {
      width: 52,
      alignItems: 'center',
      marginRight: 12,
    },
    timelineLineTop: {
      display: 'none',
    },
    timelineLineBottom: {
       display: 'none',
    },
    timelineNode: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: isDark ? '#3A3A3C' : colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: isDark ? 0 : 1,
      borderColor: colors.border,
      zIndex: 2,
    },
    timelineNodeImage: {
       padding: 0,
       overflow: 'hidden',
       borderWidth: 0,
       backgroundColor: isDark ? '#000' : 'transparent',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
      opacity: isDark ? 0.9 : 1,
    },
    contentColumn: {
      flex: 1,
      paddingTop: 0,
      paddingLeft: 0,
      paddingBottom: 0,
    },
    exerciseItem: {
      justifyContent: 'center',
    },
    exerciseHeader: {
    },
    exerciseHeaderText: {
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoButton: {
      padding: 2,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : colors.textPrimary,
      marginBottom: 4,
      flex: 1,
    },
    setSummaryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    setSummaryText: {
      fontSize: 13,
      color: isDark ? '#A0A0A0' : colors.textSecondary,
      fontWeight: '500',
    },
    setsDetailContainer: {
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      borderRadius: 8,
      padding: 12,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 10,
    },
    setBadge: {
       width: 20,
       height: 20,
       borderRadius: 10,
       backgroundColor: isDark ? '#48484A' : colors.border,
       justifyContent: 'center',
       alignItems: 'center',
    },
    warmupBadge: {
       backgroundColor: `${colors.statusWarning}30`,
    },
    setText: {
       fontSize: 10,
       fontWeight: '700',
       color: isDark ? '#EBEBF5' : colors.textSecondary,
    },
    warmupText: {
       color: colors.statusWarning,
    },
    setDetailText: {
       fontSize: 14,
       color: isDark ? '#D1D1D6' : colors.textSecondary,
    },
    expandFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginTop: 4,
      gap: 6,
    },
    expandText: {
      fontSize: 14,
      color: isDark ? '#A0A0A0' : colors.textSecondary,
      fontWeight: '500',
    },
    actionsContainer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 12,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary,
      height: 50,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#3A3A3C' : colors.border,
    },
    secondaryButtonText: {
      color: isDark ? '#FFFFFF' : colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
  })


