import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Paywall } from '@/components/paywall'
import { RoutineExerciseCard } from '@/components/RoutineExerciseCard'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { hapticSuccess } from '@/lib/haptics'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import {
  ExploreProgramWithRoutines,
  WorkoutRoutineWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ProgramSource = 'user' | 'explore'

interface NormalizedSet {
  id: string
  setNumber: number
  repsMin: number | null
  repsMax: number | null
  restSeconds: number | null
}

interface NormalizedExercise {
  id: string
  exerciseId: string
  name: string
  gifUrl: string | null
  orderIndex: number
  sets: NormalizedSet[]
}

interface NormalizedRoutine {
  id: string
  name: string
  imagePath: string | null
  exercises: NormalizedExercise[]
}

interface NormalizedProgram {
  id: string
  name: string
  description: string | null
  imagePath: string | null
  goal: string | null
  level: string | null
  source: ProgramSource
  isOwner: boolean
  routines: NormalizedRoutine[]
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function formatGoalLabel(goal: string | null) {
  if (!goal) return null
  switch (goal) {
    case 'build_muscle': return 'Build muscle'
    case 'gain_strength':
    case 'get_stronger': return 'Gain strength'
    case 'lose_fat': return 'Lose fat'
    case 'improve_cardio': return 'Improve cardio'
    case 'become_flexible': return 'Become flexible'
    case 'general_fitness': return 'General fitness'
    default:
      return goal.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

function formatLevelLabel(level: ExploreProgramWithRoutines['level']) {
  if (!level) return null
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function normalizeExploreProgram(p: ExploreProgramWithRoutines): NormalizedProgram {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imagePath: p.routines[0]?.image_url ?? null,
    goal: p.goal,
    level: p.level,
    source: 'explore',
    isOwner: false,
    routines: p.routines.map((r) => ({
      id: r.id,
      name: r.name,
      imagePath: r.image_url,
      exercises: r.exercises
        .sort((a, b) => a.order_index - b.order_index)
        .map((ex) => ({
          id: ex.id,
          exerciseId: ex.exercise_id,
          name: ex.exercise?.name ?? 'Unknown Exercise',
          gifUrl: ex.exercise?.gif_url ?? null,
          orderIndex: ex.order_index,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            id: `${ex.id}-set-${i + 1}`,
            setNumber: i + 1,
            repsMin: ex.reps_min,
            repsMax: ex.reps_max,
            restSeconds: null,
          })),
        })),
    })),
  }
}

function normalizeUserProgram(
  p: { id: string; name: string; description: string | null; image_path: string | null },
  routines: WorkoutRoutineWithDetails[],
  userId: string,
): NormalizedProgram {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imagePath: p.image_path ?? routines[0]?.image_path ?? null,
    goal: null,
    level: null,
    source: 'user',
    isOwner: true,
    routines: routines.map((r) => ({
      id: r.id,
      name: r.name,
      imagePath: r.image_path,
      exercises: (r.workout_routine_exercises ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((ex) => ({
          id: ex.id,
          exerciseId: ex.exercise_id,
          name: ex.exercise?.name ?? 'Unknown Exercise',
          gifUrl: ex.exercise?.gif_url ?? null,
          orderIndex: ex.order_index,
          sets: (ex.sets ?? [])
            .sort((a, b) => a.set_number - b.set_number)
            .map((s) => ({
              id: s.id,
              setNumber: s.set_number,
              repsMin: s.reps_min,
              repsMax: s.reps_max,
              restSeconds: s.rest_seconds,
            })),
        })),
    })),
  }
}

export default function ProgramDetailScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { isProMember } = useSubscription()

  const [program, setProgram] = useState<NormalizedProgram | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [isSavingProgram, setIsSavingProgram] = useState(false)
  const [savedProgramId, setSavedProgramId] = useState<string | null>(null)

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  useEffect(() => {
    if (!programId) return
    let isMounted = true

    const load = async () => {
      try {
        // Try user program first
        if (user) {
          try {
            const userProg = await database.userPrograms.getById(programId, user.id)
            if (userProg && isMounted) {
              const allRoutines = await database.workoutRoutines.getAll(user.id)
              const progRoutines = allRoutines
                .filter((r) => r.program_id === programId)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              setProgram(normalizeUserProgram(userProg, progRoutines, user.id))
              return
            }
          } catch {
            // not a user program, fall through
          }
        }

        // Fall back to explore program
        const [exploreData, userPrograms] = await Promise.all([
          database.explore.getProgramById(programId),
          user ? database.userPrograms.getAll(user.id) : Promise.resolve([]),
        ])
        if (!isMounted) return
        setProgram(normalizeExploreProgram(exploreData))
        const match = userPrograms.find(
          (up) =>
            normalizeText(up.name) === normalizeText(exploreData.name) &&
            normalizeText(up.description) === normalizeText(exploreData.description),
        )
        setSavedProgramId(match?.id ?? null)
      } catch (error) {
        console.error('Error loading program:', error)
        if (isMounted) Alert.alert('Error', 'Failed to load program details')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [programId, user])

  const handleBack = () => setShouldExit(true)
  const handleExitComplete = () => router.back()

  const handleSaveProgram = useCallback(async () => {
    if (!program || !user) {
      Alert.alert('Sign In Required', 'Please create an account to save programs.')
      return
    }
    if (!isProMember) {
      setShowPaywall(true)
      return
    }
    try {
      setIsSavingProgram(true)
      const saved = await database.explore.saveProgramToUser(program.id, user.id)
      setSavedProgramId(saved.program.id)
      hapticSuccess()
      Alert.alert('Saved', 'Program saved to your library!')
    } catch (error) {
      console.error('Error saving program:', error)
      Alert.alert('Error', 'Failed to save program')
    } finally {
      setIsSavingProgram(false)
    }
  }, [isProMember, program, user])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    )
  }

  if (!program) return null

  const goalLabel = formatGoalLabel(program.goal)
  const levelLabel = formatLevelLabel(program.level as ExploreProgramWithRoutines['level'])
  const creatorLabel =
    program.source === 'user'
      ? 'Your Program'
      : [levelLabel, goalLabel].filter(Boolean).join(' • ') || 'Training Program'

  const coverImageUrl = program.imagePath ? getRoutineImageUrl(program.imagePath) : null

  const uniqueEquipment = Array.from(
    new Set(
      program.routines.flatMap((r) =>
        r.exercises.map((e) => e.name),
      ),
    ),
  )
  const totalExercises = program.routines.reduce((sum, r) => sum + r.exercises.length, 0)

  return (
    <SlideInView
      style={styles.container}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerGlass={false}
            centerContent={<Text style={styles.headerTitle}>Program</Text>}
          />
        </BlurredHeader>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100, paddingTop: insets.top + 76 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover Image */}
          <View style={styles.coverContainer}>
            {coverImageUrl ? (
              <>
                <Image
                  source={{ uri: coverImageUrl as string }}
                  style={styles.coverImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="high"
                  transition={200}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                  style={styles.coverOverlay}
                />
              </>
            ) : (
              <LinearGradient
                colors={[`${colors.brandPrimary}60`, `${colors.brandPrimary}30`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.coverGradientOnly}
              />
            )}
          </View>

          {/* Program Info */}
          <View style={styles.infoSection}>
            <Text style={[styles.programName, { color: colors.textPrimary }]}>
              {program.name}
            </Text>
            <Text style={[styles.creatorLabel, { color: colors.textSecondary }]}>
              {creatorLabel}
            </Text>

            {program.description ? (
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {program.description}
              </Text>
            ) : null}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {program.routines.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Workouts
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {totalExercises}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Exercises
                </Text>
              </View>
            </View>

            {/* Save Button — explore only */}
            {program.source === 'explore' && (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: savedProgramId
                      ? colors.surfaceCard
                      : colors.brandPrimary,
                  },
                  (isSavingProgram || !!savedProgramId) && { opacity: 0.7 },
                ]}
                onPress={handleSaveProgram}
                disabled={isSavingProgram || !!savedProgramId}
              >
                {isSavingProgram ? (
                  <ActivityIndicator color="#fff" />
                ) : savedProgramId ? (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.textPrimary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.primaryButtonText, { color: colors.textPrimary }]}>
                      Saved
                    </Text>
                  </>
                ) : (
                  <Text style={styles.primaryButtonText}>Save Program</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Routines List */}
          <View style={styles.routinesListContainer}>
            {program.routines.map((routine) => (
              <View key={routine.id} style={styles.activeRoutineContainer}>
                <View style={styles.activeRoutineHeader}>
                  <View style={styles.activeRoutineImageContainer}>
                    {routine.imagePath ? (
                      <Image
                        source={{ uri: getRoutineImageUrl(routine.imagePath) as string }}
                        style={styles.routineImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.routineImage, { backgroundColor: colors.surfaceCard }]} />
                    )}
                  </View>
                  <Text style={styles.activeRoutineTitle}>{routine.name}</Text>
                </View>

                <View style={styles.exercisesSection}>
                  {routine.exercises.length > 0 ? (
                    <LiquidGlassSurface
                      style={styles.exerciseListGlass}
                      fallbackStyle={styles.exerciseListFallback}
                    >
                      {routine.exercises.map((ex, idx) => (
                        <RoutineExerciseCard
                          key={ex.id}
                          exercise={ex}
                          onExercisePress={(id) =>
                            router.push({
                              pathname: '/exercise/[exerciseId]',
                              params: { exerciseId: id },
                            })
                          }
                          asRow
                          isLast={idx === routine.exercises.length - 1}
                        />
                      ))}
                    </LiquidGlassSurface>
                  ) : (
                    <Text style={[styles.emptyExercisesText, { color: colors.textSecondary }]}>
                      No exercises added
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Unlock PRO training programs"
        message="Get instant access to structured, multi-week training programs designed by experts."
      />
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    scrollContent: {},
    coverContainer: {
      height: 180,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    coverOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    coverGradientOnly: {
      flex: 1,
    },
    infoSection: {
      paddingHorizontal: 16,
      paddingTop: 20,
      marginBottom: 24,
    },
    programName: {
      fontSize: 32,
      fontWeight: '900',
      marginBottom: 6,
      letterSpacing: -1,
    },
    creatorLabel: {
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 16,
    },
    descriptionText: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 24,
      fontWeight: '400',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginBottom: 24,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
    },
    statDivider: {
      width: 1,
      height: 24,
      marginHorizontal: 8,
    },
    primaryButton: {
      flexDirection: 'row',
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    routineImage: {
      width: '100%',
      height: '100%',
    },
    routinesListContainer: {
      paddingHorizontal: 16,
      gap: 28,
      paddingTop: 4,
    },
    activeRoutineContainer: {
      gap: 16,
    },
    activeRoutineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    activeRoutineImageContainer: {
      width: 64,
      height: 64,
      borderRadius: 8,
      overflow: 'hidden',
    },
    activeRoutineTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    exercisesSection: {
      paddingHorizontal: 0,
    },
    emptyExercisesText: {
      textAlign: 'center',
      marginTop: 8,
    },
    exerciseListGlass: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    exerciseListFallback: {
      backgroundColor: isDark ? 'rgba(26,26,28,0.94)' : 'rgba(255,255,255,0.94)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 20,
      elevation: 8,
    },
  })
