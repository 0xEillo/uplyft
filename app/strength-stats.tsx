import { Paywall } from '@/components/paywall'
import { ProBadge } from '@/components/pro-badge'
import { SlideInView } from '@/components/slide-in-view'
import { SupportedExercisesSheet } from '@/components/SupportedExercisesSheet'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import {
    getStandardsLadder,
    getStrengthStandard,
    hasStrengthStandards,
    type StrengthLevel,
} from '@/lib/strength-standards'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ExerciseRecord {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

interface ExerciseData {
  exerciseId: string
  exerciseName: string
  max1RM: number
  records: ExerciseRecord[]
}

type TabType = 'standards' | 'records'

export default function StrengthStatsScreen() {
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exerciseData, setExerciseData] = useState<ExerciseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('standards')
  const [shouldExit, setShouldExit] = useState(false)
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set(),
  )
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [showSupportedSheet, setShowSupportedSheet] = useState(false)

  const loadData = useCallback(async () => {
    if (!user?.id) return

    try {
      // Load profile data
      const profileData = await database.profiles.getById(user.id)
      setProfile(profileData)

      // Load exercise data
      const data = await database.stats.getMajorCompoundLiftsData(user.id)
      // Sort by max1RM descending
      const sorted = data.sort((a, b) => b.max1RM - a.max1RM)
      setExerciseData(sorted)
    } catch (error) {
      console.error('Error loading strength stats:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  const toggleExercise = useCallback((exerciseId: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
      } else {
        next.add(exerciseId)
      }
      return next
    })
  }, [])

  const navigateToExercise = useCallback(
    (exerciseId: string) => {
      router.push({
        pathname: '/exercise/[exerciseId]',
        params: { exerciseId },
      })
    },
    [router],
  )

  const getStrengthInfo = useCallback(
    (exerciseName: string, max1RM: number) => {
      if (!profile?.gender || !profile?.weight_kg) {
        return null
      }

      if (!hasStrengthStandards(exerciseName)) {
        return null
      }

      return getStrengthStandard(
        exerciseName,
        profile.gender as 'male' | 'female',
        profile.weight_kg,
        max1RM,
      )
    },
    [profile?.gender, profile?.weight_kg],
  )

  const getLevelColor = (level: StrengthLevel): string => {
    const colors = {
      Beginner: '#9CA3AF',
      Novice: '#3B82F6',
      Intermediate: '#10B981',
      Advanced: '#8B5CF6',
      Elite: '#F59E0B',
      'World Class': '#EF4444',
    }
    return colors[level]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const styles = createStyles(colors)
  const insets = useSafeAreaInsets()

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <Stack.Screen
        options={{
          title: 'Strength Progress',
          headerShown: false,
        }}
      />
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Strength Progress</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <View style={styles.container}>
          {/* Top Info Bar */}
          <View style={styles.topInfoBar}>
            <TouchableOpacity 
              onPress={() => setShowSupportedSheet(true)}
              style={styles.supportedLink}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.supportedLinkText}>Supported Exercises</Text>
            </TouchableOpacity>
          </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'standards' && styles.activeTab]}
            onPress={() => setActiveTab('standards')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'standards' && styles.activeTabText,
              ]}
            >
              Standards
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'records' && styles.activeTab]}
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
        </View>

        {/* Tab Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your strength data...</Text>
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
            {/* Content based on active tab */}
            {exerciseData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="barbell-outline"
                size={64}
                color={colors.textPlaceholder}
              />
              <Text style={styles.emptyTitle}>No compound lifts yet</Text>
              <Text style={styles.emptySubtitle}>
                Start tracking exercises like bench press, squat, and deadlift
                to see your strength standards
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowSupportedSheet(true)}
              >
                <Text style={styles.emptyButtonText}>View all supported exercises</Text>
              </TouchableOpacity>
            </View>
          ) : activeTab === 'standards' ? (
            /* Standards Tab */
            exerciseData.map((exercise) => {
              const strengthInfo = getStrengthInfo(
                exercise.exerciseName,
                exercise.max1RM,
              )
              const isExpanded = expandedExercises.has(exercise.exerciseId)
              const allLevels = profile?.gender
                ? getStandardsLadder(
                    exercise.exerciseName,
                    profile.gender as 'male' | 'female',
                  )
                : null

              return (
                <View key={exercise.exerciseId} style={styles.exerciseCard}>
                  {/* Exercise Header - Clickable */}
                  <TouchableOpacity
                    style={styles.exerciseHeader}
                    onPress={() => navigateToExercise(exercise.exerciseId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseHeaderLeft}>
                      <View style={styles.exerciseIconContainer}>
                        <Ionicons
                          name="barbell"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.exerciseHeaderText}>
                        <Text style={styles.exerciseName}>
                          {exercise.exerciseName}
                        </Text>
                        {isProMember && (
                          <Text style={styles.exerciseMax}>
                            1RM: {formatWeight(exercise.max1RM, {
                              maximumFractionDigits:
                                weightUnit === 'kg' ? 1 : 0,
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.exerciseHeaderRight}>
                      {strengthInfo && !isProMember ? (
                        <ProBadge onPress={() => setPaywallVisible(true)} size="small" />
                      ) : strengthInfo ? (
                        <View
                          style={[
                            styles.levelBadge,
                            {
                              backgroundColor: getLevelColor(strengthInfo.level),
                            },
                          ]}
                        >
                          <Text style={styles.levelBadgeText}>
                            {strengthInfo.level}
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation()
                          toggleExercise(exercise.exerciseId)
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded: Show all levels */}
                  {isExpanded && allLevels && profile?.weight_kg && (
                    <View style={styles.exerciseContent}>
                      <View style={styles.standardsSection}>
                        <Text style={styles.sectionTitle}>
                          All Strength Standards
                        </Text>
                        {allLevels.map((levelStandard, index) => {
                          const targetWeight = Math.ceil(
                            (profile.weight_kg || 0) * levelStandard.multiplier,
                          )
                          const isCurrentLevel =
                            strengthInfo?.level === levelStandard.level
                          const isPassed = strengthInfo
                            ? allLevels.findIndex(
                                (l) => l.level === strengthInfo.level,
                              ) >= index
                            : false

                          return (
                            <View
                              key={levelStandard.level}
                              style={[
                                styles.levelRow,
                                isProMember && isCurrentLevel && styles.levelRowCurrent,
                              ]}
                            >
                              <View style={styles.levelRowLeft}>
                                <View
                                  style={[
                                    styles.levelDot,
                                    {
                                      backgroundColor: getLevelColor(
                                        levelStandard.level,
                                      ),
                                    },
                                    isProMember && isPassed && styles.levelDotPassed,
                                  ]}
                                >
                                  {isProMember && isPassed && (
                                    <Ionicons
                                      name="checkmark"
                                      size={12}
                                      color={colors.white}
                                    />
                                  )}
                                </View>
                                <View style={styles.levelRowText}>
                                  <Text
                                    style={[
                                      styles.levelRowTitle,
                                      isProMember && isCurrentLevel &&
                                        styles.levelRowTitleCurrent,
                                    ]}
                                  >
                                    {levelStandard.level}
                                  </Text>
                                  <Text style={styles.levelRowDescription}>
                                    {levelStandard.description}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.levelRowRight}>
                                {isProMember ? (
                                  <Text
                                    style={[
                                      styles.levelRowWeight,
                                      isCurrentLevel &&
                                        styles.levelRowWeightCurrent,
                                    ]}
                                  >
                                    {formatWeight(targetWeight, {
                                      maximumFractionDigits:
                                        weightUnit === 'kg' ? 1 : 0,
                                    })}
                                  </Text>
                                ) : (
                                  <ProBadge onPress={() => setPaywallVisible(true)} size="small" />
                                )}
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )
            })
          ) : (
            /* Records Tab */
            exerciseData.map((exercise) => {
              const isExpanded = expandedExercises.has(exercise.exerciseId)

              return (
                <View key={exercise.exerciseId} style={styles.exerciseCard}>
                  {/* Exercise Header */}
                  <TouchableOpacity
                    style={styles.exerciseHeader}
                    onPress={() => navigateToExercise(exercise.exerciseId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseHeaderLeft}>
                      <View style={styles.exerciseIconContainer}>
                        <Ionicons
                          name="barbell"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.exerciseHeaderText}>
                        <Text style={styles.exerciseName}>
                          {exercise.exerciseName}
                        </Text>
                        <Text style={styles.exerciseMax}>
                          {exercise.records.length} weight
                          {exercise.records.length !== 1 ? 's' : ''} tracked
                        </Text>
                      </View>
                    </View>
                    <View style={styles.exerciseHeaderRight}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation()
                          toggleExercise(exercise.exerciseId)
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Weight Records - Only visible when expanded */}
                  {isExpanded && (
                    <View style={styles.exerciseContent}>
                    <View style={styles.recordsSection}>
                      <Text style={styles.sectionTitle}>Weight Records</Text>
                      {exercise.records.length === 0 ? (
                        <Text style={styles.noRecordsText}>
                          No records yet
                        </Text>
                      ) : (
                        exercise.records.map((record, index) => (
                          <View key={index} style={styles.recordRow}>
                            <View style={styles.recordLeft}>
                              <Text style={styles.recordWeight}>
                                {formatWeight(record.weight, {
                                  maximumFractionDigits:
                                    weightUnit === 'kg' ? 1 : 0,
                                })}
                              </Text>
                              <Text style={styles.recordReps}>
                                {record.maxReps} rep
                                {record.maxReps !== 1 ? 's' : ''}
                              </Text>
                            </View>
                            <View style={styles.recordRight}>
                              <Text style={styles.recordDate}>
                                {formatDate(record.date)}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}
              </View>
            )
          })
          )}
          </ScrollView>
        )}
        </View>
      </View>

      {/* Paywall Modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        title="Unlock Your Strength Level"
        message="See which strength standard you've achieved. Upgrade to view your ranking and track your progress towards Elite and World Class levels."
      />

      <SupportedExercisesSheet
        isVisible={showSupportedSheet}
        onClose={() => setShowSupportedSheet(false)}
      />
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.white,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBackButton: {
      padding: 4,
      marginLeft: -4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerRightSpacer: {
      width: 32,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
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
    topInfoBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: colors.white,
    },
    supportedLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    supportedLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: 12,
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    summaryCard: {
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    summaryIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryTextContainer: {
      flex: 1,
    },
    summaryTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    summarySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      padding: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    exerciseCard: {
      backgroundColor: colors.white,
      borderRadius: 16,
      marginBottom: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      overflow: 'hidden',
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    exerciseHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    exerciseIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    exerciseHeaderText: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    exerciseMax: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    exerciseHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    levelBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    levelBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    exerciseContent: {
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
      padding: 14,
      gap: 8,
    },
    strengthSection: {
      gap: 4,
    },
    standardsSection: {
      gap: 4,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 10,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    levelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 0,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    levelRowCurrent: {
      backgroundColor: 'transparent',
      borderBottomColor: colors.primary,
      borderBottomWidth: 2,
      paddingBottom: -1,
    },
    levelRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    levelDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    levelDotPassed: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    levelRowText: {
      flex: 1,
    },
    levelRowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    levelRowTitleCurrent: {
      fontWeight: '700',
      color: colors.primary,
    },
    levelRowDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    levelRowRight: {
      alignItems: 'flex-end',
      gap: 2,
    },
    levelRowWeight: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    levelRowWeightCurrent: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.primary,
    },
    strengthLevelContainer: {
      gap: 16,
    },
    strengthLevelInfo: {
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
    },
    currentLevelLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    currentLevelValue: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    levelDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    progressBarContainer: {
      gap: 8,
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: colors.backgroundLight,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    nextLevelInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
    },
    nextLevelLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    nextLevelTarget: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    recordsSection: {
      gap: 0,
    },
    noRecordsText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 16,
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
  })
