import { BaseNavbar } from '@/components/base-navbar'
import { ExerciseMedia } from '@/components/ExerciseMedia'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Exercise, Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

// Animation stack management - prevents re-animation when returning from child pages
let skipNextCompareEntryAnimation = false

const markCompareEntrySkipFlag = () => {
  skipNextCompareEntryAnimation = true
}

const consumeCompareEntrySkipFlag = () => {
  const shouldSkip = skipNextCompareEntryAnimation
  skipNextCompareEntryAnimation = false
  return shouldSkip
}

interface ComparisonStats {
  workoutCount: { me: number; them: number }
  workoutTime: { me: number; them: number } // in minutes
  totalVolume: { me: number; them: number } // in kg
}

interface ExerciseInCommon {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  gifUrl: string | null
}

interface ExerciseComparison {
  exercise: ExerciseInCommon
  oneRepMax: { me: number; them: number }
  heaviestWeight: { me: number; them: number }
  bestSetVolume: { me: number; them: number }
}

export default function CompareScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()

  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [theirProfile, setTheirProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ComparisonStats | null>(null)
  const [exercisesInCommon, setExercisesInCommon] = useState<
    ExerciseInCommon[]
  >([])
  const [
    selectedExercise,
    setSelectedExercise,
  ] = useState<ExerciseInCommon | null>(null)
  const [
    exerciseComparison,
    setExerciseComparison,
  ] = useState<ExerciseComparison | null>(null)
  const [loadingExercise, setLoadingExercise] = useState(false)
  const shouldSkipNextEntryRef = useRef<boolean>(consumeCompareEntrySkipFlag())
  const isInitialFocusRef = useRef(true)
  const [shouldExit, setShouldExit] = useState(false)
  const [shouldAnimateEntry, setShouldAnimateEntry] = useState(
    !shouldSkipNextEntryRef.current,
  )
  const [timePeriod, setTimePeriod] = useState<'1M' | '6M' | '1Y' | 'ALL'>('1M')
  const [showTimePicker, setShowTimePicker] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (shouldSkipNextEntryRef.current) {
        setShouldAnimateEntry(false)
        shouldSkipNextEntryRef.current = false
        isInitialFocusRef.current = false
      } else if (isInitialFocusRef.current) {
        setShouldAnimateEntry(true)
        isInitialFocusRef.current = false
      }
    }, [shouldSkipNextEntryRef]),
  )

  const markNextFocusAsChildReturn = useCallback(() => {
    markCompareEntrySkipFlag()
    shouldSkipNextEntryRef.current = true
  }, [shouldSkipNextEntryRef])

  useEffect(() => {
    return () => {
      shouldSkipNextEntryRef.current = false
      isInitialFocusRef.current = true
    }
  }, [userId])

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  const loadComparisonData = useCallback(async () => {
    if (!user?.id || !userId) return

    if (!myProfile) {
      setIsLoading(true)
    } else {
      setIsUpdating(true)
    }
    try {
      // Load both profiles
      const [myProfileData, theirProfileData] = await Promise.all([
        database.profiles.getById(user.id),
        database.profiles.getById(userId),
      ])

      setMyProfile(myProfileData)
      setTheirProfile(theirProfileData)

      // Calculate date filter based on time period
      let dateFilter: Date | null = null
      if (timePeriod !== 'ALL') {
        dateFilter = new Date()
        switch (timePeriod) {
          case '1M':
            dateFilter.setMonth(dateFilter.getMonth() - 1)
            break
          case '6M':
            dateFilter.setMonth(dateFilter.getMonth() - 6)
            break
          case '1Y':
            dateFilter.setFullYear(dateFilter.getFullYear() - 1)
            break
        }
      }

      // Fetch workout data for both users
      const [myWorkouts, theirWorkouts] = await Promise.all([
        database.workoutSessions.getRecent(user.id, 1000),
        database.workoutSessions.getRecent(userId, 1000),
      ])

      // Filter by time period
      const myRecentWorkouts = dateFilter
        ? myWorkouts.filter((w) => new Date(w.date) >= dateFilter!)
        : myWorkouts
      const theirRecentWorkouts = dateFilter
        ? theirWorkouts.filter((w) => new Date(w.date) >= dateFilter!)
        : theirWorkouts

      // Calculate stats
      const myWorkoutCount = myRecentWorkouts.length
      const theirWorkoutCount = theirRecentWorkouts.length

      // Duration is stored in seconds, convert to minutes for display
      const myWorkoutTime = Math.round(
        myRecentWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60,
      )
      const theirWorkoutTime = Math.round(
        theirRecentWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60,
      )

      // Calculate total volume
      const calculateVolume = (workouts: typeof myWorkouts) => {
        return workouts.reduce((total, workout) => {
          return (
            total +
            workout.workout_exercises.reduce((exerciseTotal, we) => {
              return (
                exerciseTotal +
                we.sets.reduce((setTotal, set) => {
                  if (set.weight && set.reps) {
                    return setTotal + set.weight * set.reps
                  }
                  return setTotal
                }, 0)
              )
            }, 0)
          )
        }, 0)
      }

      const myVolume = calculateVolume(myRecentWorkouts)
      const theirVolume = calculateVolume(theirRecentWorkouts)

      setStats({
        workoutCount: { me: myWorkoutCount, them: theirWorkoutCount },
        workoutTime: { me: myWorkoutTime, them: theirWorkoutTime },
        totalVolume: { me: myVolume, them: theirVolume },
      })

      // Find exercises in common (across all workouts)
      const myExerciseIds = new Set<string>()
      const theirExerciseMap = new Map<string, Exercise>()

      myWorkouts.forEach((w) => {
        w.workout_exercises.forEach((we) => {
          myExerciseIds.add(we.exercise_id)
        })
      })

      theirWorkouts.forEach((w) => {
        w.workout_exercises.forEach((we) => {
          if (myExerciseIds.has(we.exercise_id)) {
            theirExerciseMap.set(we.exercise_id, we.exercise)
          }
        })
      })

      const commonExercises: ExerciseInCommon[] = Array.from(
        theirExerciseMap.values(),
      ).map((e) => ({
        exerciseId: e.id,
        exerciseName: e.name,
        muscleGroup: e.muscle_group,
        gifUrl: e.gif_url || null,
      }))

      setExercisesInCommon(commonExercises)
    } catch (error) {
      console.error('Error loading comparison data:', error)
    } finally {
      setIsLoading(false)
      setIsUpdating(false)
    }
  }, [user?.id, userId, timePeriod])

  const loadExerciseComparison = useCallback(
    async (exercise: ExerciseInCommon) => {
      if (!user?.id || !userId) return

      setLoadingExercise(true)
      setSelectedExercise(exercise)

      try {
        // Get all sets for this exercise for both users
        const fetchExerciseStats = async (targetUserId: string) => {
          const workouts = await database.workoutSessions.getRecent(
            targetUserId,
            1000,
          )

          let maxWeight = 0
          let max1RM = 0
          let maxSetVolume = 0

          workouts.forEach((w) => {
            w.workout_exercises.forEach((we) => {
              if (we.exercise_id === exercise.exerciseId) {
                we.sets.forEach((set) => {
                  if (set.weight && set.reps) {
                    // Track heaviest weight
                    if (set.weight > maxWeight) {
                      maxWeight = set.weight
                    }

                    // Calculate estimated 1RM using Epley formula
                    const estimated1RM = set.weight * (1 + set.reps / 30)
                    if (estimated1RM > max1RM) {
                      max1RM = estimated1RM
                    }

                    // Track best set volume
                    const setVolume = set.weight * set.reps
                    if (setVolume > maxSetVolume) {
                      maxSetVolume = setVolume
                    }
                  }
                })
              }
            })
          })

          return {
            heaviestWeight: maxWeight,
            oneRepMax: Math.round(max1RM),
            bestSetVolume: maxSetVolume,
          }
        }

        const [myStats, theirStats] = await Promise.all([
          fetchExerciseStats(user.id),
          fetchExerciseStats(userId),
        ])

        setExerciseComparison({
          exercise,
          oneRepMax: { me: myStats.oneRepMax, them: theirStats.oneRepMax },
          heaviestWeight: {
            me: myStats.heaviestWeight,
            them: theirStats.heaviestWeight,
          },
          bestSetVolume: {
            me: myStats.bestSetVolume,
            them: theirStats.bestSetVolume,
          },
        })
      } catch (error) {
        console.error('Error loading exercise comparison:', error)
      } finally {
        setLoadingExercise(false)
      }
    },
    [user?.id, userId],
  )

  useFocusEffect(
    useCallback(() => {
      loadComparisonData()
    }, [loadComparisonData]),
  )

  const handleBack = useCallback(() => {
    if (selectedExercise) {
      setSelectedExercise(null)
      setExerciseComparison(null)
    } else {
      setShouldExit(true)
    }
  }, [selectedExercise])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  // Calculate percentage differences
  const calculatePercentageDiff = (me: number, them: number): number => {
    if (them === 0) return me > 0 ? 100 : 0
    return Math.round(((me - them) / them) * 100)
  }

  // Format time (minutes to hours)
  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }

  // Format volume
  const formatVolume = (kg: number): string => {
    if (weightUnit === 'lb') {
      const lb = Math.round(kg * 2.20462)
      if (lb >= 1000) {
        return `${(lb / 1000).toFixed(1).replace(/\.0$/, '')} k`
      }
      return `${lb}`
    }
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')} k`
    }
    return `${Math.round(kg)}`
  }

  const renderComparisonBar = (
    label: string,
    myValue: number,
    theirValue: number,
    formatFn: (val: number) => string,
    unit?: string,
  ) => {
    const percentDiff = calculatePercentageDiff(myValue, theirValue)
    const maxValue = Math.max(myValue, theirValue)
    const myWidth = maxValue > 0 ? (myValue / maxValue) * 100 : 0
    const theirWidth = maxValue > 0 ? (theirValue / maxValue) * 100 : 0
    const isTiedValue = myValue === theirValue

    return (
      <View style={styles.comparisonItem}>
        <View style={styles.comparisonHeader}>
          <Text style={styles.comparisonLabel}>{label}</Text>
          <View style={styles.percentageContainer}>
            {isTiedValue ? (
              <Text
                style={[styles.percentageText, { color: colors.textTertiary }]}
              >
                = 0%
              </Text>
            ) : (
              <>
                <Ionicons
                  name={percentDiff >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={14}
                  color={
                    percentDiff >= 0 ? colors.statusSuccess : colors.statusError
                  }
                />
                <Text
                  style={[
                    styles.percentageText,
                    {
                      color:
                        percentDiff >= 0
                          ? colors.statusSuccess
                          : colors.statusError,
                    },
                  ]}
                >
                  {Math.abs(percentDiff)}%
                </Text>
              </>
            )}
          </View>
        </View>

        {/* My bar */}
        <View style={styles.barRow}>
          <View style={styles.avatarContainer}>
            {myProfile?.avatar_url ? (
              <Image
                source={{ uri: myProfile.avatar_url }}
                style={styles.smallAvatar}
              />
            ) : (
              <View style={[styles.smallAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {myProfile?.display_name?.charAt(0)?.toUpperCase() || 'O'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.barContainer}>
            <View
              style={[styles.bar, styles.myBar, { width: `${myWidth}%` }]}
            />
          </View>
          <Text style={styles.barValue}>
            {formatFn(myValue)}
            {unit ? ` ${unit}` : ''}
          </Text>
        </View>

        {/* Their bar */}
        <View style={styles.barRow}>
          <View style={styles.avatarContainer}>
            {theirProfile?.avatar_url ? (
              <Image
                source={{ uri: theirProfile.avatar_url }}
                style={styles.smallAvatar}
              />
            ) : (
              <View style={[styles.smallAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {theirProfile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.barContainer}>
            <View
              style={[styles.bar, styles.theirBar, { width: `${theirWidth}%` }]}
            />
          </View>
          <Text style={styles.barValue}>
            {formatFn(theirValue)}
            {unit ? ` ${unit}` : ''}
          </Text>
        </View>
      </View>
    )
  }

  const renderExerciseList = () => {
    if (exercisesInCommon.length === 0) {
      return (
        <View style={styles.emptyExercises}>
          <Ionicons
            name="barbell-outline"
            size={48}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>No exercises in common yet</Text>
        </View>
      )
    }

    return (
      <View style={styles.exerciseList}>
        {exercisesInCommon.map((exercise) => (
          <TouchableOpacity
            key={exercise.exerciseId}
            style={styles.exerciseItem}
            onPress={() => loadExerciseComparison(exercise)}
            activeOpacity={0.7}
          >
            <View style={styles.exerciseGif}>
              <ExerciseMedia
                gifUrl={exercise.gifUrl}
                style={styles.exerciseGifImage}
              />
            </View>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {exercise.exerciseName}
              </Text>
              <Text style={styles.exerciseMuscle}>{exercise.muscleGroup}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  const renderExerciseComparison = () => {
    if (!exerciseComparison || !selectedExercise) return null

    // Determine who's stronger based on 1RM
    const meStronger =
      exerciseComparison.oneRepMax.me > exerciseComparison.oneRepMax.them
    const themStronger =
      exerciseComparison.oneRepMax.them > exerciseComparison.oneRepMax.me
    const isTied =
      exerciseComparison.oneRepMax.me === exerciseComparison.oneRepMax.them

    return (
      <View style={styles.exerciseComparisonContainer}>
        {/* Header with VS */}
        <View style={styles.vsHeader}>
          <View style={styles.vsUserContainer}>
            <View
              style={[styles.vsAvatar, meStronger && styles.vsAvatarWinner]}
            >
              {myProfile?.avatar_url ? (
                <Image
                  source={{ uri: myProfile.avatar_url }}
                  style={styles.largeAvatar}
                />
              ) : (
                <View style={[styles.largeAvatar, styles.avatarPlaceholder]}>
                  <Text style={styles.largeAvatarInitial}>
                    {myProfile?.display_name?.charAt(0)?.toUpperCase() || 'O'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.vsName} numberOfLines={1}>
              {myProfile?.display_name || 'You'}
            </Text>
            {meStronger && (
              <View style={styles.strongerBadge}>
                <Text style={styles.strongerText}>STRONGER</Text>
              </View>
            )}
            {isTied && (
              <View style={styles.tiedBadge}>
                <Text style={styles.tiedText}>TIED</Text>
              </View>
            )}
          </View>

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={styles.vsUserContainer}>
            <View
              style={[styles.vsAvatar, themStronger && styles.vsAvatarWinner]}
            >
              {theirProfile?.avatar_url ? (
                <Image
                  source={{ uri: theirProfile.avatar_url }}
                  style={styles.largeAvatar}
                />
              ) : (
                <View style={[styles.largeAvatar, styles.avatarPlaceholder]}>
                  <Text style={styles.largeAvatarInitial}>
                    {theirProfile?.display_name?.charAt(0)?.toUpperCase() ||
                      'U'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.vsName} numberOfLines={1}>
              {theirProfile?.display_name || 'User'}
            </Text>
            {themStronger && (
              <View style={styles.strongerBadge}>
                <Text style={styles.strongerText}>STRONGER</Text>
              </View>
            )}
            {isTied && (
              <View style={styles.tiedBadge}>
                <Text style={styles.tiedText}>TIED</Text>
              </View>
            )}
          </View>
        </View>

        {/* Selected Exercise */}
        <View style={styles.selectedExercise}>
          <Text style={styles.sectionLabel}>Exercise</Text>
          <TouchableOpacity
            style={styles.exerciseItem}
            onPress={() => {
              markNextFocusAsChildReturn()
              router.push({
                pathname: '/exercise/[exerciseId]',
                params: { exerciseId: selectedExercise.exerciseId },
              })
            }}
            activeOpacity={0.7}
          >
            <View style={styles.exerciseGif}>
              <ExerciseMedia
                gifUrl={selectedExercise.gifUrl}
                style={styles.exerciseGifImage}
              />
            </View>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {selectedExercise.exerciseName}
              </Text>
              <Text style={styles.exerciseMuscle}>
                {selectedExercise.muscleGroup}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        {/* Comparison Stats */}
        <View style={styles.comparisonSection}>
          <Text style={styles.sectionLabel}>Comparison</Text>
          {renderComparisonBar(
            'One Rep Max',
            exerciseComparison.oneRepMax.me,
            exerciseComparison.oneRepMax.them,
            (val) => `${val}`,
            weightUnit,
          )}
          {renderComparisonBar(
            'Heaviest Weight',
            exerciseComparison.heaviestWeight.me,
            exerciseComparison.heaviestWeight.them,
            (val) => `${val}`,
            weightUnit,
          )}
          {renderComparisonBar(
            'Best Set (Volume)',
            exerciseComparison.bestSetVolume.me,
            exerciseComparison.bestSetVolume.them,
            (val) => `${Math.round(val)}`,
            weightUnit,
          )}
        </View>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  return (
    <SlideInView
      style={{ flex: 1 }}
      enabled={shouldAnimateEntry}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BaseNavbar
          leftContent={
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          }
          centerContent={
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Comparison</Text>
              {isUpdating && (
                <ActivityIndicator
                  size="small"
                  color={colors.brandPrimary}
                  style={{ marginLeft: 4 }}
                />
              )}
              <TouchableOpacity
                style={styles.timePicker}
                onPress={() => setShowTimePicker(!showTimePicker)}
              >
                <Text style={styles.timePickerText}>{timePeriod}</Text>
                <Ionicons
                  name={showTimePicker ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          }
        />

        {/* Time Picker Dropdown */}
        {showTimePicker && (
          <View style={styles.timePickerDropdown}>
            {(['1M', '6M', '1Y', 'ALL'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.timePickerOption,
                  timePeriod === period && styles.timePickerOptionActive,
                ]}
                onPress={() => {
                  setTimePeriod(period)
                  setShowTimePicker(false)
                }}
              >
                <Text
                  style={[
                    styles.timePickerOptionText,
                    timePeriod === period && styles.timePickerOptionTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingExercise ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : selectedExercise && exerciseComparison ? (
            renderExerciseComparison()
          ) : (
            <>
              {/* Stats Section */}
              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>
                  Stats -{' '}
                  {timePeriod === 'ALL'
                    ? 'All Time'
                    : `Last ${
                        timePeriod === '1M'
                          ? '1 Month'
                          : timePeriod === '6M'
                          ? '6 Months'
                          : '1 Year'
                      }`}
                </Text>
                {stats && (
                  <>
                    {renderComparisonBar(
                      'Workout Count',
                      stats.workoutCount.me,
                      stats.workoutCount.them,
                      (val) => `${val}`,
                      '',
                    )}
                    {renderComparisonBar(
                      'Workout Time',
                      stats.workoutTime.me,
                      stats.workoutTime.them,
                      formatTime,
                      '',
                    )}
                    {renderComparisonBar(
                      'Total Volume',
                      stats.totalVolume.me,
                      stats.totalVolume.them,
                      formatVolume,
                      weightUnit,
                    )}
                  </>
                )}
              </View>

              {/* Exercises in Common */}
              <View style={styles.exercisesSection}>
                <Text style={styles.sectionTitle}>Exercises in Common</Text>
                {renderExerciseList()}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 100,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? colors.border + '40' : colors.border + '80',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timePickerText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    timePickerDropdown: {
      position: 'absolute',
      top: 56,
      left: 0,
      right: 0,
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 8,
      marginHorizontal: 16,
      zIndex: 1000,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderWidth: 1,
      borderColor: colors.border,
    },
    timePickerOption: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      minWidth: 60,
      alignItems: 'center',
    },
    timePickerOptionActive: {
      backgroundColor: colors.brandPrimary,
    },
    timePickerOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timePickerOptionTextActive: {
      color: colors.surface,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    statsSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    comparisonItem: {
      marginBottom: 24,
    },
    comparisonHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    comparisonLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    percentageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    percentageText: {
      fontSize: 14,
      fontWeight: '600',
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 4,
      gap: 10,
    },
    avatarContainer: {
      width: 28,
    },
    smallAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    avatarPlaceholder: {
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.surface,
    },
    barContainer: {
      flex: 1,
      height: 8,
      backgroundColor: isDark ? '#333' : '#e0e0e0',
      borderRadius: 4,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
      borderRadius: 4,
    },
    myBar: {
      backgroundColor: colors.brandPrimary,
    },
    theirBar: {
      backgroundColor: colors.textSecondary,
    },
    barValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
      minWidth: 70,
      textAlign: 'right',
    },
    exercisesSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },

    exerciseList: {
      gap: 1,
      backgroundColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    exerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceCard,
      gap: 12,
    },
    exerciseGif: {
      width: 56,
      height: 56,
      borderRadius: 8,
      overflow: 'hidden',
    },
    exerciseGifImage: {
      width: 56,
      height: 56,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    exerciseMuscle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyExercises: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    // Exercise Comparison Styles
    exerciseComparisonContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    vsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    vsUserContainer: {
      flex: 1,
      alignItems: 'center',
      maxWidth: 120,
    },
    vsAvatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      marginBottom: 8,
      borderWidth: 3,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    vsAvatarWinner: {
      borderColor: colors.brandPrimary,
    },
    largeAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    largeAvatarInitial: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.surface,
    },
    vsName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    strongerBadge: {
      backgroundColor: colors.statusSuccess,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    strongerText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.surface,
    },
    tiedBadge: {
      backgroundColor: colors.textTertiary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    tiedText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.surface,
    },
    vsCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
      marginTop: 26,
    },
    vsText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.surface,
    },
    selectedExercise: {
      marginBottom: 24,
    },
    comparisonSection: {
      marginTop: 8,
    },
  })
