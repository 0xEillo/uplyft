import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { ParsedWorkoutDisplay, getExerciseIcon } from '@/lib/ai/workoutParsing'
import { findExerciseByName } from '@/lib/utils/exercise-matcher'

interface WorkoutCardProps {
  workout: ParsedWorkoutDisplay
  coachImage?: ImageSourcePropType
  username?: string
  onStartWorkout?: () => void
  onSaveRoutine?: () => void
}

export function WorkoutCard({
  workout,
  coachImage,
  username,
  onStartWorkout,
  onSaveRoutine,
}: WorkoutCardProps) {
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const styles = createStyles(colors, isDark)
  const [isWorkoutExpanded, setIsWorkoutExpanded] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState<
    number[]
  >([])

  const visibleExercises = isWorkoutExpanded
    ? workout.exercises
    : workout.exercises.slice(0, 4)
  const hasMoreExercises = workout.exercises.length > 4

  return (
    <LiquidGlassSurface
      style={styles.container}
      fallbackStyle={styles.containerFallback}
      debugLabel="workout-card"
    >

      {/* Coach attribution */}
      {coachImage && (
        <View style={styles.coachRow}>
          <Image source={coachImage} style={styles.coachAvatar} />
          <Text style={styles.coachLabel}>
            Crafted for{' '}
            <Text style={styles.coachLabelName}>{username ?? 'you'}</Text>
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.cardHeader, !coachImage && { paddingTop: 22 }]}>
        <Text style={styles.cardTitle}>{workout.title}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="barbell-outline" size={11} color={colors.brandPrimary} />
            <Text style={styles.statChipText}>
              {workout.exercises.length} exercises
            </Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statChip}>
            <Ionicons name="time-outline" size={11} color={colors.brandPrimary} />
            <Text style={styles.statChipText}>{workout.duration}</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      {workout.description ? (
        (() => {
          const needsExpand = workout.description.length > 120
          return (
            <TouchableOpacity
              onPress={() =>
                needsExpand && setIsDescriptionExpanded(!isDescriptionExpanded)
              }
              activeOpacity={needsExpand ? 0.7 : 1}
              disabled={!needsExpand}
              style={styles.descriptionWrapper}
            >
              <Text
                style={styles.description}
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
        })()
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Exercise list */}
      <View style={styles.exerciseList}>
        {visibleExercises.map((exercise, index) => {
          const isLast =
            index === visibleExercises.length - 1 && !hasMoreExercises
          const isExpanded = expandedExerciseIndices.includes(index)
          const exerciseMatch = findExerciseByName(exercise.name)
          const canNavigate = !!exerciseMatch?.id

          const handleNavigateToExercise = () => {
            if (exerciseMatch?.id) {
              router.push(`/exercise/${exerciseMatch.id}`)
            }
          }

          return (
            <View
              key={index}
              style={[styles.exerciseRow, !isLast && styles.exerciseRowBorder]}
            >
              {/* Icon / GIF thumbnail */}
              <TouchableOpacity
                style={[
                  styles.exerciseThumb,
                  exercise.gifUrl ? styles.exerciseThumbMedia : null,
                ]}
                onPress={handleNavigateToExercise}
                disabled={!canNavigate}
                activeOpacity={canNavigate ? 0.7 : 1}
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
                    color={
                      isDark ? 'rgba(255,255,255,0.38)' : colors.textTertiary
                    }
                  />
                )}
              </TouchableOpacity>

              {/* Name + expand */}
              <View style={styles.exerciseContent}>
                <View style={styles.exerciseNameRow}>
                  <TouchableOpacity
                    onPress={handleNavigateToExercise}
                    disabled={!canNavigate}
                    activeOpacity={canNavigate ? 0.7 : 1}
                    style={styles.exerciseNameTouch}
                  >
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.exerciseMeta}>
                    <Text style={styles.setSummaryText}>
                      {exercise.sets.length} sets
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setExpandedExerciseIndices((prev) =>
                          prev.includes(index)
                            ? prev.filter((i) => i !== index)
                            : [...prev, index],
                        )
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.chevronButton}
                    >
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={
                          isDark
                            ? 'rgba(255,255,255,0.28)'
                            : colors.textTertiary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {isExpanded && (
                  <View style={styles.setsDetailContainer}>
                    {(() => {
                      let workingSetNumber = 0
                      return exercise.sets.map((set, setIndex) => {
                        const isWarmup = set.type === 'warmup'
                        if (!isWarmup) workingSetNumber++
                        const displayLabel = isWarmup
                          ? 'W'
                          : String(workingSetNumber)

                        return (
                          <View key={setIndex} style={styles.setRow}>
                            <View
                              style={[
                                styles.setBadge,
                                isWarmup && styles.warmupBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.setBadgeText,
                                  isWarmup && styles.warmupBadgeText,
                                ]}
                              >
                                {displayLabel}
                              </Text>
                            </View>
                            <Text style={styles.setDetailText}>
                              {set.reps} reps
                              {set.weight ? (
                                <Text style={styles.setDetailMuted}>
                                  {' '}
                                  · {set.weight}
                                </Text>
                              ) : null}
                            </Text>
                          </View>
                        )
                      })
                    })()}
                  </View>
                )}
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
              size={18}
              color={isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary}
            />
            <Text style={styles.expandText}>
              {isWorkoutExpanded
                ? 'Show less'
                : `${workout.exercises.length - 4} more exercises`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action buttons */}
      {(onStartWorkout || onSaveRoutine) && (
        <View style={styles.actionsContainer}>
          {onStartWorkout && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onStartWorkout}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Start Workout</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          {onSaveRoutine && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSaveRoutine}
              activeOpacity={0.7}
            >
              <Ionicons
                name="bookmark-outline"
                size={14}
                color={
                  isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary
                }
              />
              <Text style={styles.secondaryButtonText}>Save Routine</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </LiquidGlassSurface>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      borderRadius: 24,
      overflow: 'hidden',
      marginVertical: 6,
    },
    containerFallback: {
      backgroundColor: isDark ? 'rgba(26,26,28,0.94)' : 'rgba(255,255,255,0.94)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.5 : 0.1,
      shadowRadius: 28,
      elevation: 10,
    },
    coachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
      gap: 7,
    },
    coachAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      opacity: 0.85,
    },
    coachLabel: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.38)' : colors.textTertiary,
      fontWeight: '400',
      letterSpacing: 0.1,
    },
    coachLabelName: {
      color: isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary,
      fontWeight: '600',
    },
    cardHeader: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 14,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#F5F5F5' : colors.textPrimary,
      lineHeight: 26,
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? 'rgba(255,255,255,0.45)' : colors.textTertiary,
      letterSpacing: 0.1,
    },
    statDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : colors.border,
    },
    descriptionWrapper: {
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    description: {
      fontSize: 14,
      color: isDark ? 'rgba(255,255,255,0.45)' : colors.textSecondary,
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    descriptionMoreText: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.3)' : colors.textTertiary,
      marginTop: 4,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      marginHorizontal: 20,
      marginBottom: 4,
    },
    exerciseList: {
      paddingHorizontal: 14,
      paddingBottom: 6,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 12,
    },
    exerciseRowBorder: {},
    exerciseThumb: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    exerciseThumbMedia: {
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'transparent',
      borderWidth: 0,
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
    },
    exerciseContent: {
      flex: 1,
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    exerciseNameTouch: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? 'rgba(255,255,255,0.88)' : colors.textPrimary,
      letterSpacing: -0.1,
    },
    exerciseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    setSummaryText: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
      fontWeight: '500',
    },
    chevronButton: {
      padding: 2,
    },
    setsDetailContainer: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(0,0,0,0.05)',
      gap: 7,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    setBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
    },
    warmupBadge: {
      backgroundColor: `${colors.statusWarning}22`,
      borderColor: `${colors.statusWarning}40`,
    },
    setBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary,
    },
    warmupBadgeText: {
      color: colors.statusWarning,
    },
    setDetailText: {
      fontSize: 13,
      color: isDark ? 'rgba(255,255,255,0.62)' : colors.textSecondary,
      fontWeight: '400',
    },
    setDetailMuted: {
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
    },
    expandFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 5,
      marginTop: 2,
    },
    expandText: {
      fontSize: 13,
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
      fontWeight: '500',
    },
    actionsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      marginTop: 4,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary,
      height: 48,
      borderRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    secondaryButton: {
      height: 40,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
    },
    secondaryButtonText: {
      color: isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
  })
