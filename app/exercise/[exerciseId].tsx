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
import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { isRepBasedExercise } from '@/lib/exercise-standards-config'
import { getStrengthGender } from '@/lib/strength-progress'
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
  bestSetVolume: { weight: number; reps: number; volume: number } | null
  bestSessionVolume: number
}

const createEmptyExercisePerformanceSummary = (): ExercisePerformanceSummary => ({
  heaviestWeight: 0,
  best1RM: 0,
  bestSetVolume: null,
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

type TabType = 'records' | 'history' | 'how_to'

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

          let bestSetVolume = { weight: 0, reps: 0, volume: 0 }
          records.forEach((record) => {
            const volume = record.weight * record.maxReps
            if (volume > bestSetVolume.volume) {
              bestSetVolume = {
                weight: record.weight,
                reps: record.maxReps,
                volume,
              }
            }
          })

          nextExercisePerformance.bestSetVolume =
            bestSetVolume.volume > 0 ? bestSetVolume : null
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

  const getStrengthInfo = useCallback(() => {
    const strengthGender = getStrengthGender(profile?.gender)
    if (!strengthGender || !profile?.weight_kg || !exercise?.name) {
      return null
    }

    if (!hasStrengthStandards(exercise.name)) {
      return null
    }

    return getStrengthStandard(
      exercise.name,
      strengthGender,
      profile.weight_kg,
      max1RM,
    )
  }, [profile, exercise, max1RM])


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  
  const formatDateTime = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      })
  }

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
  const isRepBasedStrengthExercise =
    !!exercise?.name && isRepBasedExercise(exercise.name)
  const exerciseLevelMilestoneLabels = useMemo(() => {
    if (!exercise?.name || !profile?.weight_kg) return undefined
    const strengthGender = getStrengthGender(profile?.gender)
    if (!strengthGender) return undefined

    const ladder = getStandardsLadder(exercise.name, strengthGender)
    if (!ladder) return undefined

    const labels: Partial<Record<StrengthLevel, string>> = {}
    const weightKg = profile.weight_kg!
    ladder.forEach((standard) => {
      if (isRepBasedExercise(exercise.name)) {
        labels[standard.level] = `${Math.round(standard.multiplier)} reps`
        return
      }

      const targetWeightKg = Math.ceil(weightKg * standard.multiplier)
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
            {isOwner ? (
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
                  activeTab === 'how_to' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('how_to')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'how_to' && styles.activeTabText,
                  ]}
                >
                  How to
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
            contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + STICKY_HEIGHT }]}
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
            <View style={styles.tabContent}>
              {/* Media Section */}
              <View style={[styles.mediaContainer, !!exercise?.created_by && { backgroundColor: '#1A1A1A' }]}>
                  <ExerciseMedia 
                      gifUrl={exercise?.gif_url} 
                      mode="full" 
                      style={styles.media}
                      isCustom={!!exercise?.created_by}
                  />
              </View>

              {/* Stats Section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isViewingOwnStats ? 'Stats' : 'Performance Stats'}
                </Text>
              </View>

              <View style={styles.statsGrid}>
                {strengthInfo && (
                  <>
                    <TouchableOpacity
                      style={[styles.statRow, { alignItems: 'center' }]}
                      onPress={() => setShowLevelSheet(true)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.statLabel}>Levels</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.tapHint}>tap for levels</Text>
                        <LevelBadge
                          level={strengthInfo.level}
                          size="medium"
                          variant="pill"
                        />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.separator} />

                    {strengthInfo.nextLevel && (
                      <>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>
                            Next Level ({strengthInfo.nextLevel.level})
                          </Text>
                          <Text style={styles.statValue}>
                            {Math.round(strengthInfo.progress || 0)}%
                          </Text>
                        </View>
                        <View style={styles.separator} />
                      </>
                    )}
                  </>
                )}

                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>
                    {isRepBasedStrengthExercise ? 'Best Reps' : '1RM'}
                  </Text>
                  <Text style={styles.statValue}>
                    {isRepBasedStrengthExercise
                      ? `${Math.round(exercisePerformance.best1RM)} reps`
                      : formatWeight(exercisePerformance.best1RM, {
                          maximumFractionDigits: 1,
                        })}
                  </Text>
                </View>
                <View style={styles.separator} />
                
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Heaviest Weight</Text>
                  <Text style={styles.statValue}>
                    {formatWeight(exercisePerformance.heaviestWeight, {
                      maximumFractionDigits: 1,
                    })}
                  </Text>
                </View>
                <View style={styles.separator} />

                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Best Set</Text>
                  <Text style={styles.statValue}>
                    {exercisePerformance.bestSetVolume 
                        ? `${formatWeight(exercisePerformance.bestSetVolume.weight, { maximumFractionDigits: 0 })} x ${exercisePerformance.bestSetVolume.reps}` 
                        : '-'}
                  </Text>
                </View>
              </View>

              {/* All Records Section */}
              <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>Best Sets by Weight</Text>
              </View>

              <View style={styles.recordsList}>
                {recordsList.length === 0 ? (
                  <Text style={styles.emptyText}>No records found for this exercise yet.</Text>
                ) : (
                  recordsList.map((record, index) => (
                    <View key={index} style={styles.recordRow}>
                      <View style={styles.recordLeft}>
                        <Text style={styles.recordWeight}>
                          {formatWeight(record.weight, {
                            maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                          })}
                        </Text>
                        <Text style={styles.recordReps}>
                          {record.maxReps} rep{record.maxReps !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.recordRight}>
                        <Text style={styles.recordDate}>
                          {formatDate(record.date)}
                        </Text>
                        {record.estimated1RM > 0 && (
                          <Text style={styles.recordEstimate}>
                            {isRepBasedStrengthExercise
                              ? `Best reps: ${record.maxReps}`
                              : `1RM: ${formatWeight(record.estimated1RM, {
                                  maximumFractionDigits: 0,
                                })}`}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : activeTab === 'how_to' ? (
              <View style={styles.tabContent}>
                  {/* Media Section */}
                  <View style={[styles.mediaContainer, !!exercise?.created_by && { backgroundColor: '#1A1A1A' }]}>
                      <ExerciseMedia 
                          gifUrl={exercise?.gif_url} 
                          mode="full" 
                          style={styles.media}
                          isCustom={!!exercise?.created_by}
                      />
                  </View>

                  {/* Muscles Section */}
                  <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{exercise?.name}</Text>
                  </View>
                   <View style={styles.musclesSection}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {exercise?.muscle_group && (
                              <Text style={styles.musclesText}>{exercise.muscle_group}</Text>
                          )}
                          {exercise?.created_by && (
                              <View style={styles.customBadge}>
                                  <Text style={styles.customBadgeText}>Custom</Text>
                              </View>
                          )}
                      </View>
                      {exercise?.target_muscles && exercise.target_muscles.length > 0 && (
                          <Text style={styles.musclesText}>
                              Primary: <Text style={styles.muscleHighlight}>{exercise.target_muscles.join(', ')}</Text>
                          </Text>
                      )}
                      {exercise?.secondary_muscles && exercise.secondary_muscles.length > 0 && (
                          <Text style={styles.musclesText}>
                              Secondary: <Text style={styles.muscleHighlightSecondary}>{exercise.secondary_muscles.join(', ')}</Text>
                          </Text>
                      )}
                  </View>
                  
                  {/* Instructions Section */}
                  {exercise?.instructions && exercise.instructions.length > 0 && (
                  <>
                      <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                          <Text style={styles.sectionTitle}>Instructions</Text>
                      </View>
                      <View style={styles.instructionsContainer}>
                          {exercise.instructions.map((step, index) => {
                              const cleanStep = step.replace(/^Step:\d+\s*/i, '').trim()
                              return (
                                  <View key={index} style={styles.instructionStep}>
                                      <View style={styles.stepNumberContainer}>
                                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                                      </View>
                                      <Text style={styles.stepText}>{cleanStep}</Text>
                                  </View>
                              )
                          })}
                      </View>
                  </>
                  )}
              </View>
          ) : (
            <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Workout History</Text>
                </View>
                {history.length === 0 ? (
                    <Text style={styles.emptyText}>No history found for this exercise.</Text>
                ) : (
                    history.map((session, index) => (
                        <View key={index}>
                            <View style={styles.historyItem}>
                                <Text style={styles.historyDate}>{formatDateTime(session.date)}</Text>
                                <View style={styles.setsContainer}>
                                    <View style={styles.setHeader}>
                                        <Text style={styles.setHeaderText}>SET</Text>
                                        <Text style={styles.setHeaderText}>WEIGHT & REPS</Text>
                                    </View>
                                    {(() => {
                                      let workingSetNumber = 0
                                      return session.sets.map((set, setIndex) => {
                                        const isWarmup = set.is_warmup === true
                                        if (!isWarmup) {
                                          workingSetNumber += 1
                                        }
                                        const displayLabel = isWarmup
                                          ? 'W'
                                          : String(workingSetNumber)
    
                                        return (
                                        <View key={setIndex} style={styles.setRow}>
                                            <View style={styles.setNumberCell}>
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
                                                  {displayLabel}
                                                </Text>
                                              </View>
                                            </View>
                                            <Text style={styles.setDetails}>
                                              {formatLoggedSetSummary(
                                                set.weight,
                                                set.reps,
                                                formatWeight,
                                              )}
                                            </Text>
                                        </View>
                                        )
                                      })
                                    })()}
                                </View>
                            </View>
                            {index < history.length - 1 && <View style={styles.historySeparator} />}
                        </View>
                    ))
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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    musclesSection: {
      gap: 4,
    },
    statsGrid: {
      backgroundColor: colors.bg,
      borderRadius: 12,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
    },
    statLabel: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.brandPrimary,
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
    howToContainer: {
        flex: 1,
        gap: 24
    },
    mediaContainer: {
        aspectRatio: 6 / 5,
        backgroundColor: '#FFFFFF',
        // Negative margins to extend edge-to-edge (counteract tabContent padding)
        marginHorizontal: -16,
        marginTop: -16,
        marginBottom: 16,
    },
    media: {
        width: '100%',
        height: '100%',
    },
    sectionContainer: {
        gap: 4
    },
    howToTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4
    },
    musclesText: {
        fontSize: 16,
        color: colors.textSecondary
    },
    muscleHighlight: {
        color: colors.textPrimary
    },
    muscleHighlightSecondary: {
        color: colors.textPrimary
    },
    instructionsContainer: {
        gap: 16
    },
    instructionStep: {
        flexDirection: 'row',
        gap: 16,
        paddingRight: 8,
    },
    stepNumberContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.brandPrimary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -2, // Align with text cap height
    },
    stepNumberText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.brandPrimary,
    },
    stepText: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        lineHeight: 24,
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
    historySeparator: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.textSecondary,
        paddingVertical: 24,
    },
    historyItem: {
        backgroundColor: colors.bg,
        borderRadius: 12,
        paddingVertical: 16,
        gap: 12
    },
    historyHeader: {
    },
    historyDate: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    exerciseNameSmall: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary
    },
    setsContainer: {
        gap: 8
    },
    setHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4
    },
    setHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary
    },
    setRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    setNumber: {
        fontSize: 14,
        color: colors.textSecondary,
        width: 30,
        textAlign: 'center'
    },
    setNumberCell: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center'
    },
    setNumberBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    warmupBadge: {
        backgroundColor: `${colors.statusWarning}25`,
    },
    setNumberBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    warmupText: {
        color: colors.statusWarning,
    },
    setDetails: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary
    },
    recordsList: {
        backgroundColor: colors.bg,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingBottom: 8
    },
    recordRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 0,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    recordLeft: {
      gap: 3,
    },
    recordWeight: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    recordReps: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    recordRight: {
      alignItems: 'flex-end',
      gap: 3,
    },
    recordDate: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    recordEstimate: {
      fontSize: 12,
      color: colors.textSecondary,
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

    customBadge: {
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    customBadgeText: {
        color: '#FFF',
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
