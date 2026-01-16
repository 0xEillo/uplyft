import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ExerciseMedia } from '@/components/ExerciseMedia'
import { Paywall } from '@/components/paywall'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { getLevelColor } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import {
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

type TabType = 'records' | 'history' | 'leaderboard' | 'how_to'

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
  const insets = useSafeAreaInsets()

  // Check if current user owns this exercise
  const isOwner = exercise?.created_by === user?.id && user?.id

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
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {exercise?.name || 'Exercise Details'}
          </Text>
          {isOwner ? (
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
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
          {activeTab === 'records' ? (
            <View style={styles.summaryContainer}>
              {/* Media Section */}
              <View style={styles.mediaContainer}>
                  <ExerciseMedia 
                      gifUrl={exercise?.gif_url} 
                      mode="full" 
                      style={styles.media}
                  />
              </View>

              {/* Stats Section */}
              <View style={[styles.sectionHeader, styles.paddedHorizontal]}>
                <Text style={styles.sectionTitle}>Stats</Text>
              </View>

              <View style={[styles.statsGrid, styles.paddedMargin]}>
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
              <View style={[styles.sectionHeader, styles.paddedHorizontal, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>All Records</Text>
              </View>

              <View style={[styles.recordsList, styles.paddedMargin]}>
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
            <View style={[styles.leaderboardContainer, styles.paddedContainer]}>
                <Text style={styles.leaderboardSubtitle}>Following (Est. 1RM)</Text>

                <View style={styles.leaderboardList}>
                    {leaderboard.map((entry) => (
                        <View key={entry.userId} style={styles.leaderboardItem}>
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
                    ))}
                </View>
            </View>
          ) : activeTab === 'how_to' ? (
              <View style={styles.howToContainer}>
                  {/* Media Section */}
                  <View style={styles.mediaContainer}>
                      <ExerciseMedia 
                          gifUrl={exercise?.gif_url} 
                          mode="full" 
                          style={styles.media}
                      />
                  </View>

                  {/* Muscles Section */}
                  <View style={[styles.sectionContainer, styles.paddedHorizontal]}>
                      <Text style={styles.howToTitle}>{exercise?.name}</Text>
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
                  <View style={[styles.instructionsContainer, styles.paddedHorizontal]}>
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
                  )}
              </View>
          ) : (
            <View style={[styles.historyContainer, styles.paddedContainer]}>
                {history.length === 0 ? (
                    <Text style={styles.emptyText}>No history found for this exercise.</Text>
                ) : (
                    history.map((session, index) => (
                        <View key={index} style={styles.historyItem}>
                            <View style={styles.historyHeader}>
                                <Text style={styles.historyDate}>{formatDateTime(session.date)}</Text>
                            </View>
                            <Text style={styles.exerciseNameSmall}>{exercise?.name}</Text>
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
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    innerContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    headerBackButton: {
      padding: 4,
      marginLeft: -4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    headerRightSpacer: {
      width: 32,
      alignItems: 'flex-end'
    },
    headerDeleteButton: {
      padding: 4,
      marginRight: -4,
    },
    tabsBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
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
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.primary,
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
    summaryContainer: {
      gap: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 0, // Using summaryContainer gap instead
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    statsGrid: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    paddedHorizontal: {
      paddingHorizontal: 16,
    },
    paddedMargin: {
      marginHorizontal: 16,
    },
    paddedContainer: {
        paddingHorizontal: 16,
        paddingTop: 16
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
      color: colors.text,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      gap: 16,
    },
    infoCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoStep: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    infoContent: {
      flex: 1,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    levelCard: {
        backgroundColor: colors.backgroundLight,
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
        color: colors.text,
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
        width: '100%',
        aspectRatio: 4 / 3,
        backgroundColor: '#FFFFFF',
        // removed borderRadius and overflow for immersive view
    },
    media: {
        width: '100%',
        height: '100%'
    },
    sectionContainer: {
        gap: 4
    },
    howToTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4
    },
    musclesText: {
        fontSize: 16,
        color: colors.textSecondary
    },
    muscleHighlight: {
        color: colors.text
    },
    muscleHighlightSecondary: {
        color: colors.textSecondary
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
        backgroundColor: colors.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -2, // Align with text cap height
    },
    stepNumberText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    stepText: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
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
        gap: 16
    },
    emptyText: {
        textAlign: 'center',
        color: colors.textSecondary,
        paddingVertical: 24,
    },
    historyItem: {
        backgroundColor: colors.backgroundLight,
        borderRadius: 12,
        padding: 16,
        gap: 12
    },
    historyHeader: {
    },
    historyDate: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    exerciseNameSmall: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text
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
        backgroundColor: `${colors.warning}25`,
    },
    setNumberBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    warmupText: {
        color: colors.warning,
    },
    setDetails: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text
    },
    recordsList: {
        backgroundColor: colors.backgroundLight,
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
      color: colors.text,
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
        backgroundColor: colors.backgroundLight,
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
        color: colors.text
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
        backgroundColor: colors.backgroundLight
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary
    },
    avatarInitial: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF'
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text
    },
    leaderboardValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text
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
  })
