import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
import { useRoutineSelection } from '@/hooks/useRoutineSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { buildStructuredDraftFromRoutineTemplate } from '@/lib/utils/routine-structured-draft'
import { UserProgram, WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RoutinesScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { callCallback } = useRoutineSelection()
  const { hasActiveSession, seedRoutine } = useWorkoutComposer()

  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [programs, setPrograms] = useState<UserProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)
  const [startingRoutineId, setStartingRoutineId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'Routines' | 'Programs'>(
    'Routines',
  )

  const { isDark } = useTheme()
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  const loadRoutines = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [routinesData, programsData] = await Promise.all([
        database.workoutRoutines.getAll(user.id),
        database.userPrograms.getAll(user.id),
      ])
      setRoutines(routinesData)
      setPrograms(programsData)
    } catch (error) {
      console.error('Error loading routines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadRoutines()
  }, [loadRoutines])

  useEffect(() => {
    trackEvent(AnalyticsEvents.ROUTINES_VIEWED)
  }, [trackEvent])

  useFocusEffect(
    useCallback(() => {
      loadRoutines()
    }, [loadRoutines]),
  )

  const handleBack = useCallback(() => {
    haptic('light')
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const startRoutine = useCallback(
    async (routine: WorkoutRoutineWithDetails) => {
      if (startingRoutineId) return

      const applyRoutine = async () => {
        setStartingRoutineId(routine.id)
        try {
          const structuredData = buildStructuredDraftFromRoutineTemplate(
            (routine.workout_routine_exercises || [])
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((ex) => ({
                id: ex.id,
                name: ex.exercise?.name || 'Unknown Exercise',
                orderIndex: ex.order_index,
                sets: (ex.sets || [])
                  .slice()
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((s) => ({
                    setNumber: s.set_number,
                    repsMin: s.reps_min,
                    repsMax: s.reps_max,
                    restSeconds: s.rest_seconds,
                  })),
              })),
          )

          seedRoutine({
            title: routine.name,
            structuredData,
            selectedRoutineId: routine.id,
            routineSource: 'route',
          })

          router.push('/create-post')
        } catch (e) {
          console.error('Failed to start routine', e)
          Alert.alert('Error', 'Failed to start routine. Please try again.')
        } finally {
          setStartingRoutineId(null)
        }
      }

      if (hasActiveSession) {
        Alert.alert(
          'Existing Workout',
          'Starting this routine will clear your current workout in progress. Do you want to continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              style: 'destructive',
              onPress: () => {
                void applyRoutine()
              },
            },
          ],
        )
      } else {
        await applyRoutine()
      }
    },
    [hasActiveSession, router, seedRoutine, startingRoutineId],
  )

  const editRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      router.push({
        pathname: '/create-routine',
        params: { routineId: routine.id },
      })
    },
    [router],
  )

  const deleteRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      Alert.alert(
        'Delete Routine',
        `Are you sure you want to delete "${routine.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await database.workoutRoutines.delete(routine.id)
                hapticSuccess()
                setRoutines((prev) => prev.filter((r) => r.id !== routine.id))
              } catch (error) {
                console.error('Error deleting routine:', error)
                Alert.alert('Error', 'Failed to delete routine. Please try again.')
              }
            },
          },
        ],
      )
    },
    [],
  )

  const openRoutineOptions = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      haptic('light')

      if (Platform.OS !== 'ios') {
        Alert.alert(routine.name, undefined, [
          { text: 'Edit Routine', onPress: () => editRoutine(routine) },
          {
            text: 'Delete Routine',
            style: 'destructive',
            onPress: () => deleteRoutine(routine),
          },
          { text: 'Cancel', style: 'cancel' },
        ])
        return
      }

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit Routine', 'Delete Routine'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          userInterfaceStyle: isDark ? 'dark' : 'light',
          title: routine.name,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) editRoutine(routine)
          if (buttonIndex === 2) deleteRoutine(routine)
        },
      )
    },
    [deleteRoutine, editRoutine, isDark],
  )

  const renderTabHeader = () => {
    const tabs = ['Routines', 'Programs'] as const
    return (
      <View style={styles.tabHeaderContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              activeTab === tab && styles.tabButtonActive,
            ]}
            onPress={() => {
              haptic('light')
              setActiveTab(tab)
            }}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab && styles.tabButtonTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  const renderGenerateRow = (
    label: string,
    intent: 'routine' | 'program',
  ) => (
    <TouchableOpacity
      style={styles.createRoutineRow}
      onPress={() => {
        haptic('light')
        router.push({ pathname: '/chat', params: { generate: intent } })
      }}
    >
      <View style={styles.generateIconWrapper}>
        <View style={styles.generateIcon}>
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </View>
        <View
          style={[
            styles.generateSparkleBadge,
            { backgroundColor: colors.bg, borderColor: colors.bg },
          ]}
        >
          <Ionicons name="sparkles" size={11} color={colors.brandPrimary} />
        </View>
      </View>
      <Text style={styles.createRoutineText}>{label}</Text>
    </TouchableOpacity>
  )

  const renderProgramsContent = () => {
    const programGroups = programs.map((program) => ({
      program,
      routinesCount: routines.filter((r) => r.program_id === program.id).length,
    }))

    return (
      <View style={styles.listContainer}>
        {renderGenerateRow('Create new program', 'program')}

        {/* User Programs */}
        {programGroups.map(({ program, routinesCount }) => {
          const imageSource = program.image_path
            ? getRoutineImageUrl(program.image_path)
            : null

          return (
            <TouchableOpacity
              key={program.id}
              style={styles.listItem}
              onPress={() => {
                haptic('light')
                router.push({
                  pathname: '/explore/program/[programId]',
                  params: { programId: program.id },
                })
              }}
            >
              <View style={[styles.listIconContainer, { borderRadius: 8 }]}>
                {imageSource ? (
                  <Image
                    source={{ uri: imageSource as string }}
                    style={styles.programImage}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons
                    name="albums-outline"
                    size={24}
                    color={colors.textPrimary}
                  />
                )}
              </View>
              <View style={styles.listTextContainer}>
                <Text style={styles.listTitle}>{program.name}</Text>
                <Text style={styles.listSubtitle}>
                  {routinesCount} Workouts
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
                opacity={0.5}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  const renderRoutineCard = (routine: WorkoutRoutineWithDetails) => {
    const exercises = (routine.workout_routine_exercises || [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
    const exerciseNames = exercises
      .map((ex) => ex.exercise?.name)
      .filter((n): n is string => !!n)

    const subtitle =
      exerciseNames.length === 0
        ? 'No exercises yet'
        : exerciseNames.length <= 2
        ? exerciseNames.join(' · ')
        : `${exerciseNames.slice(0, 2).join(' · ')} +${exerciseNames.length - 2} more`

    const isStarting = startingRoutineId === routine.id
    const hasExercises = exercises.length > 0

    return (
      <TouchableOpacity
        key={routine.id}
        style={styles.routineCard}
        activeOpacity={0.85}
        onPress={() => {
          haptic('light')
          router.push({
            pathname: '/routine/[routineId]',
            params: { routineId: routine.id },
          })
        }}
      >
        <View style={styles.routineCardHeader}>
          <View style={styles.routineCardTitleContainer}>
            <Text style={styles.routineCardTitle} numberOfLines={1}>
              {routine.name}
            </Text>
            <Text style={styles.routineCardSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              openRoutineOptions(routine)
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.routineCardMenuButton}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!hasExercises || isStarting}
          onPress={(e) => {
            e.stopPropagation()
            haptic('light')
            void startRoutine(routine)
          }}
          style={[
            styles.startRoutineButton,
            (!hasExercises || isStarting) && styles.startRoutineButtonDisabled,
          ]}
        >
          {isStarting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startRoutineButtonText}>
              {hasExercises ? 'Start Routine' : 'Empty Routine'}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  const renderRoutinesContent = () => {
    const standaloneRoutines = routines.filter((r) => !r.program_id)
    return (
      <View style={styles.listContainer}>
        {renderGenerateRow('Create new routine', 'routine')}

        {standaloneRoutines.map(renderRoutineCard)}
      </View>
    )
  }

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={() => setShouldExit(true)}
                  style={styles.navButton}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerGlass={false}
            centerContent={<Text style={styles.headerTitle}>My Library</Text>}
            rightContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={() => {
                    haptic('light')
                    router.push(
                      activeTab === 'Programs'
                        ? '/create-program'
                        : '/create-routine',
                    )
                  }}
                  style={styles.navButton}
                >
                  <Ionicons
                    name="add"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            }
          />
        </BlurredHeader>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
            paddingTop: insets.top + 76,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderTabHeader()}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : (
            <>
              {activeTab === 'Programs' && renderProgramsContent()}
              {activeTab === 'Routines' && renderRoutinesContent()}
            </>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerBack: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    navButton: {
      padding: 8,
      borderRadius: 20,
    },
    headerAdd: {
      padding: 4,
    },
    tabHeaderContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 24,
      marginTop: 8,
      marginBottom: 24,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tabButton: {
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabButtonActive: {
      borderBottomColor: colors.textPrimary,
    },
    tabButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    tabButtonTextActive: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: 16,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 16,
    },
    listIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle || 'rgba(150,150,150,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    programImage: {
      width: '100%',
      height: '100%',
    },
    listTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    listTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    listSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    createRoutineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    createRoutineIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    createRoutineText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    generateIconWrapper: {
      width: 44,
      height: 44,
      position: 'relative',
    },
    generateIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    generateSparkleBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    routineCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    routineCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    routineCardTitleContainer: {
      flex: 1,
      minWidth: 0,
    },
    routineCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
      letterSpacing: -0.2,
    },
    routineCardSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    routineCardMenuButton: {
      padding: 4,
      marginTop: -2,
      marginRight: -4,
    },
    startRoutineButton: {
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startRoutineButtonDisabled: {
      opacity: 0.5,
    },
    startRoutineButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  })
