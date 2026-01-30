import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
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
import { Paywall } from '@/components/paywall'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { getLevelColor } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import {
  getStandardsLadder,
  getStrengthStandard,
  hasStrengthStandards,
  type StrengthLevel
} from '@/lib/strength-standards'
import { Exercise, Profile } from '@/types/database.types'

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

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  userTag: string
  avatarUrl: string | null
  max1RM: number
  isCurrentUser: boolean
  strengthLevel: StrengthLevel | null
}

type TabType = 'level' | 'records' | 'history' | 'leaderboard' | 'how_to'

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
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>()
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [max1RM, setMax1RM] = useState<number>(0)
  const [personalRecords, setPersonalRecords] = useState<{
    heaviestWeight: number
    best1RM: number
    bestSetVolume: { weight: number; reps: number; volume: number } | null
    bestSessionVolume: number
  }>({
    heaviestWeight: 0,
    best1RM: 0,
    bestSetVolume: null,
    bestSessionVolume: 0,
  })
  const [recordsList, setRecordsList] = useState<ExerciseRecord[]>([])
  const [history, setHistory] = useState<WorkoutSessionRecord[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('records')
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMuscleGroup, setEditMuscleGroup] = useState('')
  const [editType, setEditType] = useState('')
  const [editEquipment, setEditEquipment] = useState('')
  const [showMuscleGroupModal, setShowMuscleGroupModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)

  const insets = useSafeAreaInsets()

  // Check if current user owns this exercise
  const isOwner = exercise?.created_by === user?.id && user?.id

  // Check if this exercise has strength standards (for rank tracking)
  const exerciseHasRankTracking = exercise?.name ? hasStrengthStandards(exercise.name) : false

  const loadData = useCallback(async () => {
    if (!user?.id || !exerciseId) return

    try {
      // Load profile
      const profileData = await database.profiles.getById(user.id)
      setProfile(profileData)

      // Load exercise details
      const exerciseData = await database.exercises.getById(exerciseId)
      console.log('Loaded exercise:', exerciseData?.name, 'GIF:', exerciseData?.gif_url)
      setExercise(exerciseData)

      // Load max 1RM
      const records = await database.stats.getExerciseRecordsByWeight(
        user.id,
        exerciseId,
      )
      if (records.length > 0) {
        setRecordsList(records)
        const best1RM = Math.max(...records.map((r) => r.estimated1RM))
        const heaviestWeight = Math.max(...records.map((r) => r.weight))
        setMax1RM(best1RM)
        
        // Calculate other PRs
        // Best Set Volume
        let bestSetVol = { weight: 0, reps: 0, volume: 0 }
        records.forEach(r => {
            const vol = r.weight * r.maxReps
            if(vol > bestSetVol.volume) {
                bestSetVol = { weight: r.weight, reps: r.maxReps, volume: vol }
            }
        })

        setPersonalRecords(prev => ({
            ...prev,
            heaviestWeight,
            best1RM,
            bestSetVolume: bestSetVol.volume > 0 ? bestSetVol : null
        }))
      }

      // Load History (Sessions)
      if (exerciseData && exerciseData.name) {
        const historyData = await database.stats.getExerciseHistory(
          user.id,
          exerciseData.name,
        )
        
        // Calculate Best Session Volume from history
        let maxSessionVol = 0
        type HistorySession = {
          date: string
          workout_exercises?: {
            exercise: { name: string }
            sets: { weight: number | null; reps: number | null; is_warmup: boolean }[]
          }[]
        }
        const formattedHistory = (historyData as unknown as HistorySession[]).map((session) => {
            let sessionVol = 0
            const sessionSets: { weight: number | null; reps: number | null; is_warmup: boolean }[] = []
            
            session.workout_exercises?.forEach((we) => {
                we.sets?.forEach((set) => {
                    sessionSets.push({ weight: set.weight, reps: set.reps, is_warmup: set.is_warmup === true })
                    if(set.weight && set.reps) {
                        sessionVol += (set.weight * set.reps)
                    }
                })
            })

            if(sessionVol > maxSessionVol) maxSessionVol = sessionVol

            return {
                date: session.date,
                sets: sessionSets
            }
        }).reverse() // Newest first

        setHistory(formattedHistory)
        setPersonalRecords(prev => ({ ...prev, bestSessionVolume: maxSessionVol }))
      }

      // Load Leaderboard Data
      // 1. Get following list
      const following = await database.follows.listFollowing(user.id)
      // Note: followingIds would be used for batch queries in future
      const _followingIds = following.map(f => f.followee_id)
      void _followingIds // suppress unused warning - reserved for batch queries

      // 3. Get max estimated 1RM (Epley) for each user on this exercise
      // We need to fetch per-user stats. Since we don't have a batch function for this specific query across users yet,
      // we'll iterate for now. In production, a dedicated RPC or view would be better.
      
      const leaderboardData: LeaderboardEntry[] = []

      const myEstimated1RM = records.length > 0 ? Math.max(...records.map(r => r.estimated1RM)) : 0
      
      if (profileData) {
        let strengthLevel: StrengthLevel | null = null
        if (exerciseData && exerciseData.name && profileData.weight_kg && profileData.gender) {
             const info = getStrengthStandard(
                exerciseData.name,
                profileData.gender as 'male' | 'female',
                profileData.weight_kg,
                myEstimated1RM
             )
             if (info) strengthLevel = info.level
        }

        leaderboardData.push({
            rank: 0, // temporary
            userId: user.id,
            displayName: 'You', // Display "You" for current user
            userTag: profileData.user_tag || '',
            avatarUrl: profileData.avatar_url,
            max1RM: myEstimated1RM,
            isCurrentUser: true,
            strengthLevel
        })
      }

      // Get friends' max estimated 1RMs
      // Limit concurrent requests
      await Promise.all(following.map(async (follow) => {
          const friendId = follow.followee_id
          const friendProfile = follow.followee
          
          try {
              // Need profile details for standards calculation (gender, weight)
              const fullFriendProfile = await database.profiles.getById(friendId)

              const friendRecords = await database.stats.getExerciseRecordsByWeight(friendId, exerciseId)
              const friendEstimated1RM = friendRecords.length > 0 ? Math.max(...friendRecords.map(r => r.estimated1RM)) : 0
              
              if (friendEstimated1RM > 0) { // Only include if they have any tracked sets for this exercise
                  let strengthLevel: StrengthLevel | null = null
                  if (exerciseData && exerciseData.name && fullFriendProfile?.weight_kg && fullFriendProfile?.gender) {
                       const info = getStrengthStandard(
                          exerciseData.name,
                          fullFriendProfile.gender as 'male' | 'female',
                          fullFriendProfile.weight_kg,
                          friendEstimated1RM
                       )
                       if (info) strengthLevel = info.level
                  }

                  leaderboardData.push({
                      rank: 0,
                      userId: friendId,
                      displayName: friendProfile.display_name || 'User',
                      userTag: friendProfile.user_tag || '',
                      avatarUrl: friendProfile.avatar_url,
                      max1RM: friendEstimated1RM,
                      isCurrentUser: false,
                      strengthLevel
                  })
              }
          } catch (e) {
              console.warn(`Could not fetch stats for user ${friendId}`, e)
          }
      }))

      // Sort by max estimated 1RM descending
      leaderboardData.sort((a, b) => b.max1RM - a.max1RM)

      // Assign ranks
      leaderboardData.forEach((entry, index) => {
          entry.rank = index + 1
      })

      setLeaderboard(leaderboardData)

    } catch (error) {
      console.error('Error loading exercise details:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, exerciseId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const getStrengthInfo = useCallback(() => {
    if (!profile?.gender || !profile?.weight_kg || !exercise?.name || !max1RM) {
      return null
    }

    if (!hasStrengthStandards(exercise.name)) {
      return null
    }

    return getStrengthStandard(
      exercise.name,
      profile.gender as 'male' | 'female',
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

  const handleStartEdit = () => {
    if (!exercise) return
    setEditName(exercise.name)
    setEditMuscleGroup(exercise.muscle_group || '')
    setEditType(exercise.type || '')
    setEditEquipment(exercise.equipment || '')
    setIsEditing(true)
  }

  const handleUpdateExercise = async () => {
    if (!user?.id || !exerciseId) return

    if (!editName.trim()) {
      Alert.alert('Error', 'Exercise name cannot be empty')
      return
    }

    try {
      const updatedExercise = await database.exercises.update(
        exerciseId,
        user.id,
        {
          name: editName.trim(),
          muscle_group: editMuscleGroup || undefined,
          type: editType || undefined,
          equipment: editEquipment || undefined,
        }
      )
      
      setExercise(updatedExercise)
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

  return (
    <SlideInView
      style={styles.container}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.innerContainer, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {exercise?.name || 'Exercise Details'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          {isOwner ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={handleStartEdit}
                style={styles.headerActionButton}
              >
                <Ionicons name="create-outline" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteExercise}
                style={styles.headerDeleteButton}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerRightSpacer} />
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsBorder}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabs}
            contentContainerStyle={styles.tabsContent}
          >
            {exerciseHasRankTracking && (
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'level' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('level')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'level' && styles.activeTabText,
                  ]}
                >
                  Level
                </Text>
              </TouchableOpacity>
            )}
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
                Records
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
                How To
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'leaderboard' && styles.activeTab,
              ]}
              onPress={() => {
                if (!isProMember) {
                  setPaywallVisible(true)
                } else {
                  setActiveTab('leaderboard')
                }
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'leaderboard' && styles.activeTabText,
                ]}
              >
                Leaderboard
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.brandPrimary]}
                tintColor={colors.brandPrimary}
              />
            }
          >
          {activeTab === 'level' ? (
            <View style={styles.tabContent}>
              {/* Check if exercise has strength standards */}
              {exercise && profile?.gender && profile?.weight_kg && hasStrengthStandards(exercise.name) ? (
                (() => {
                  const ladder = getStandardsLadder(exercise.name, profile.gender as 'male' | 'female')
                  if (!ladder) return null

                  const currentInfo = strengthInfo
                  const currentLevelIndex = currentInfo 
                    ? ladder.findIndex(s => s.level === currentInfo.level)
                    : -1

                  return (
                    <>
                      {/* Current Level Hero Card */}
                      {currentInfo && (
                        <View style={[styles.levelHeroCard, { borderColor: currentInfo.standard.color }]}>
                          <View style={styles.levelHeroGlow}>
                            <LevelBadge level={currentInfo.level} size="hero" />
                            <View style={styles.levelHeroContent}>
                              <Text style={styles.levelHeroLabel}>CURRENT RANK</Text>
                              <Text style={[styles.levelHeroTitle, { color: currentInfo.standard.color }]}>
                                {currentInfo.level}
                              </Text>
                              <Text style={styles.levelHeroSubtitle}>{currentInfo.standard.description}</Text>
                            </View>
                          </View>
                          
                          {/* Progress to next level */}
                          {currentInfo.nextLevel && (
                            <View style={styles.levelProgressSection}>
                              <View style={styles.levelProgressHeader}>
                                <Text style={styles.levelProgressLabel}>
                                  Progress to {currentInfo.nextLevel.level}
                                </Text>
                                <Text style={[styles.levelProgressPercent, { color: currentInfo.nextLevel.color }]}>
                                  {Math.round(currentInfo.progress)}%
                                </Text>
                              </View>
                              <View style={styles.levelProgressBar}>
                                <View 
                                  style={[
                                    styles.levelProgressFill, 
                                    { 
                                      width: `${currentInfo.progress}%`,
                                      backgroundColor: currentInfo.nextLevel.color 
                                    }
                                  ]} 
                                />
                              </View>
                              <Text style={styles.levelProgressTarget}>
                                Target: {formatWeight(
                                  Math.ceil(profile.weight_kg * currentInfo.nextLevel.multiplier),
                                  { maximumFractionDigits: 0 }
                                )} 1RM
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Levels Ladder */}
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>All Ranks</Text>
                      </View>

                      <View style={styles.levelsLadder}>
                        {[...ladder].reverse().map((standard, idx) => {
                          const actualIndex = ladder.length - 1 - idx
                          const isAchieved = currentLevelIndex >= actualIndex
                          const isCurrent = currentLevelIndex === actualIndex
                          const isLocked = currentLevelIndex < actualIndex
                          const targetWeight = Math.ceil((profile.weight_kg ?? 0) * standard.multiplier)

                          return (
                            <View 
                              key={standard.level}
                              style={[
                                styles.levelLadderItem,
                                isCurrent && styles.levelLadderItemCurrent,
                                isCurrent && { borderColor: standard.color },
                              ]}
                            >
                                {/* Rank badge Column */}
                                <View style={styles.levelLadderBadgeColumn}>
                                  {idx < ladder.length - 1 && idx !== 0 && (
                                    <View 
                                      style={[
                                        styles.levelLadderLine,
                                        isAchieved && { backgroundColor: standard.color },
                                      ]} 
                                    />
                                  )}
                                  <LevelBadge 
                                    level={standard.level} 
                                    size="large" 
                                    style={[
                                      isLocked && { opacity: 0.5 },
                                      isCurrent && styles.levelLadderBadgeCurrent,
                                    ]}
                                  />
                                </View>

                              {/* Level info */}
                              <View style={styles.levelLadderInfo}>
                                <Text 
                                  style={[
                                    styles.levelLadderName,
                                    isCurrent && { color: standard.color, fontWeight: '700' },
                                    isLocked && { color: colors.textSecondary },
                                  ]}
                                >
                                  {standard.level}
                                </Text>
                                <Text 
                                  style={[
                                    styles.levelLadderDesc,
                                    isLocked && { color: colors.textSecondary, opacity: 0.6 },
                                  ]}
                                >
                                  {standard.description}
                                </Text>
                              </View>

                              {/* Target weight */}
                              <View style={styles.levelLadderTarget}>
                                <Text 
                                  style={[
                                    styles.levelLadderWeight,
                                    isCurrent && { color: standard.color },
                                    isLocked && { color: colors.textSecondary },
                                  ]}
                                >
                                  {formatWeight(targetWeight, { maximumFractionDigits: 0 })}
                                </Text>
                                <Text style={styles.levelLadderWeightLabel}>1RM</Text>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </>
                  )
                })()
              ) : (
                <View style={styles.noLevelsContainer}>
                  <Ionicons name="ribbon-outline" size={48} color={colors.textTertiary} />
                  <Text style={styles.noLevelsTitle}>No Ranking Available</Text>
                  <Text style={styles.noLevelsText}>
                    {!profile?.weight_kg 
                      ? 'Add your bodyweight in settings to see your strength ranking.'
                      : 'Strength rankings are only available for major compound lifts.'}
                  </Text>
                </View>
              )}
            </View>
          ) : activeTab === 'records' ? (
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
                <Text style={styles.sectionTitle}>Stats</Text>
              </View>

              <View style={styles.statsGrid}>
                {strengthInfo && (
                  <>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Level</Text>
                      <View 
                        style={[
                          styles.levelBadge, 
                          { backgroundColor: getLevelColor(strengthInfo.level as any) }
                        ]}
                      >
                        <Text style={styles.levelText}>{strengthInfo.level}</Text>
                      </View>
                    </View>
                    <View style={styles.separator} />

                    {strengthInfo.nextLevel && (
                      <>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>
                            Next Level ({strengthInfo.nextLevel.level})
                          </Text>
                          <Text style={styles.statValue}>
                            {['Pull-Up', 'Dips'].includes(exercise?.name || '')
                              ? `${Math.ceil(strengthInfo.nextLevel.multiplier)} reps`
                              : formatWeight(
                                  Math.ceil(
                                    (profile?.weight_kg || 0) *
                                      strengthInfo.nextLevel.multiplier,
                                  ),
                                  { maximumFractionDigits: 0 },
                                )}
                          </Text>
                        </View>
                        <View style={styles.separator} />
                      </>
                    )}
                  </>
                )}

                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>1RM</Text>
                  <Text style={styles.statValue}>
                    {formatWeight(personalRecords.best1RM, { maximumFractionDigits: 1 })}
                  </Text>
                </View>
                <View style={styles.separator} />
                
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Heaviest Weight</Text>
                  <Text style={styles.statValue}>
                    {formatWeight(personalRecords.heaviestWeight, { maximumFractionDigits: 1 })}
                  </Text>
                </View>
                <View style={styles.separator} />

                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Best Set</Text>
                  <Text style={styles.statValue}>
                    {personalRecords.bestSetVolume 
                        ? `${formatWeight(personalRecords.bestSetVolume.weight, { maximumFractionDigits: 0 })} x ${personalRecords.bestSetVolume.reps}` 
                        : '-'}
                  </Text>
                </View>
              </View>

              {/* All Records Section */}
              <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>All Records</Text>
              </View>

              <View style={styles.recordsList}>
                {recordsList.length === 0 ? (
                  <Text style={styles.emptyText}>No records tracked yet</Text>
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
                            1RM: {formatWeight(record.estimated1RM, { maximumFractionDigits: 0 })}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : activeTab === 'leaderboard' ? (
            <View style={styles.tabContent}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Following</Text>
                </View>

                <View style={styles.leaderboardList}>
                    {leaderboard.map((entry, index) => (
                        <View key={entry.userId}>
                            <View style={styles.leaderboardItem}>
                                <View style={styles.rankContainer}>
                                    <View style={[styles.rankBadge, entry.rank <= 3 ? styles[`rankBadge${entry.rank}` as keyof typeof styles] : styles.rankBadgeDefault]}>
                                        <Text style={[styles.rankText, entry.rank <= 3 ? styles.rankTextTop : styles.rankTextDefault]}>{entry.rank}</Text>
                                    </View>
                                </View>
                                <View style={styles.userContainer}>
                                    {entry.avatarUrl ? (
                                        <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />
                                    ) : (
                                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                            <Text style={styles.avatarInitial}>{entry.displayName.charAt(0)}</Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.userName} numberOfLines={1}>
                                            {entry.displayName}
                                        </Text>
                                        {entry.strengthLevel && (
                                            <View 
                                                style={[
                                                    styles.miniLevelBadge, 
                                                    { backgroundColor: getLevelColor(entry.strengthLevel as any) }
                                                ]}
                                            >
                                                <Text style={styles.miniLevelText}>{entry.strengthLevel}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Text style={styles.leaderboardValue}>
                                    {formatWeight(entry.max1RM, { maximumFractionDigits: 0 })}
                                </Text>
                            </View>
                            {index < leaderboard.length - 1 && <View style={styles.separator} />}
                        </View>
                    ))}
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
                                              {set.weight
                                                ? formatWeight(set.weight, {
                                                    maximumFractionDigits: 1,
                                                  })
                                                : '-'}{' '}
                                              x {set.reps || 0} reps
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

        <Paywall
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          title="Unlock Leaderboard"
          message="See how you rank against friends on every exercise."
        />

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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.bg,
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
      paddingHorizontal: 60,
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
      backgroundColor: colors.bg,
    },
    tabs: {
      flexGrow: 0,
    },
    tabsContent: {
      paddingHorizontal: 8,
    },
    tab: {
      paddingVertical: 16,
      paddingHorizontal: 16,
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
        aspectRatio: 4 / 3,
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
    leaderboardContainer: {
        gap: 16,
    },
    leaderboardSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8
    },
    leaderboardList: {
        backgroundColor: colors.bg,
        borderRadius: 12,
        overflow: 'hidden'
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border
    },
    rankContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 12
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    rankBadge1: {
        backgroundColor: '#FFD700' // Gold
    },
    rankBadge2: {
        backgroundColor: '#C0C0C0' // Silver
    },
    rankBadge3: {
        backgroundColor: '#CD7F32' // Bronze
    },
    rankBadgeDefault: {
        backgroundColor: 'transparent'
    },
    rankText: {
        fontSize: 12,
        fontWeight: '700'
    },
    rankTextTop: {
        color: '#FFFFFF'
    },
    rankTextDefault: {
        color: colors.textPrimary
    },
    userContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.bg
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.brandPrimary
    },
    avatarInitial: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF'
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary
    },
    leaderboardValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary
    },
    miniLevelBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4
    },
    miniLevelText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF'
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
    // Level Tab - Hero Card
    levelHeroCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
    },
    levelHeroGlow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    levelHeroBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelHeroContent: {
        flex: 1,
    },
    levelHeroLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 2,
    },
    levelHeroTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    levelHeroSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    // Level Tab - Progress Section
    levelProgressSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    levelProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    levelProgressLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    levelProgressPercent: {
        fontSize: 16,
        fontWeight: '700',
    },
    levelProgressBar: {
        height: 8,
        backgroundColor: colors.surfaceSubtle,
        borderRadius: 4,
        overflow: 'hidden',
    },
    levelProgressFill: {
        height: '100%',
        borderRadius: 4,
    },
    levelProgressTarget: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 8,
    },
    // Level Tab - Levels Ladder
    levelsLadder: {
        gap: 0,
    },
    levelLadderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        backgroundColor: colors.bg,
        borderRadius: 0,
        borderWidth: 0,
        position: 'relative' as const,
    },
    levelLadderItemCurrent: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 2,
        marginVertical: 4,
    },
    levelLadderBadgeColumn: {
        width: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        position: 'relative',
    },
    levelLadderLine: {
        position: 'absolute',
        width: 3,
        top: 24, // middle of first badge
        bottom: -52, // reach far enough to connect to next badge center
        left: 26.5, // (56/2) - (3/2)
        backgroundColor: colors.surfaceSubtle,
        zIndex: -1,
    },
    levelLadderBadge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelLadderBadgeCurrent: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    levelLadderInfo: {
        flex: 1,
    },
    levelLadderName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    levelLadderDesc: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    levelLadderTarget: {
        alignItems: 'flex-end',
    },
    levelLadderWeight: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    levelLadderWeightLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    // Level Tab - Info Card
    levelInfoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
    },
    levelInfoText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    // Level Tab - No Levels State
    noLevelsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
        gap: 12,
    },
    noLevelsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    noLevelsText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
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
  })
