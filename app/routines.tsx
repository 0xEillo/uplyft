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
import { buildStructuredDraftFromRoutineTemplate } from '@/lib/utils/routine-structured-draft'
import { UserProgram, WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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

function showOptionMenu({
  title,
  options,
  cancelButtonIndex = 0,
  destructiveButtonIndex,
  isDark,
  onSelect,
}: {
  title?: string
  options: string[]
  cancelButtonIndex?: number
  destructiveButtonIndex?: number
  isDark: boolean
  onSelect: (index: number) => void
}) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        userInterfaceStyle: isDark ? 'dark' : 'light',
        title,
      },
      onSelect,
    )
    return
  }

  Alert.alert(
    title ?? '',
    undefined,
    options.map((text, index) => ({
      text,
      style:
        index === destructiveButtonIndex
          ? 'destructive'
          : index === cancelButtonIndex
          ? 'cancel'
          : 'default',
      onPress:
        index === cancelButtonIndex ? undefined : () => onSelect(index),
    })),
  )
}

interface ProgramSectionProps {
  program: UserProgram
  programRoutines: WorkoutRoutineWithDetails[]
  colors: ReturnType<typeof useThemedColors>
  isDark: boolean
  onOpenOptions: (program: UserProgram) => void
  renderRoutineCard: (
    routine: WorkoutRoutineWithDetails,
    nested?: boolean,
  ) => ReactNode
}

function ProgramSection({
  program,
  programRoutines,
  colors,
  isDark,
  onOpenOptions,
  renderRoutineCard,
}: ProgramSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const styles = useMemo(
    () => createProgramSectionStyles(colors, isDark),
    [colors, isDark],
  )

  const routinesLabel =
    programRoutines.length === 1
      ? '1 routine'
      : `${programRoutines.length} routines`

  const toggleExpanded = () => {
    haptic('light')
    setIsExpanded((prev) => !prev)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerMain}
          activeOpacity={0.85}
          onPress={toggleExpanded}
        >
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>
              {program.name}
            </Text>
            <Text style={styles.subtitle}>{routinesLabel}</Text>
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
            style={styles.chevron}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onOpenOptions(program)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.menuButton}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.routinesContainer}>
          {programRoutines.length > 0 ? (
            programRoutines.map((routine) => renderRoutineCard(routine, true))
          ) : (
            <Text style={styles.emptyText}>No routines yet</Text>
          )}
        </View>
      )}
    </View>
  )
}

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

  const editProgram = useCallback(
    (program: UserProgram) => {
      router.push({
        pathname: '/create-program',
        params: { programId: program.id },
      })
    },
    [router],
  )

  const createRoutineForProgram = useCallback(
    (program: UserProgram) => {
      router.push({
        pathname: '/create-routine',
        params: { programId: program.id },
      })
    },
    [router],
  )

  const assignRoutineToProgram = useCallback(
    async (routineId: string, targetProgramId: string) => {
      try {
        await database.workoutRoutines.update(routineId, {
          program_id: targetProgramId,
        })
        hapticSuccess()
        setRoutines((prev) =>
          prev.map((r) =>
            r.id === routineId ? { ...r, program_id: targetProgramId } : r,
          ),
        )
      } catch (error) {
        console.error('Error assigning routine to program:', error)
        Alert.alert('Error', 'Failed to add routine to program.')
      }
    },
    [],
  )

  const removeRoutineFromProgram = useCallback(
    async (routine: WorkoutRoutineWithDetails) => {
      try {
        await database.workoutRoutines.update(routine.id, { program_id: null })
        hapticSuccess()
        setRoutines((prev) =>
          prev.map((r) =>
            r.id === routine.id ? { ...r, program_id: null } : r,
          ),
        )
      } catch (error) {
        console.error('Error removing routine from program:', error)
        Alert.alert('Error', 'Failed to remove routine from program.')
      }
    },
    [],
  )

  const pickRoutineForProgram = useCallback(
    (program: UserProgram) => {
      const standaloneRoutines = routines.filter((r) => !r.program_id)
      if (standaloneRoutines.length === 0) {
        Alert.alert(
          'No Routines Available',
          'Create a standalone routine first, or add a new one to this program.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'New Routine',
              onPress: () => createRoutineForProgram(program),
            },
          ],
        )
        return
      }

      const options = [
        'Cancel',
        ...standaloneRoutines.map((r) => r.name),
      ]

      showOptionMenu({
        title: `Add to ${program.name}`,
        options,
        isDark,
        onSelect: (index) => {
          if (index === 0) return
          const routine = standaloneRoutines[index - 1]
          if (routine) void assignRoutineToProgram(routine.id, program.id)
        },
      })
    },
    [assignRoutineToProgram, createRoutineForProgram, isDark, routines],
  )

  const pickProgramForRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      if (programs.length === 0) {
        Alert.alert(
          'No Programs',
          'Create a program first to organize your routines.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create Program',
              onPress: () => router.push('/create-program'),
            },
          ],
        )
        return
      }

      const options = ['Cancel', ...programs.map((p) => p.name)]

      showOptionMenu({
        title: `Add "${routine.name}" to`,
        options,
        isDark,
        onSelect: (index) => {
          if (index === 0) return
          const program = programs[index - 1]
          if (program) void assignRoutineToProgram(routine.id, program.id)
        },
      })
    },
    [assignRoutineToProgram, isDark, programs, router],
  )

  const openCreateOptions = useCallback(() => {
    haptic('light')
    showOptionMenu({
      options: ['Cancel', 'New Routine', 'New Program'],
      isDark,
      onSelect: (index) => {
        if (index === 1) router.push('/create-routine')
        if (index === 2) router.push('/create-program')
      },
    })
  }, [isDark, router])

  const openRoutineOptions = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      haptic('light')
      const isInProgram = !!routine.program_id

      if (isInProgram) {
        showOptionMenu({
          title: routine.name,
          options: [
            'Cancel',
            'Edit Routine',
            'Remove from Program',
            'Delete Routine',
          ],
          destructiveButtonIndex: 3,
          isDark,
          onSelect: (index) => {
            if (index === 1) editRoutine(routine)
            if (index === 2) void removeRoutineFromProgram(routine)
            if (index === 3) deleteRoutine(routine)
          },
        })
        return
      }

      showOptionMenu({
        title: routine.name,
        options: ['Cancel', 'Edit Routine', 'Add to Program', 'Delete Routine'],
        destructiveButtonIndex: 3,
        isDark,
        onSelect: (index) => {
          if (index === 1) editRoutine(routine)
          if (index === 2) pickProgramForRoutine(routine)
          if (index === 3) deleteRoutine(routine)
        },
      })
    },
    [
      deleteRoutine,
      editRoutine,
      isDark,
      pickProgramForRoutine,
      removeRoutineFromProgram,
    ],
  )

  const deleteProgram = useCallback((program: UserProgram) => {
    Alert.alert(
      'Delete Program',
      `Are you sure you want to delete "${program.name}"? Its routines will be kept in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.userPrograms.delete(program.id)
              hapticSuccess()
              setPrograms((prev) => prev.filter((p) => p.id !== program.id))
              setRoutines((prev) =>
                prev.map((r) =>
                  r.program_id === program.id ? { ...r, program_id: null } : r,
                ),
              )
            } catch (error) {
              console.error('Error deleting program:', error)
              Alert.alert('Error', 'Failed to delete program. Please try again.')
            }
          },
        },
      ],
    )
  }, [])

  const openAddRoutineOptions = useCallback(
    (program: UserProgram) => {
      showOptionMenu({
        title: program.name,
        options: ['Cancel', 'Choose Existing', 'Create New'],
        isDark,
        onSelect: (index) => {
          if (index === 1) pickRoutineForProgram(program)
          if (index === 2) createRoutineForProgram(program)
        },
      })
    },
    [createRoutineForProgram, isDark, pickRoutineForProgram],
  )

  const openProgramOptions = useCallback(
    (program: UserProgram) => {
      haptic('light')
      showOptionMenu({
        title: program.name,
        options: ['Cancel', 'Add Routine', 'Edit Program', 'Delete Program'],
        destructiveButtonIndex: 3,
        isDark,
        onSelect: (index) => {
          if (index === 1) openAddRoutineOptions(program)
          if (index === 2) editProgram(program)
          if (index === 3) deleteProgram(program)
        },
      })
    },
    [
      deleteProgram,
      editProgram,
      isDark,
      openAddRoutineOptions,
    ],
  )

  const renderGenerateRow = () => (
    <TouchableOpacity
      style={styles.createRoutineRow}
      onPress={() => {
        haptic('light')
        router.push({ pathname: '/chat', params: { generate: 'routine' } })
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
      <Text style={styles.createRoutineText}>Create new</Text>
    </TouchableOpacity>
  )

  const renderRoutineCard = (
    routine: WorkoutRoutineWithDetails,
    nested = false,
  ) => {
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
        style={[styles.routineCard, nested && styles.nestedRoutineCard]}
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

  const renderProgramSection = (program: UserProgram) => {
    const programRoutines = routines
      .filter((r) => r.program_id === program.id)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )

    return (
      <ProgramSection
        key={program.id}
        program={program}
        programRoutines={programRoutines}
        colors={colors}
        isDark={isDark}
        onOpenOptions={openProgramOptions}
        renderRoutineCard={renderRoutineCard}
      />
    )
  }

  const renderLibraryContent = () => {
    const standaloneRoutines = routines.filter((r) => !r.program_id)

    return (
      <View style={styles.listContainer}>
        {renderGenerateRow()}

        {programs.map(renderProgramSection)}

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
                  onPress={openCreateOptions}
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
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : (
            renderLibraryContent()
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
      paddingTop: 8,
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
    nestedRoutineCard: {
      marginBottom: 8,
      shadowOpacity: 0,
      elevation: 0,
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

const createProgramSectionStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceCard,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: 14,
      paddingBottom: 14,
      paddingRight: 8,
    },
    headerMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingLeft: 16,
      minWidth: 0,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    chevron: {
      marginTop: 4,
    },
    menuButton: {
      padding: 4,
      marginTop: -2,
      marginRight: 4,
    },
    routinesContainer: {
      paddingHorizontal: 10,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
      fontStyle: 'italic',
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
  })
