import { BlurredHeader } from '@/components/blurred-header'
import { GlassIconButton } from '@/components/glass-icon-button'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'


import { ExerciseMedia } from '@/components/ExerciseMedia'
import {
  ExerciseProgressTab,
  ProgressRangeButton,
  type ProgressRange,
} from '@/components/ExerciseProgressTab'
import { buildMockProgressSessions } from '@/components/__mockProgressSessions'
import { ExerciseStrengthLevelCard } from '@/components/ExerciseStrengthLevelCard'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { coerceBodyweightKg } from '@/lib/bodyweight'
import { database } from '@/lib/database'
import { isRepBasedExercise } from '@/lib/exercise-standards-config'
import { estimateOneRepMaxKg, getStrengthGender } from '@/lib/strength-progress'
import {
  getStandardsLadder,
  getStrengthStandard,
  hasStrengthStandards,
  type StrengthLevel,
} from '@/lib/strength-standards'
import { uploadExerciseImage } from '@/lib/utils/exercise-image-upload'
import { Exercise, Profile } from '@/types/database.types'
import { Image as ExpoImage } from 'expo-image'


interface ExerciseRecord {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

interface WorkoutSessionRecord {
  date: string
  sets: {
    weight: number | null
    reps: number | null
    is_warmup: boolean
  }[]
}

interface ExercisePerformanceSummary {
  heaviestWeight: number
  best1RM: number
  bestSet: { weight: number; reps: number; strengthMetric: number } | null
  bestSessionVolume: number
}

const createEmptyExercisePerformanceSummary = (): ExercisePerformanceSummary => ({
  heaviestWeight: 0,
  best1RM: 0,
  bestSet: null,
  bestSessionVolume: 0,
})

const getSingleRouteParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value

const hasLoggedNumber = (
  value: number | null | undefined,
): value is number => typeof value === 'number' && !Number.isNaN(value)

const formatLoggedSetSummary = (
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  formatWeight: (
    valueKg: number | null | undefined,
    options?: Intl.NumberFormatOptions,
  ) => string,
) => {
  const hasWeight = hasLoggedNumber(weightKg) && weightKg > 0
  const hasReps = hasLoggedNumber(reps)

  if (hasWeight && hasReps) {
    return `${formatWeight(weightKg, {
      maximumFractionDigits: 1,
    })} x ${reps} reps`
  }

  if (hasReps) {
    return `${reps} reps`
  }

  if (hasWeight) {
    return formatWeight(weightKg, {
      maximumFractionDigits: 1,
    })
  }

  return '-'
}

type TabType = 'records' | 'history' | 'progress'

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
  'Cardio',
  'Full Body',
] as const

const EXERCISE_TYPES = ['compound', 'isolation'] as const

const EQUIPMENT_OPTIONS = [
  'barbell',
  'dumbbell',
  'bodyweight',
  'cable',
  'machine',
  'kettlebell',
  'resistance band',
  'other',
] as const

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{
    exerciseId: string | string[]
    statsUserId?: string | string[]
  }>()
  const exerciseId = getSingleRouteParam(params.exerciseId)
  const routeStatsUserId = getSingleRouteParam(params.statsUserId)
  const { user } = useAuth()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const router = useRouter()

  const statsUserId = routeStatsUserId || user?.id || null
  const isViewingOwnStats = !!user?.id && statsUserId === user.id

  const [profile, setProfile] = useState<Profile | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [max1RM, setMax1RM] = useState<number>(0)
  const [exercisePerformance, setExercisePerformance] =
    useState<ExercisePerformanceSummary>(createEmptyExercisePerformanceSummary)
  const [recordsList, setRecordsList] = useState<ExerciseRecord[]>([])
  const [history, setHistory] = useState<WorkoutSessionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('records')
  const [progressRange, setProgressRange] = useState<ProgressRange>('3M')
  const [shouldExit, setShouldExit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMuscleGroup, setEditMuscleGroup] = useState('')
  const [editType, setEditType] = useState('')
  const [editEquipment, setEditEquipment] = useState('')
  const [editImageUri, setEditImageUri] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [showMuscleGroupModal, setShowMuscleGroupModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [showLevelSheet, setShowLevelSheet] = useState(false)

  const insets = useSafeAreaInsets()
  const STICKY_HEIGHT = 120
  const loadRequestIdRef = useRef(0)

  // Check if current user owns this exercise
  const isOwner = exercise?.created_by === user?.id && user?.id



  const resetExerciseData = useCallback(() => {
    setProfile(null)
    setExercise(null)
    setMax1RM(0)
    setExercisePerformance(createEmptyExercisePerformanceSummary())
    setRecordsList([])
    setHistory([])
  }, [])

  const loadData = useCallback(
    async ({ isRefresh = false }: { isRefresh?: boolean } = {}) => {
      if (!statsUserId || !exerciseId) {
        resetExerciseData()
        setIsLoading(false)
        setRefreshing(false)
        return
      }

      const requestId = ++loadRequestIdRef.current

      if (!isRefresh) {
        setIsLoading(true)
        resetExerciseData()
      }

      try {
        const [profileData, exerciseData, records] = await Promise.all([
          database.profiles.getById(statsUserId),
          database.exercises.getById(exerciseId),
          database.stats.getExerciseRecordsByWeight(statsUserId, exerciseId),
        ])

        if (loadRequestIdRef.current !== requestId) return

        const isRepBased = isRepBasedExercise(exerciseData.name)
        let nextMax1RM = 0
        const nextRecordsList = records
        const nextExercisePerformance = createEmptyExercisePerformanceSummary()

        if (records.length > 0) {
          nextMax1RM = Math.max(
            ...records.map((record) =>
              isRepBased ? record.maxReps : record.estimated1RM,
            ),
          )
          nextExercisePerformance.best1RM = nextMax1RM
          nextExercisePerformance.heaviestWeight = Math.max(
            ...records.map((record) => record.weight),
          )

          let bestSet: { weight: number; reps: number; strengthMetric: number } | null = null
          records.forEach((record) => {
            const strengthMetric = isRepBased
              ? record.maxReps
              : record.estimated1RM

            if (
              !bestSet ||
              strengthMetric > bestSet.strengthMetric ||
              (strengthMetric === bestSet.strengthMetric &&
                record.weight > bestSet.weight) ||
              (strengthMetric === bestSet.strengthMetric &&
                record.weight === bestSet.weight &&
                record.maxReps > bestSet.reps)
            ) {
              bestSet = {
                weight: record.weight,
                reps: record.maxReps,
                strengthMetric,
              }
            }
          })

          nextExercisePerformance.bestSet = bestSet
        }

        let nextHistory: WorkoutSessionRecord[] = []
        if (exerciseId) {
          const historyData = await database.stats.getExerciseHistoryById(
            statsUserId,
            exerciseId,
          )

          if (loadRequestIdRef.current !== requestId) return

          let maxSessionVolume = 0
          type HistorySession = {
            date: string
            workout_exercises?: {
              exercise_id: string
              sets: {
                weight: number | null
                reps: number | null
                is_warmup: boolean
              }[]
            }[]
          }

          nextHistory = (historyData as unknown as HistorySession[])
            .map((session) => {
              let sessionVolume = 0
              const sessionSets: {
                weight: number | null
                reps: number | null
                is_warmup: boolean
              }[] = []

              session.workout_exercises?.forEach((workoutExercise) => {
                workoutExercise.sets?.forEach((set) => {
                  sessionSets.push({
                    weight: set.weight,
                    reps: set.reps,
                    is_warmup: set.is_warmup === true,
                  })

                  if (set.weight && set.reps) {
                    sessionVolume += set.weight * set.reps
                  }
                })
              })

              if (sessionVolume > maxSessionVolume) {
                maxSessionVolume = sessionVolume
              }

              return {
                date: session.date,
                sets: sessionSets,
              }
            })
            .reverse()

          nextExercisePerformance.bestSessionVolume = maxSessionVolume
        }

        if (loadRequestIdRef.current !== requestId) return

        setProfile(profileData)
        setExercise(exerciseData)
        setMax1RM(nextMax1RM)
        setExercisePerformance(nextExercisePerformance)
        setRecordsList(nextRecordsList)
        setHistory(nextHistory)
      } catch (error) {
        if (loadRequestIdRef.current !== requestId) return
        console.error('Error loading exercise details:', error)
      } finally {
        if (loadRequestIdRef.current !== requestId) return
        setIsLoading(false)
        setRefreshing(false)
      }
    },
    [exerciseId, resetExerciseData, statsUserId],
  )

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData({ isRefresh: true })
  }, [loadData])

  // Rank from the exact 1RM of the best set, like the strength score does.
  // The records list rounds each estimate to whole kilos.
  const strengthMetric = useMemo(() => {
    const bestSet = exercisePerformance.bestSet
    if (!bestSet || !exercise?.name) return max1RM
    return isRepBasedExercise(exercise.name)
      ? bestSet.reps
      : estimateOneRepMaxKg(bestSet.weight, bestSet.reps)
  }, [exercisePerformance.bestSet, exercise?.name, max1RM])

  const getStrengthInfo = useCallback(() => {
    const strengthGender = getStrengthGender(profile?.gender)
    const bodyweightKg = coerceBodyweightKg(profile?.weight_kg)
    if (!strengthGender || !bodyweightKg || !exercise?.name) {
      return null
    }

    if (!hasStrengthStandards(exercise.name)) {
      return null
    }

    return getStrengthStandard(
      exercise.name,
      strengthGender,
      bodyweightKg,
      strengthMetric,
    )
  }, [profile, exercise, strengthMetric])


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  
  const formatHistoryDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  const formatHistoryTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)')
    }
  }

  const handleDeleteExercise = () => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${exercise?.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id || !exerciseId) return
            
            setIsDeleting(true)
            try {
              await database.exercises.delete(exerciseId, user.id)
              // Navigate back after successful deletion
              setShouldExit(true)
            } catch (error) {
              console.error('Error deleting exercise:', error)
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete exercise. Please try again.'
              )
            } finally {
              setIsDeleting(false)
            }
          },
        },
      ]
    )
  }

  const handleOptionsPress = () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Options', 'Select an action', [
        { text: 'Edit Exercise', onPress: handleStartEdit },
        { text: 'Delete Exercise', onPress: handleDeleteExercise, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Edit Exercise', 'Delete Exercise'],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          handleStartEdit()
        } else if (buttonIndex === 2) {
          handleDeleteExercise()
        }
      },
    )
  }

  const handleStartEdit = () => {
    if (!exercise) return
    setEditName(exercise.name)
    setEditMuscleGroup(exercise.muscle_group || '')
    setEditType(exercise.type || '')
    setEditEquipment(exercise.equipment || '')
    setEditImageUri(null) // reset; current image shown from exercise.gif_url
    setIsEditing(true)
  }

  const handleUpdateExercise = async () => {
    if (!user?.id || !exerciseId) return

    if (!editName.trim()) {
      Alert.alert('Error', 'Exercise name cannot be empty')
      return
    }

    try {
      let newGifUrl: string | undefined = undefined

      // Upload new image if the user picked one
      if (editImageUri) {
        setIsUploadingImage(true)
        try {
          newGifUrl = await uploadExerciseImage(editImageUri, user.id, exerciseId)
        } finally {
          setIsUploadingImage(false)
        }
      }

      const updatedExercise = await database.exercises.update(
        exerciseId,
        user.id,
        {
          name: editName.trim(),
          muscle_group: editMuscleGroup || undefined,
          type: editType || undefined,
          equipment: editEquipment || undefined,
          ...(newGifUrl !== undefined ? { gif_url: newGifUrl } : {}),
        }
      )

      setExercise(updatedExercise)
      setEditImageUri(null)
      setIsEditing(false)
      Alert.alert('Success', 'Exercise updated successfully')
    } catch (error) {
      console.error('Error updating exercise:', error)
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update exercise'
      )
    }
  }

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload an exercise image.',
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets.length > 0) {
      setEditImageUri(result.assets[0].uri)
    }
  }

  const showMuscleGroupPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...MUSCLE_GROUPS],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setEditMuscleGroup(MUSCLE_GROUPS[buttonIndex - 1])
          }
        },
      )
    } else {
      setShowMuscleGroupModal(true)
    }
  }

  const showTypePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'Cancel',
            ...EXERCISE_TYPES.map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setEditType(EXERCISE_TYPES[buttonIndex - 1])
          }
        },
      )
    } else {
      setShowTypeModal(true)
    }
  }

  const showEquipmentPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'Cancel',
            ...EQUIPMENT_OPTIONS.map((e) => e.charAt(0).toUpperCase() + e.slice(1)),
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setEditEquipment(EQUIPMENT_OPTIONS[buttonIndex - 1])
          }
        },
      )
    } else {
      setShowEquipmentModal(true)
    }
  }

  const styles = createStyles(colors)
  const strengthInfo = getStrengthInfo()
  const strengthBodyweightKg = coerceBodyweightKg(profile?.weight_kg)
  const strengthLadder = useMemo(() => {
    const strengthGender = getStrengthGender(profile?.gender)
    if (!exercise?.name || !strengthGender) return null
    return getStandardsLadder(exercise.name, strengthGender)
  }, [exercise?.name, profile?.gender])
  const isRepBasedStrengthExercise =
    !!exercise?.name && isRepBasedExercise(exercise.name)
  const exerciseLevelMilestoneLabels = useMemo(() => {
    const bodyweightKg = coerceBodyweightKg(profile?.weight_kg)
    if (!exercise?.name || !bodyweightKg) return undefined
    const strengthGender = getStrengthGender(profile?.gender)
    if (!strengthGender) return undefined

    const ladder = getStandardsLadder(exercise.name, strengthGender)
    if (!ladder) return undefined

    const labels: Partial<Record<StrengthLevel, string>> = {}
    ladder.forEach((standard) => {
      if (isRepBasedExercise(exercise.name)) {
        labels[standard.level] = `${Math.round(standard.multiplier)} reps`
        return
      }

      const targetWeightKg = Math.ceil(bodyweightKg * standard.multiplier)
      const compactWeight = formatWeight(targetWeightKg, {
        maximumFractionDigits: 0,
      }).replace(/\s+/g, '')
      labels[standard.level] = compactWeight
    })

    return labels
  }, [exercise?.name, formatWeight, profile?.gender, profile?.weight_kg])


  return (
    <SlideInView
      style={styles.container}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={styles.innerContainer}>
        <BlurredHeader disableBlur style={[styles.blurredHeader, styles.opaqueHeader]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {exercise?.name || 'Exercise Details'}
              </Text>
            </View>
            <GlassIconButton icon="arrow-back" onPress={handleBack} color={colors.textPrimary} />
            {activeTab === 'progress' ? (
              <ProgressRangeButton
                range={progressRange}
                onChange={setProgressRange}
              />
            ) : isOwner ? (
              <GlassIconButton
                icon="ellipsis-horizontal"
                onPress={handleOptionsPress}
                color={colors.textPrimary}
                disabled={isDeleting}
              />
            ) : (
              <View style={styles.headerRightSpacer} />
            )}
          </View>

          <View style={styles.tabsBorder}>
            <View style={styles.tabsContent}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'records' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('records')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'records' && styles.activeTabText,
                  ]}
                >
                  Stats
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'history' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('history')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'history' && styles.activeTabText,
                  ]}
                >
                  History
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'progress' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('progress')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'progress' && styles.activeTabText,
                  ]}
                >
                  Progress
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </BlurredHeader>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingTop: insets.top + STICKY_HEIGHT },
            ]}
            scrollIndicatorInsets={{ top: insets.top + STICKY_HEIGHT }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.brandPrimary]}
                tintColor={colors.brandPrimary}
                progressViewOffset={insets.top + STICKY_HEIGHT}
              />
            }
          >
          {activeTab === 'records' ? (
            <View style={[styles.tabContent, styles.statsContent]}>
              {/* Media Section */}
              <View
                style={[
                  styles.mediaContainer,
                  isDark && styles.mediaContainerDark,
                  !!exercise?.created_by && { backgroundColor: '#1A1A1A' },
                ]}
              >
                  <ExerciseMedia 
                      gifUrl={exercise?.gif_url} 
                      mode="full" 
                      style={styles.media}
                      isCustom={!!exercise?.created_by}
                  />
                  {/* The artwork has a white background baked in; dim it a
                      little in dark mode so it doesn't glare. */}
                  {isDark && !exercise?.created_by ? (
                    <View pointerEvents="none" style={styles.mediaDarkScrim} />
                  ) : null}
              </View>

              {/* Personal Records */}
              <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Personal Records</Text>
              </View>

              <View style={styles.card}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>
                    {isRepBasedStrengthExercise ? 'Best Reps' : 'Best 1RM'}
                  </Text>
                  <Text style={styles.statValue}>
                    {exercisePerformance.best1RM > 0
                      ? isRepBasedStrengthExercise
                        ? `${Math.round(exercisePerformance.best1RM)} reps`
                        : formatWeight(exercisePerformance.best1RM, {
                            maximumFractionDigits: 1,
                          })
                      : '–'}
                  </Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Heaviest Weight</Text>
                  <Text style={styles.statValue}>
                    {exercisePerformance.heaviestWeight > 0
                      ? formatWeight(exercisePerformance.heaviestWeight, {
                          maximumFractionDigits: 1,
                        })
                      : '–'}
                  </Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Best Set</Text>
                  <Text style={styles.statValue}>
                    {exercisePerformance.bestSet
                      ? formatLoggedSetSummary(
                          exercisePerformance.bestSet.weight,
                          exercisePerformance.bestSet.reps,
                          formatWeight,
                        ).replace(' x ', ' × ')
                      : '–'}
                  </Text>
                </View>
                {exercisePerformance.bestSessionVolume > 0 && (
                  <>
                    <View style={styles.separator} />
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Best Session Volume</Text>
                      <Text style={styles.statValue}>
                        {formatWeight(exercisePerformance.bestSessionVolume, {
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              </View>

              {/* Strength Level */}
              {strengthInfo && strengthLadder && strengthBodyweightKg ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Strength Level</Text>
                  </View>
                  <ExerciseStrengthLevelCard
                    level={strengthInfo.level}
                    nextLevel={strengthInfo.nextLevel}
                    progress={strengthInfo.progress}
                    ladder={strengthLadder}
                    bestValue={strengthMetric}
                    bodyweightKg={strengthBodyweightKg}
                    isRepBased={isRepBasedStrengthExercise}
                    isViewingOwnStats={isViewingOwnStats}
                    formatWeight={formatWeight}
                    onOpenLevels={() => setShowLevelSheet(true)}
                  />
                </View>
              ) : null}

              {/* Best Sets by Weight */}
              <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Best Sets by Weight</Text>
              </View>

              <View style={styles.card}>
                {recordsList.length === 0 ? (
                  <Text style={styles.emptyText}>No sets logged yet</Text>
                ) : (
                  recordsList.map((record, index) => (
                    <View
                      key={index}
                      style={[
                        styles.recordRow,
                        index === recordsList.length - 1 && styles.recordRowLast,
                      ]}
                    >
                      <View style={styles.recordLeft}>
                        <Text style={styles.recordWeight}>
                          {formatWeight(record.weight, {
                            maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                          })}
                          {` × ${record.maxReps} rep${record.maxReps === 1 ? '' : 's'}`}
                        </Text>
                        <Text style={styles.recordDate}>
                          {formatDate(record.date)}
                        </Text>
                      </View>
                      {record.estimated1RM > 0 && !isRepBasedStrengthExercise && (
                        <View style={styles.recordRight}>
                          <Text style={styles.recordEstimate}>
                            {formatWeight(record.estimated1RM, {
                              maximumFractionDigits: 0,
                            })}
                          </Text>
                          <Text style={styles.recordEstimateLabel}>Est. 1RM</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
              </View>
            </View>
          ) : activeTab === 'progress' ? (
            <View style={styles.tabContent}>
              <ExerciseProgressTab
                sessions={buildMockProgressSessions()}
                isRepBased={isRepBasedStrengthExercise}
                range={progressRange}
              />
            </View>
          ) : (
            <View style={styles.tabContent}>
              {history.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>
                    No workouts logged yet
                  </Text>
                </View>
              ) : (
                history.map((session, index) => {
                  const workingSets = session.sets.filter(
                    (set) => !set.is_warmup,
                  )
                  const sessionVolume = workingSets.reduce(
                    (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
                    0,
                  )
                  let workingSetNumber = 0
                  return (
                    <View key={index} style={styles.card}>
                      <View style={styles.historyHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyDate}>
                            {formatHistoryDate(session.date)}
                          </Text>
                          <Text style={styles.historyTime}>
                            {formatHistoryTime(session.date)}
                          </Text>
                        </View>
                        <Text style={styles.historySummary}>
                          {workingSets.length} set
                          {workingSets.length === 1 ? '' : 's'}
                          {sessionVolume > 0
                            ? ` · ${formatWeight(sessionVolume, {
                                maximumFractionDigits: 0,
                              })}`
                            : ''}
                        </Text>
                      </View>
                      <View style={styles.historySets}>
                      {session.sets.map((set, setIndex) => {
                        const isWarmup = set.is_warmup === true
                        if (!isWarmup) workingSetNumber += 1
                        return (
                          <View key={setIndex} style={styles.setRow}>
                            <View
                              style={[
                                styles.setNumberBadge,
                                isWarmup && styles.warmupBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.setNumberBadgeText,
                                  isWarmup && styles.warmupText,
                                ]}
                              >
                                {isWarmup ? 'W' : workingSetNumber}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.setDetails,
                                isWarmup && styles.setDetailsWarmup,
                              ]}
                            >
                              {formatLoggedSetSummary(
                                set.weight,
                                set.reps,
                                formatWeight,
                              ).replace(' x ', ' × ')}
                            </Text>
                          </View>
                        )
                      })}
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          )}
          </ScrollView>
        )}


        <Modal
          visible={isEditing}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsEditing(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContainer, { backgroundColor: colors.bg }]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text style={styles.modalCancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Exercise</Text>
              <TouchableOpacity onPress={handleUpdateExercise}>
                <Text style={styles.modalSaveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
               {/* Exercise Name */}
               <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Exercise Name"
                  placeholderTextColor={colors.textPlaceholder}
                />
              </View>

              {/* Muscle Group */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Muscle Group</Text>
                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={showMuscleGroupPicker}
                >
                  <Text
                    style={[
                      styles.selectButtonText,
                      { color: editMuscleGroup ? colors.textPrimary : colors.textPlaceholder }
                    ]}
                  >
                    {editMuscleGroup || 'Select muscle group'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Exercise Type */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Type</Text>
                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={showTypePicker}
                >
                  <Text
                     style={[
                      styles.selectButtonText,
                      { color: editType ? colors.textPrimary : colors.textPlaceholder }
                    ]}
                  >
                    {editType
                      ? editType.charAt(0).toUpperCase() + editType.slice(1)
                      : 'Select type'}
                  </Text>
                   <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Equipment */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Equipment</Text>
                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={showEquipmentPicker}
                >
                  <Text
                     style={[
                      styles.selectButtonText,
                      { color: editEquipment ? colors.textPrimary : colors.textPlaceholder }
                    ]}
                  >
                    {editEquipment
                      ? editEquipment.charAt(0).toUpperCase() + editEquipment.slice(1)
                      : 'Select equipment'}
                  </Text>
                   <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Exercise Photo */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Exercise Photo</Text>
                <TouchableOpacity
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                  style={styles.imagePickerContainer}
                >
                  {editImageUri ? (
                    <ExpoImage
                      source={{ uri: editImageUri }}
                      style={styles.imagePickerPreview}
                      contentFit="cover"
                    />
                  ) : exercise?.gif_url ? (
                    <ExerciseMedia
                      gifUrl={exercise.gif_url}
                      mode="thumbnail"
                      style={styles.imagePickerPreview}
                      contentFit="cover"
                      autoPlay={false}
                    />
                  ) : (
                    <View style={[styles.imagePickerPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="image-outline" size={36} color={colors.textTertiary} />
                      <Text style={[styles.imagePickerPlaceholderText, { color: colors.textTertiary }]}>
                        No photo yet
                      </Text>
                    </View>
                  )}

                  <View style={styles.imagePickerOverlay}>
                    <View style={styles.imagePickerCameraButton}>
                      <Ionicons name="camera" size={18} color="#ffffff" />
                      <Text style={styles.imagePickerCameraText}>
                        {editImageUri || exercise?.gif_url ? 'Change Photo' : 'Add Photo'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {isUploadingImage && (
                  <View style={styles.imageUploadingRow}>
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                    <Text style={[styles.imageUploadingText, { color: colors.textSecondary }]}>
                      Uploading photo...
                    </Text>
                  </View>
                )}

                <Text style={[styles.imagePickerHint, { color: colors.textTertiary }]}>
                  Tap to choose a photo from your library
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Android Modals */}
        {Platform.OS === 'android' && (
        <>
          {/* Muscle Group Modal */}
          <Modal
            visible={showMuscleGroupModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMuscleGroupModal(false)}
          >
            <Pressable
              style={styles.androidModalOverlay}
              onPress={() => setShowMuscleGroupModal(false)}
            >
              <View style={[styles.androidModalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.androidModalTitle, { color: colors.textPrimary, borderColor: colors.border }]}>Select Muscle Group</Text>
                <ScrollView style={styles.androidModalScroll}>
                  {MUSCLE_GROUPS.map((group) => (
                    <TouchableOpacity
                      key={group}
                      style={[styles.androidModalOption, { borderColor: colors.border }]}
                      onPress={() => {
                        setEditMuscleGroup(group)
                        setShowMuscleGroupModal(false)
                      }}
                    >
                      <Text style={[styles.androidModalOptionText, { color: colors.textPrimary }]}>{group}</Text>
                      {editMuscleGroup === group && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.brandPrimary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Type Modal */}
          <Modal
            visible={showTypeModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTypeModal(false)}
          >
             <Pressable
              style={styles.androidModalOverlay}
              onPress={() => setShowTypeModal(false)}
            >
              <View style={[styles.androidModalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.androidModalTitle, { color: colors.textPrimary, borderColor: colors.border }]}>Select Exercise Type</Text>
                <ScrollView style={styles.androidModalScroll}>
                  {EXERCISE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.androidModalOption, { borderColor: colors.border }]}
                      onPress={() => {
                        setEditType(type)
                        setShowTypeModal(false)
                      }}
                    >
                      <Text style={[styles.androidModalOptionText, { color: colors.textPrimary }]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                      {editType === type && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.brandPrimary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Equipment Modal */}
          <Modal
            visible={showEquipmentModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowEquipmentModal(false)}
          >
             <Pressable
              style={styles.androidModalOverlay}
              onPress={() => setShowEquipmentModal(false)}
            >
              <View style={[styles.androidModalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.androidModalTitle, { color: colors.textPrimary, borderColor: colors.border }]}>Select Equipment</Text>
                <ScrollView style={styles.androidModalScroll}>
                  {EQUIPMENT_OPTIONS.map((equip) => (
                    <TouchableOpacity
                      key={equip}
                      style={[styles.androidModalOption, { borderColor: colors.border }]}
                      onPress={() => {
                        setEditEquipment(equip)
                        setShowEquipmentModal(false)
                      }}
                    >
                      <Text style={[styles.androidModalOptionText, { color: colors.textPrimary }]}>
                        {equip.charAt(0).toUpperCase() + equip.slice(1)}
                      </Text>
                      {editEquipment === equip && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.brandPrimary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        </>
      )}
      </View>
      <LifterLevelsSheet
        isVisible={showLevelSheet}
        onClose={() => setShowLevelSheet(false)}
        currentLevel={strengthInfo?.level || 'Beginner'}
        title={exercise?.name}
        levelMilestoneLabels={exerciseLevelMilestoneLabels}
        showMilestones
      />
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    innerContainer: {
      flex: 1,
    },
    headerActionButton: {
        padding: 8,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    modalCancelButton: {
        fontSize: 16,
        color: colors.brandPrimary,
    },
    modalSaveButton: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.brandPrimary,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    inputSection: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    input: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
    },
    selectButton: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
    },
    selectButtonText: {
        fontSize: 16,
    },
    androidModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    androidModalContent: {
      borderRadius: 16,
      width: '100%',
      maxHeight: '70%',
      overflow: 'hidden',
    },
    androidModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      padding: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    androidModalScroll: {
      maxHeight: 400,
    },
    androidModalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    androidModalOptionText: {
      fontSize: 16,
    },
    blurredHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    opaqueHeader: {
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerBackButton: {
      padding: 4,
      marginLeft: -4,
    },
    headerTitleContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 80,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerRightSpacer: {
      width: 40,
    },
    headerDeleteButton: {
      padding: 4,
      marginRight: -4,
    },
    tabsBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabs: {
      flexGrow: 0,
    },
    tabsContent: {
      flexDirection: 'row',
      paddingHorizontal: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: colors.brandPrimary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.brandPrimary,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 16,
    },
    statsContent: {
      gap: 24,
    },
    section: {
      gap: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 15,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    statLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 16,
      gap: 16,
    },
    infoCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoStep: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    infoContent: {
      flex: 1,
    },
    infoText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    levelCard: {
        backgroundColor: colors.bg,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        gap: 12
    },
    levelBadgeLarge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 8
    },
    levelBadgeTextLarge: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16
    },
    levelDescription: {
        fontSize: 14,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 8
    },
    progressBarContainer: {
        width: '100%',
        gap: 8
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden'
    },
    mediaContainer: {
        aspectRatio: 6 / 5,
        backgroundColor: '#FFFFFF',
        // Negative margins to extend edge-to-edge (counteract tabContent padding)
        marginHorizontal: -16,
        marginTop: -16,
    },
    mediaDarkScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.22)',
    },
    // On a black page the white exercise artwork reads as a glaring band,
    // so in dark mode it sits inset as a rounded tile like the cards.
    mediaContainerDark: {
        marginHorizontal: 0,
        marginTop: 0,
        borderRadius: 18,
        overflow: 'hidden',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    sectionContainer: {
        gap: 4
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4
    },
    progressText: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center'
    },
    historyContainer: {
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 15,
        color: colors.textSecondary,
        paddingVertical: 24,
    },
    exerciseNameSmall: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary
    },
    historySets: {
      paddingVertical: 3,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    historyDate: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    historyTime: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textTertiary,
      marginTop: 2,
    },
    historySummary: {
      lineHeight: 21,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
    },
    setNumberBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setNumberBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    setDetails: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    setDetailsWarmup: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    warmupBadge: {
        backgroundColor: `${colors.statusWarning}25`,
    },
    warmupText: {
        color: colors.statusWarning,
    },
    recordRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    recordRowLast: {
      borderBottomWidth: 0,
    },
    recordLeft: {
      gap: 3,
    },
    recordWeight: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    recordRight: {
      alignItems: 'flex-end',
      gap: 3,
    },
    recordDate: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '500',
    },
    recordEstimateLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    recordEstimate: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    tapHint: {
      fontSize: 12,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    levelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    levelText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },


    // Image picker styles
    imagePickerContainer: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    imagePickerPreview: {
      width: '100%',
      height: '100%',
    },
    imagePickerPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed' as const,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    imagePickerPlaceholderText: {
      fontSize: 13,
      fontWeight: '500',
    },
    imagePickerOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(0,0,0,0.45)',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    imagePickerCameraButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    imagePickerCameraText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
    },
    imageUploadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    imageUploadingText: {
      fontSize: 13,
    },
    imagePickerHint: {
      fontSize: 12,
      marginTop: 6,
      lineHeight: 16,
    },
  })
